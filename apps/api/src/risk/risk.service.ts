import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PhoneStore } from '../phone/phone.store.js';
import { maskIp } from '../phone/phone.util.js';
import { SmsService } from '../sms/sms.service.js';
import {
  LoginAuditEntry,
  LoginAuditInput,
  LoginMethod,
  RequestMeta,
  RiskAction,
  RiskAssessment,
  RiskContext,
  RiskEvent,
  RiskLevel,
  RiskSignal,
} from './risk.types.js';

interface ChallengeRecord {
  token: string;
  userId: string;
  phone: string;
  meta: RequestMeta;
  method: LoginMethod;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

interface RateResult {
  allowed: boolean;
  retryAfter: number;
  count: number;
}

const CHALLENGE_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_MAX_ATTEMPTS = 5;
const FAILURE_WINDOW_MS = 15 * 60 * 1000;
const ACTIVITY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_AUDIT_ENTRIES = 2000;
const MAX_EVENTS = 5000;

/** Per-action rate limits: [limit, windowMs]. */
const RATE_LIMITS: Record<RiskAction, { scope: 'phone' | 'ip' | 'device' | 'user'; limit: number; windowMs: number }[]> = {
  sms_send: [
    { scope: 'phone', limit: 5, windowMs: 10 * 60 * 1000 },
    { scope: 'ip', limit: 15, windowMs: 10 * 60 * 1000 },
    { scope: 'device', limit: 15, windowMs: 10 * 60 * 1000 },
  ],
  login: [
    { scope: 'ip', limit: 30, windowMs: 10 * 60 * 1000 },
    { scope: 'user', limit: 10, windowMs: 10 * 60 * 1000 },
  ],
  phone_login: [
    { scope: 'ip', limit: 20, windowMs: 10 * 60 * 1000 },
    { scope: 'phone', limit: 10, windowMs: 10 * 60 * 1000 },
  ],
  phone_register: [{ scope: 'ip', limit: 10, windowMs: 60 * 60 * 1000 }],
  bind_phone: [
    { scope: 'user', limit: 5, windowMs: 60 * 60 * 1000 },
    { scope: 'phone', limit: 10, windowMs: 60 * 60 * 1000 },
  ],
  unbind_phone: [{ scope: 'user', limit: 3, windowMs: 60 * 60 * 1000 }],
  kyc_submit: [{ scope: 'user', limit: 5, windowMs: 24 * 60 * 60 * 1000 }],
};

const SUSPICIOUS_UA = /(curl|wget|python-requests|python-urllib|go-http-client|okhttp|headlesschrome|phantomjs|selenium|puppeteer|playwright)/i;

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  private readonly rates = new Map<string, number[]>();
  private readonly failures = new Map<string, number[]>();
  private readonly userDevices = new Map<string, Map<string, number>>();
  private readonly deviceUsers = new Map<string, Map<string, number>>();
  private readonly userIps = new Map<string, Map<string, number>>();
  private readonly ipUsers = new Map<string, Map<string, number>>();
  private readonly challenges = new Map<string, ChallengeRecord>();
  private readonly loginAudits: LoginAuditEntry[] = [];
  private readonly events: RiskEvent[] = [];

  constructor(
    private prisma: PrismaService,
    private sms: SmsService,
    private phones: PhoneStore,
  ) {}

  // ---------------------------------------------------------------- utilities

  private newId(): string {
    return crypto.randomUUID();
  }

