import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PhoneStore } from '../phone/phone.store.js';
import { RiskService } from '../risk/risk.service.js';
import { LoginAuditResult, LoginMethod, RequestMeta, RiskAssessment } from '../risk/risk.types.js';
import {
  generateSecret,
  otpauthUrl,
  verifyTotp,
} from './utils/totp.js';

const NEUTRAL_RISK: RiskAssessment = {
  decision: 'allow',
  level: 'low',
  score: 0,
  signals: [],
  reasons: [],
};

interface SessionRecord {
  id: string;
  userId: string;
  refreshToken: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}

interface TokenRecord {
  userId: string;
  expiresAt: Date;
}

interface ProfileExtras {
  avatarUrl?: string | null;
  bio?: string | null;
  locale?: string;
}

@Injectable()
export class AuthService {
  private sessions = new Map<string, SessionRecord>();
  private verificationTokens = new Map<string, TokenRecord>();
  private resetTokens = new Map<string, TokenRecord>();
  private mfaPending = new Map<string, string>(); // userId -> secret
  private mfaEnabled = new Map<string, string>(); // userId -> secret
  private mfaLoginTokens = new Map<string, TokenRecord>();
  private verifiedUsers = new Set<string>();
  private profileExtras = new Map<string, ProfileExtras>();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private risk: RiskService,
    private phones: PhoneStore,
  ) {}

  private jwtSecret() {
    return this.config.get<string>('JWT_SECRET') || 'change-me';
  }

  private accessExpiresIn() {
    return this.config.get<string>('JWT_EXPIRES_IN') || '15m';
  }

  private refreshTtlMs() {
    return 7 * 24 * 60 * 60 * 1000;
  }

  private newId() {
    return crypto.randomUUID();
  }

  private newToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      emailVerified: this.verifiedUsers.has(user.id),
      mfaEnabled: this.mfaEnabled.has(user.id),
    };
  }

  private async issueTokens(user: any, meta?: RequestMeta) {
    const sessionId = this.newId();
    const refreshToken = this.newToken();
    const session: SessionRecord = {
      id: sessionId,
      userId: user.id,
      refreshToken,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.refreshTtlMs()),
      userAgent: meta?.userAgent ?? null,
      ipAddress: meta?.ip ?? null,
    };
    this.sessions.set(sessionId, session);

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, sid: sessionId },
      { secret: this.jwtSecret(), expiresIn: this.accessExpiresIn() as any },
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
      user: this.sanitizeUser(user),
    };
  }

  /**
   * Grants the free-trial credits on first sign-up so new accounts can
   * generate once before paying. Amount is configurable via FREE_TRIAL_CREDITS.
   * Idempotent: a `signup_bonus` transaction is only ever written once per account.
   */
  private async grantSignupCredits(userId: string) {
    const amount = Number(process.env.FREE_TRIAL_CREDITS ?? 50);
    if (!Number.isFinite(amount) || amount <= 0) return;

    await this.prisma.$transaction(async (tx) => {
      const account = await tx.creditAccount.upsert({
        where: { userId },
        update: {},
        create: { userId, balance: 0 },
      });

      const alreadyGranted = await tx.transaction.findFirst({
        where: { accountId: account.id, reason: 'signup_bonus' },
        select: { id: true },
      });
      if (alreadyGranted) return;

      const newBalance = Number(account.balance) + amount;
      await tx.creditAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });
      await tx.transaction.create({
        data: {
          accountId: account.id,
          type: 'CREDIT',
          amount,
          reason: 'signup_bonus',
          balanceAfter: newBalance,
        },
      });
    });
  }

  async register(email: string, password: string, name?: string, meta?: RequestMeta) {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        creditAccount: { create: { balance: 0 } },
      },
    });

    await this.grantSignupCredits(user.id);

    const verificationToken = this.newToken();
    this.verificationTokens.set(verificationToken, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const tokens = await this.issueTokens(user, meta);
    await this.risk.remember({ action: 'login', userId: user.id, ip: meta?.ip, deviceId: meta?.deviceId });
    await this.audit(user.id, 'password', 'succeeded', NEUTRAL_RISK, meta);
    return { ...tokens, verificationToken };
  }

  async login(email: string, password: string, mfaCode?: string, meta?: RequestMeta) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      this.risk.recordFailure(null, meta?.ip);
      await this.audit(null, 'password', 'failed', NEUTRAL_RISK, meta, 'unknown_account');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.isSuspended(user)) {
      await this.audit(user.id, 'password', 'blocked', NEUTRAL_RISK, meta, 'account_suspended');
      throw new ForbiddenException('Account suspended');
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      this.risk.recordFailure(user.id, meta?.ip);
      const failed = await this.risk.assess({
        action: 'login',
        userId: user.id,
        email,
        ip: meta?.ip,
        deviceId: meta?.deviceId,
        userAgent: meta?.userAgent,
      });
      await this.audit(user.id, 'password', 'failed', failed, meta, 'invalid_credentials');
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.mfaEnabled.has(user.id)) {
      if (!mfaCode) {
        const mfaToken = this.newToken();
        this.mfaLoginTokens.set(mfaToken, {
          userId: user.id,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        });
        return { mfaRequired: true, mfaToken, user: this.sanitizeUser(user) };
      }
      const secret = this.mfaEnabled.get(user.id)!;
      if (!verifyTotp(secret, mfaCode)) {
        this.risk.recordFailure(user.id, meta?.ip);
        await this.audit(user.id, 'password', 'failed', NEUTRAL_RISK, meta, 'invalid_mfa');
        throw new UnauthorizedException('Invalid MFA code');
      }
    }

    const assessment = await this.risk.assess({
      action: 'login',
      userId: user.id,
      email,
      ip: meta?.ip,
      deviceId: meta?.deviceId,
      userAgent: meta?.userAgent,
    });

    if (assessment.decision === 'deny') {
      await this.audit(user.id, 'password', 'blocked', assessment, meta, assessment.reasons.join(',') || 'risk_denied');
      throw new UnauthorizedException(
        'Login blocked by risk control. Please try again later.',
      );
    }

    if (assessment.decision === 'challenge') {
      if (!this.risk.hasBoundPhone(user.id)) {
        await this.audit(user.id, 'password', 'blocked', assessment, meta, 'verification_requires_phone');
        throw new UnauthorizedException(
          'Suspicious login detected. Bind a phone number to this account to complete verification.',
        );
      }
      const challenge = await this.risk.createChallenge(user.id, meta ?? {}, 'password');
      await this.audit(user.id, 'password', 'challenged', assessment, meta, 'risk_challenge');
      return {
        riskChallengeRequired: true as const,
        challengeToken: challenge.challengeToken,
        challengeType: challenge.challengeType,
        maskedPhone: challenge.maskedPhone,
        expiresIn: challenge.expiresIn,
        risk: assessment,
        user: this.sanitizeUser(user),
        ...(challenge.debugCode ? { debugCode: challenge.debugCode } : {}),
      };
    }

    const tokens = await this.issueTokens(user, meta);
    this.onSuccessfulAuth(user.id, meta);
    await this.audit(user.id, 'password', 'succeeded', assessment, meta);
    return { ...tokens, risk: assessment };
  }

  /** Public token minting for flows owned by other modules (phone auth). */
  async issueSession(user: any, meta?: RequestMeta) {
    const tokens = await this.issueTokens(user, meta);
    this.onSuccessfulAuth(user.id, meta);
    return tokens;
  }

  async findUserById(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId } });
  }

  /**
   * Complete a suspicious-login challenge: the SMS code proves control of the
   * bound phone, then a fresh session is minted.
   */
  async completeRiskChallenge(challengeToken: string, code: string, meta?: RequestMeta) {
    const result = this.risk.verifyChallenge(challengeToken, code);
    const user = await this.prisma.user.findUnique({ where: { id: result.userId } });
    if (!user) throw new UnauthorizedException('User not found');
    if (this.isSuspended(user)) {
      await this.audit(user.id, result.method, 'blocked', NEUTRAL_RISK, meta, 'account_suspended');
      throw new ForbiddenException('Account suspended');
    }

    const merged: RequestMeta = {
      ip: meta?.ip ?? result.meta.ip ?? null,
      userAgent: meta?.userAgent ?? result.meta.userAgent ?? null,
      deviceId: meta?.deviceId ?? result.meta.deviceId ?? null,
    };
    const tokens = await this.issueTokens(user, merged);
    this.onSuccessfulAuth(user.id, merged);
    await this.audit(
      user.id,
      result.method,
      'succeeded',
      { ...NEUTRAL_RISK, reasons: ['challenge_passed'] },
      merged,
    );
    return { ...tokens, risk: { ...NEUTRAL_RISK, reasons: ['challenge_passed'] } };
  }

  /**
   * Phone-only accounts need an email-shaped identity because the user table
   * keys sessions off it. The synthetic address is deterministic, so repeat
   * logins resolve to the same account.
   */
  async createPhoneUser(phone: string, name?: string) {
    const email = `phone.${phone.replace(/\D/g, '')}@phone.local`;
    let user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      const passwordHash = await bcrypt.hash(this.newToken(), 10);
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          name: name ?? null,
          creditAccount: { create: { balance: 0 } },
        },
      });
      await this.grantSignupCredits(user.id);
    } else if (name && !user.name) {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { name } });
    }
    return user;
  }

  isSuspended(user: any): boolean {
    return Boolean(user?.isBanned || user?.banned);
  }

  private onSuccessfulAuth(userId: string, meta?: RequestMeta) {
    this.risk.clearFailures(userId, meta?.ip);
    this.risk.remember({ action: 'login', userId, ip: meta?.ip, deviceId: meta?.deviceId });
  }

  private async audit(
    userId: string | null,
    method: LoginMethod,
    result: LoginAuditResult,
    risk: RiskAssessment,
    meta?: RequestMeta,
    reason?: string,
  ) {
    await this.risk.recordLoginAudit({
      userId,
      method,
      result,
      reason: reason ?? null,
      ip: meta?.ip ?? null,
      userAgent: meta?.userAgent ?? null,
      deviceId: meta?.deviceId ?? null,
      risk,
    });
  }

  async verifyMfa(mfaToken: string, code: string, meta?: RequestMeta) {
    const rec = this.mfaLoginTokens.get(mfaToken);
    if (!rec || rec.expiresAt < new Date()) {
      this.mfaLoginTokens.delete(mfaToken);
      throw new UnauthorizedException('Invalid or expired MFA token');
    }
    const user = await this.prisma.user.findUnique({ where: { id: rec.userId } });
    if (!user) throw new UnauthorizedException('User not found');
    const secret = this.mfaEnabled.get(user.id);
    if (!secret || !verifyTotp(secret, code)) {
      throw new UnauthorizedException('Invalid MFA code');
    }
    this.mfaLoginTokens.delete(mfaToken);
    const tokens = await this.issueSession(user, meta);
    await this.audit(user.id, 'mfa', 'succeeded', NEUTRAL_RISK, meta);
    return tokens;
  }

  async refresh(refreshToken: string, meta?: RequestMeta) {
    let session: SessionRecord | undefined;
    for (const s of this.sessions.values()) {
      if (s.refreshToken === refreshToken) {
        session = s;
        break;
      }
    }
    if (!session) throw new UnauthorizedException('Invalid refresh token');
    if (session.expiresAt < new Date()) {
      this.sessions.delete(session.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) throw new UnauthorizedException('User not found');

    // rotate
    session.refreshToken = this.newToken();
    session.expiresAt = new Date(Date.now() + this.refreshTtlMs());

    const accessToken = this.jwt.sign(
      { sub: user.id, email: user.email, sid: session.id },
      { secret: this.jwtSecret(), expiresIn: this.accessExpiresIn() as any },
    );

    return {
      accessToken,
      refreshToken: session.refreshToken,
      sessionId: session.id,
      user: this.sanitizeUser(user),
    };
  }

  async logout(refreshToken?: string, sessionId?: string) {
    if (refreshToken) {
      for (const [id, s] of this.sessions.entries()) {
        if (s.refreshToken === refreshToken) this.sessions.delete(id);
      }
    }
    if (sessionId) this.sessions.delete(sessionId);
    return { success: true };
  }

  async logoutAll(userId: string) {
    for (const [id, s] of this.sessions.entries()) {
      if (s.userId === userId) this.sessions.delete(id);
    }
    return { success: true };
  }

  async verifyEmail(token: string) {
    const rec = this.verificationTokens.get(token);
    if (!rec || rec.expiresAt < new Date()) {
      this.verificationTokens.delete(token);
      throw new BadRequestException('Invalid or expired verification token');
    }
    this.verifiedUsers.add(rec.userId);
    this.verificationTokens.delete(token);
    return { success: true, userId: rec.userId };
  }

  async requestPasswordReset(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // do not reveal
      return { success: true };
    }
    const token = this.newToken();
    this.resetTokens.set(token, {
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    return { success: true, resetToken: token };
  }

  async resetPassword(token: string, newPassword: string) {
    const rec = this.resetTokens.get(token);
    if (!rec || rec.expiresAt < new Date()) {
      this.resetTokens.delete(token);
      throw new BadRequestException('Invalid or expired reset token');
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: rec.userId },
      data: { passwordHash },
    });
    this.resetTokens.delete(token);
    await this.logoutAll(rec.userId);
    return { success: true };
  }

  // MFA
  setupMfa(userId: string, account: string) {
    const secret = generateSecret();
    this.mfaPending.set(userId, secret);
    return { secret, otpauthUrl: otpauthUrl(secret, account) };
  }

  enableMfa(userId: string, code: string) {
    const secret = this.mfaPending.get(userId);
    if (!secret) throw new BadRequestException('MFA setup not started');
    if (!verifyTotp(secret, code)) throw new BadRequestException('Invalid MFA code');
    this.mfaEnabled.set(userId, secret);
    this.mfaPending.delete(userId);
    return { success: true, mfaEnabled: true };
  }

  disableMfa(userId: string, code: string) {
    const secret = this.mfaEnabled.get(userId);
    if (!secret) throw new BadRequestException('MFA not enabled');
    if (!verifyTotp(secret, code)) throw new BadRequestException('Invalid MFA code');
    this.mfaEnabled.delete(userId);
    return { success: true, mfaEnabled: false };
  }

  getMfaStatus(userId: string) {
    return { mfaEnabled: this.mfaEnabled.has(userId) };
  }

  // Profile
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const extras = this.profileExtras.get(userId) || {};
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      avatarUrl: extras.avatarUrl ?? null,
      bio: extras.bio ?? null,
      locale: extras.locale ?? 'en',
      emailVerified: this.verifiedUsers.has(user.id),
      mfaEnabled: this.mfaEnabled.has(user.id),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateProfile(userId: string, data: { name?: string; avatarUrl?: string | null; bio?: string | null; locale?: string }) {
    if (data.name !== undefined) {
      await this.prisma.user.update({ where: { id: userId }, data: { name: data.name } });
    }
    const extras = this.profileExtras.get(userId) || {};
    if (data.avatarUrl !== undefined) extras.avatarUrl = data.avatarUrl;
    if (data.bio !== undefined) extras.bio = data.bio;
    if (data.locale !== undefined) extras.locale = data.locale;
    this.profileExtras.set(userId, extras);
    return this.getProfile(userId);
  }

  // Sessions
  listSessions(userId: string, currentSessionId?: string) {
    const out: any[] = [];
    for (const s of this.sessions.values()) {
      if (s.userId !== userId) continue;
      out.push({
        id: s.id,
        userId: s.userId,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
        current: s.id === currentSessionId,
      });
    }
    return out;
  }

  revokeSession(userId: string, sessionId: string) {
    const s = this.sessions.get(sessionId);
    if (!s || s.userId !== userId) throw new NotFoundException('Session not found');
    this.sessions.delete(sessionId);
    return { success: true };
  }

  // OAuth stubs
  async oauthLogin(provider: string, email?: string, name?: string, meta?: RequestMeta) {
    const addr = email || `${provider}-user@example.com`;
    let user = await this.prisma.user.findUnique({ where: { email: addr } });
    if (!user) {
      const passwordHash = await bcrypt.hash(this.newToken(), 10);
      user = await this.prisma.user.create({
        data: {
          email: addr,
          passwordHash,
          name: name || `${provider} user`,
          creditAccount: { create: { balance: 0 } },
        },
      });
      await this.grantSignupCredits(user.id);
    }
    const tokens = await this.issueSession(user, meta);
    await this.audit(user.id, 'oauth', 'succeeded', NEUTRAL_RISK, meta, provider);
    return tokens;
  }

  oauthAuthorizationUrl(provider: string) {
    const clientId =
      provider === 'google'
        ? this.config.get<string>('GOOGLE_CLIENT_ID')
        : this.config.get<string>('GITHUB_CLIENT_ID');
    if (!clientId) return null;
    if (provider === 'google') {
      return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
        this.config.get<string>('OAUTH_REDIRECT_URI') || 'http://localhost:4000/auth/oauth/google/callback',
      )}&response_type=code&scope=openid%20email%20profile`;
    }
    return `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      this.config.get<string>('OAUTH_REDIRECT_URI') || 'http://localhost:4000/auth/oauth/github/callback',
    )}&scope=read:user%20user:email`;
  }
}