  private blockedIps(): Set<string> {
    return new Set(
      (process.env.RISK_BLOCKED_IPS || '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
  }

  private isStrict(): boolean {
    return process.env.RISK_STRICT === 'true';
  }

  /** Sliding-window counter. Every call records a hit when allowed. */
  private hit(scope: string, key: string, limit: number, windowMs: number): RateResult {
    const now = Date.now();
    const bucketKey = `${scope}:${key}`;
    const timestamps = (this.rates.get(bucketKey) ?? []).filter((ts) => now - ts < windowMs);
    if (timestamps.length >= limit) {
      const oldest = timestamps[0];
      const retryAfter = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
      this.rates.set(bucketKey, timestamps);
      return { allowed: false, retryAfter, count: timestamps.length };
    }
    timestamps.push(now);
    this.rates.set(bucketKey, timestamps);
    return { allowed: true, retryAfter: 0, count: timestamps.length };
  }

  private failureKey(userId?: string | null, ip?: string | null): string[] {
    const keys: string[] = [];
    if (userId) keys.push(`u:${userId}`);
    if (ip) keys.push(`ip:${ip}`);
    return keys;
  }

  recordFailure(userId?: string | null, ip?: string | null): void {
    const now = Date.now();
    for (const key of this.failureKey(userId, ip)) {
      const list = (this.failures.get(key) ?? []).filter((ts) => now - ts < FAILURE_WINDOW_MS);
      list.push(now);
      this.failures.set(key, list);
    }
  }

  clearFailures(userId?: string | null, ip?: string | null): void {
    for (const key of this.failureKey(userId, ip)) this.failures.delete(key);
  }

  failureCount(key: string): number {
    const now = Date.now();
    return (this.failures.get(key) ?? []).filter((ts) => now - ts < FAILURE_WINDOW_MS).length;
  }

  private touch(map: Map<string, Map<string, number>>, primary: string, secondary: string) {
    const now = Date.now();
    const entries = map.get(primary) ?? new Map<string, number>();
    entries.set(secondary, now);
    // Drop stale activity so the maps stay bounded.
    for (const [key, ts] of entries.entries()) {
      if (now - ts > ACTIVITY_RETENTION_MS) entries.delete(key);
    }
    map.set(primary, entries);
  }

  /** Persist device/IP observations after a successful authentication. */
  remember(ctx: RiskContext): void {
    if (ctx.userId && ctx.deviceId) {
      this.touch(this.userDevices, ctx.userId, ctx.deviceId);
      this.touch(this.deviceUsers, ctx.deviceId, ctx.userId);
    }
    if (ctx.userId && ctx.ip) {
      this.touch(this.userIps, ctx.userId, ctx.ip);
      this.touch(this.ipUsers, ctx.ip, ctx.userId);
    }
  }

  private knownDevices(userId: string): Map<string, number> {
    return this.userDevices.get(userId) ?? new Map();
  }

  // --------------------------------------------------------------- assessment

  async assess(ctx: RiskContext): Promise<RiskAssessment> {
    const signals: RiskSignal[] = [];
    let retryAfter: number | undefined;
    let rateLimited = false;

    const ip = ctx.ip ? String(ctx.ip).split(',')[0]?.trim() ?? null : null;

    // 1. Perimeter blocks.
    if (ip && this.blockedIps().has(ip)) {
      signals.push({ type: 'blocked_ip', severity: 100, detail: 'IP is on the deny list' });
    }

    // 2. Action rate limits.
    for (const rule of RATE_LIMITS[ctx.action] ?? []) {
      const value =
        rule.scope === 'phone'
          ? ctx.phone
          : rule.scope === 'ip'
            ? ip
            : rule.scope === 'device'
              ? ctx.deviceId
              : ctx.userId;
      if (!value) continue;
      const result = this.hit(ctx.action, `${rule.scope}:${value}`, rule.limit, rule.windowMs);
      if (!result.allowed) {
        rateLimited = true;
        retryAfter = Math.max(retryAfter ?? 0, result.retryAfter);
        signals.push({
          type: 'rate_limited',
          severity: 60,
          detail: `${ctx.action} exceeded ${rule.limit} attempts per ${Math.round(rule.windowMs / 60000)}m for ${rule.scope}`,
        });
      }
    }

    // 3. Client fingerprint quality.
    if (!ctx.deviceId) {
      signals.push({ type: 'missing_device_id', severity: 8, detail: 'Request did not include a device id' });
    }
    if (!ctx.userAgent) {
      signals.push({ type: 'missing_user_agent', severity: 8, detail: 'Request did not include a user agent' });
    } else if (SUSPICIOUS_UA.test(ctx.userAgent)) {
      signals.push({ type: 'suspicious_user_agent', severity: 20, detail: 'Automation-style user agent' });
    }

    const isAuthAttempt = ctx.action === 'login' || ctx.action === 'phone_login';

    if (!ctx.isNewUser) {
      // 4. Device novelty.
      const devices = ctx.userId ? this.knownDevices(ctx.userId) : new Map<string, number>();
      const isNewDevice = Boolean(ctx.deviceId && devices.size > 0 && !devices.has(ctx.deviceId!));
      if (ctx.deviceId && devices.size > 0 && !devices.has(ctx.deviceId)) {
        signals.push({ type: 'new_device', severity: 25, detail: 'Device has not been seen for this account' });
      }

      // 5. Device shared across accounts (account farm signal).
      if (ctx.deviceId) {
        const users = this.deviceUsers.get(ctx.deviceId);
        if (users && users.size >= 3) {
          signals.push({
            type: 'device_fanout',
            severity: 20,
            detail: `Device has been used by ${users.size} accounts`,
          });
        }
      }

      // 6. IP novelty combined with a new device.
      if (ctx.userId && ip) {
        const ips = this.userIps.get(ctx.userId);
        if (isNewDevice && ips && ips.size > 0 && !ips.has(ip)) {
          signals.push({ type: 'new_ip', severity: 10, detail: 'New IP together with a new device' });
        }
      }

      // 7. One IP driving many accounts.
      if (ip) {
        const users = this.ipUsers.get(ip);
        if (users && users.size >= 5) {
          signals.push({
            type: 'ip_fanout',
            severity: 35,
            detail: `IP has been used by ${users.size} accounts recently`,
          });
        }
      }

      // 8. Recent credential failures.
      if (isAuthAttempt) {
        const userFailures = ctx.userId ? this.failureCount(`u:${ctx.userId}`) : 0;
        if (userFailures >= 3) {
          signals.push({
            type: 'recent_failures',
            severity: 30,
            detail: `${userFailures} failed attempts for this account in the last 15 minutes`,
          });
        }
        const ipFailures = ip ? this.failureCount(`ip:${ip}`) : 0;
        if (ipFailures >= 8) {
          signals.push({
            type: 'recent_failures',
            severity: 25,
            detail: `${ipFailures} failed attempts from this IP in the last 15 minutes`,
          });
        }
      }

      // 9. Phone already owned by another account.
      if (ctx.phone) {
        const binding = this.phones.findByPhone(ctx.phone);
        if (binding && ctx.userId && binding.userId !== ctx.userId) {
          signals.push({
            type: 'phone_reuse',
            severity: 40,
            detail: 'Phone number is bound to a different account',
          });
        }
      }
    }

    const score = Math.min(
      100,
      signals.reduce((total, signal) => total + signal.severity, 0),
    );

    let decision: RiskAssessment['decision'];
    if (rateLimited || score >= 80) decision = 'deny';
    else if (score >= 40) decision = 'challenge';
    else decision = 'allow';

    if (this.isStrict() && isAuthAttempt && decision === 'allow' && score >= 20) {
      decision = 'challenge';
    }

    const level: RiskLevel =
      score >= 70 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'medium' : 'low';

    const assessment: RiskAssessment = {
      decision,
      level,
      score,
      signals,
      reasons: Array.from(new Set(signals.map((s) => s.type))),
      ...(retryAfter ? { retryAfter } : {}),
    };

    this.recordEvent(ctx, assessment);
    return assessment;
  }

  private recordEvent(ctx: RiskContext, assessment: RiskAssessment) {
    const event: RiskEvent = {
      id: this.newId(),
      userId: ctx.userId ?? null,
      action: ctx.action,
      decision: assessment.decision,
      level: assessment.level,
      score: assessment.score,
      signals: assessment.signals,
      ipMasked: maskIp(ctx.ip),
      deviceId: ctx.deviceId ?? null,
      createdAt: new Date().toISOString(),
    };
    this.events.push(event);
    if (this.events.length > MAX_EVENTS) this.events.shift();
  }

  // ---------------------------------------------------------------- challenges

  hasBoundPhone(userId: string): boolean {
    return Boolean(this.phones.findByUserId(userId));
  }

  async createChallenge(
    userId: string,
    meta: RequestMeta,
    method: LoginMethod = 'password',
  ): Promise<{
    challengeToken: string;
    challengeType: 'sms';
    maskedPhone: string;
    expiresIn: number;
    debugCode?: string;
  }> {
    const binding = this.phones.findByUserId(userId);
    if (!binding) {
      throw new BadRequestException(
        'No verified phone number on this account. Bind a phone number and retry.',
      );
    }

    const sent = await this.sms.requestCode(binding.phone, 'login', undefined, { skipCooldown: true });
    const token = crypto.randomBytes(32).toString('hex');
    const now = Date.now();
    this.challenges.set(token, {
      token,
      userId,
      phone: binding.phone,
      meta,
      method,
      createdAt: now,
      expiresAt: now + CHALLENGE_TTL_MS,
      attempts: 0,
    });
    this.pruneChallenges(now);

    return {
      challengeToken: token,
      challengeType: 'sms',
      maskedPhone: sent.maskedPhone,
      expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000),
      ...(sent.debugCode ? { debugCode: sent.debugCode } : {}),
    };
  }

  private pruneChallenges(now: number) {
    for (const [token, record] of this.challenges.entries()) {
      if (record.expiresAt <= now) this.challenges.delete(token);
    }
  }

  verifyChallenge(token: string, code: string): { userId: string; meta: RequestMeta; method: LoginMethod } {
    const record = this.challenges.get(token);
    if (!record) throw new UnauthorizedException('Invalid or expired challenge');
    if (record.expiresAt <= Date.now()) {
      this.challenges.delete(token);
      throw new UnauthorizedException('Challenge expired; please sign in again');
    }
    if (record.attempts >= CHALLENGE_MAX_ATTEMPTS) {
      this.challenges.delete(token);
      throw new HttpException('Too many invalid challenge attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    try {
      this.sms.verifyCode(record.phone, 'login', code);
    } catch (err) {
      record.attempts += 1;
      throw err;
    }

    this.challenges.delete(token);
    return { userId: record.userId, meta: record.meta, method: record.method };
  }

  async resendChallenge(token: string): Promise<{ maskedPhone: string; expiresIn: number; debugCode?: string }> {
    const record = this.challenges.get(token);
    if (!record) throw new NotFoundException('Invalid or expired challenge');
    if (record.expiresAt <= Date.now()) {
      this.challenges.delete(token);
      throw new UnauthorizedException('Challenge expired; please sign in again');
    }

    const sent = await this.sms.requestCode(record.phone, 'login');
    record.expiresAt = Date.now() + CHALLENGE_TTL_MS;
    record.attempts = 0;

    return {
      maskedPhone: sent.maskedPhone,
      expiresIn: Math.floor(CHALLENGE_TTL_MS / 1000),
      ...(sent.debugCode ? { debugCode: sent.debugCode } : {}),
    };
  }

  // -------------------------------------------------------------- audit trail

  async recordLoginAudit(input: LoginAuditInput): Promise<LoginAuditEntry> {
    const entry: LoginAuditEntry = {
      id: this.newId(),
      userId: input.userId ?? null,
      method: input.method,
      result: input.result,
      reason: input.reason ?? null,
      ipMasked: maskIp(input.ip),
      userAgent: input.userAgent ?? null,
      deviceId: input.deviceId ?? null,
      riskLevel: input.risk.level,
      riskScore: input.risk.score,
      createdAt: new Date().toISOString(),
    };

    this.loginAudits.push(entry);
    if (this.loginAudits.length > MAX_AUDIT_ENTRIES) this.loginAudits.shift();

    // Best-effort durable copy for the admin audit screen.
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: entry.userId,
          action: `auth.login.${entry.result}`,
          targetType: 'session',
          targetId: null,
          details: {
            method: entry.method,
            reason: entry.reason,
            riskLevel: entry.riskLevel,
            riskScore: entry.riskScore,
            signals: input.risk.signals,
          } as any,
          metadata: { deviceId: entry.deviceId } as any,
          ip: input.ip ?? null,
          userAgent: entry.userAgent,
        },
      });
    } catch (err) {
      this.logger.debug(`login audit persistence skipped: ${(err as Error).message}`);
    }

    return entry;
  }

  listLoginAudit(userId: string, limit = 50): LoginAuditEntry[] {
    return this.loginAudits
      .filter((entry) => entry.userId === userId)
      .slice(-limit)
      .reverse();
  }

  listEvents(userId: string, limit = 50): RiskEvent[] {
    return this.events
      .filter((event) => event.userId === userId)
      .slice(-limit)
      .reverse();
  }
}
