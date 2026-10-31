import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth/auth.service.js';
import { RiskService } from '../risk/risk.service.js';
import { RequestMeta, RiskAssessment } from '../risk/risk.types.js';
import { SmsService } from '../sms/sms.service.js';
import { PhoneStore } from './phone.store.js';
import { isValidPhone, maskPhone, normalizePhone } from './phone.util.js';

export type PhonePurpose = 'login' | 'register' | 'bind' | 'unbind';

export interface PhoneStatus {
  bound: boolean;
  phone: string | null;
  maskedPhone: string | null;
  verifiedAt: string | null;
}

/**
 * SMS-code login/registration and phone binding.
 *
 * Verification codes are owned by `SmsService`; risk scoring, rate limits and
 * audit records are owned by `RiskService`. This service only coordinates the
 * three and never exposes raw phone numbers or human-readable account state
 * beyond what the caller needs.
 */
@Injectable()
export class PhoneService {
  constructor(
    private sms: SmsService,
    private risk: RiskService,
    private phones: PhoneStore,
    private auth: AuthService,
  ) {}

  private requirePhone(raw: string): string {
    const phone = normalizePhone(raw);
    if (!isValidPhone(phone)) {
      throw new BadRequestException('Invalid phone number');
    }
    return phone;
  }

  private safeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name ?? null,
      emailVerified: false,
    };
  }

  private ensureAllowed(assessment: RiskAssessment) {
    if (assessment.decision !== 'deny') return;
    if (assessment.reasons.includes('blocked_ip')) {
      throw new ForbiddenException('Requests from this network are blocked');
    }
    const retry = assessment.retryAfter ? ` Try again in ${assessment.retryAfter}s.` : '';
    throw new HttpException(`Too many requests.${retry}`.trim(), HttpStatus.TOO_MANY_REQUESTS);
  }

  private async audit(
    userId: string | null,
    method: 'phone',
    result: 'succeeded' | 'failed' | 'challenged' | 'blocked',
    assessment: RiskAssessment,
    meta: RequestMeta,
    reason?: string,
  ) {
    await this.risk.recordLoginAudit({
      userId,
      method,
      result,
      reason: reason ?? null,
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
      deviceId: meta.deviceId ?? null,
      risk: assessment,
    });
  }

  // ------------------------------------------------------------------- codes

  async sendCode(
    rawPhone: string,
    purpose: 'login' | 'register' | 'bind',
    channel: 'aliyun' | 'tencent' | undefined,
    meta: RequestMeta,
  ) {
    const phone = this.requirePhone(rawPhone);

    const assessment = await this.risk.assess({
      action: 'sms_send',
      phone,
      ip: meta.ip ?? null,
      deviceId: meta.deviceId ?? null,
      userAgent: meta.userAgent ?? null,
    });
    this.ensureAllowed(assessment);

    const sent = await this.sms.requestCode(phone, purpose, channel);
    return sent;
  }

  /** Send the unbind confirmation code to the number currently on file. */
  async sendUnbindCode(userId: string, meta: RequestMeta) {
    const binding = this.phones.findByUserId(userId);
    if (!binding) throw new NotFoundException('No phone number is bound to this account');

    const assessment = await this.risk.assess({
      action: 'sms_send',
      userId,
      phone: binding.phone,
      ip: meta.ip ?? null,
      deviceId: meta.deviceId ?? null,
      userAgent: meta.userAgent ?? null,
    });
    this.ensureAllowed(assessment);

    return this.sms.requestCode(binding.phone, 'unbind');
  }

  // ------------------------------------------------------------------- login

  async login(rawPhone: string, code: string, meta: RequestMeta) {
    const phone = this.requirePhone(rawPhone);

    try {
      this.sms.verifyCode(phone, 'login', code);
    } catch (err) {
      this.risk.recordFailure(null, meta.ip ?? null);
      await this.audit(null, 'phone', 'failed', this.neutralRisk(), meta, 'invalid_code');
      throw err;
    }

    const binding = this.phones.findByPhone(phone);
    if (!binding) {
      await this.audit(null, 'phone', 'failed', this.neutralRisk(), meta, 'phone_not_registered');
      throw new UnauthorizedException('This phone number is not registered');
    }

    const user = await this.auth.findUserById(binding.userId);
    if (!user) {
      this.phones.unbind(binding.userId);
      await this.audit(null, 'phone', 'failed', this.neutralRisk(), meta, 'account_missing');
      throw new UnauthorizedException('Account not found; please register again');
    }

    if (this.auth.isSuspended(user)) {
      await this.audit(user.id, 'phone', 'blocked', this.neutralRisk(), meta, 'account_suspended');
      throw new ForbiddenException('Account suspended');
    }

    const assessment = await this.risk.assess({
      action: 'phone_login',
      userId: user.id,
      phone,
      ip: meta.ip ?? null,
      deviceId: meta.deviceId ?? null,
      userAgent: meta.userAgent ?? null,
    });

    if (assessment.decision === 'deny') {
      await this.audit(user.id, 'phone', 'blocked', assessment, meta, assessment.reasons.join(','));
      this.ensureAllowed(assessment);
    }

    if (assessment.decision === 'challenge') {
      const challenge = await this.risk.createChallenge(user.id, meta, 'phone');
      await this.audit(user.id, 'phone', 'challenged', assessment, meta, 'risk_challenge');
      return {
        riskChallengeRequired: true as const,
        challengeToken: challenge.challengeToken,
        challengeType: challenge.challengeType,
        maskedPhone: challenge.maskedPhone,
        expiresIn: challenge.expiresIn,
        risk: assessment,
        user: this.safeUser(user),
        ...(challenge.debugCode ? { debugCode: challenge.debugCode } : {}),
      };
    }

    const tokens = await this.auth.issueSession(user, meta);
    await this.audit(user.id, 'phone', 'succeeded', assessment, meta);
    return {
      ...tokens,
      isNewUser: false,
      maskedPhone: maskPhone(phone),
      risk: assessment,
    };
  }

  // -------------------------------------------------------------- registration

  async register(rawPhone: string, code: string, name: string | undefined, meta: RequestMeta) {
    const phone = this.requirePhone(rawPhone);

    try {
      this.sms.verifyCode(phone, 'register', code);
    } catch (err) {
      this.risk.recordFailure(null, meta.ip ?? null);
      await this.audit(null, 'phone', 'failed', this.neutralRisk(), meta, 'invalid_code');
      throw err;
    }

    if (this.phones.findByPhone(phone)) {
      throw new ConflictException('This phone number is already registered');
    }

    const assessment = await this.risk.assess({
      action: 'phone_register',
      phone,
      ip: meta.ip ?? null,
      deviceId: meta.deviceId ?? null,
      userAgent: meta.userAgent ?? null,
      isNewUser: true,
    });
    this.ensureAllowed(assessment);

    const user = await this.auth.createPhoneUser(phone, name);
    this.phones.bind(user.id, phone);

    const tokens = await this.auth.issueSession(user, meta);
    await this.audit(user.id, 'phone', 'succeeded', assessment, meta, 'phone_registration');
    return {
      ...tokens,
      isNewUser: true,
      maskedPhone: maskPhone(phone),
      risk: assessment,
    };
  }

  // ------------------------------------------------------------------- binding

  async bind(userId: string, rawPhone: string, code: string, meta: RequestMeta): Promise<PhoneStatus> {
    const phone = this.requirePhone(rawPhone);

    try {
      this.sms.verifyCode(phone, 'bind', code);
    } catch (err) {
      this.risk.recordFailure(userId, meta.ip ?? null);
      throw err;
    }

    if (this.phones.isBoundToOther(phone, userId)) {
      throw new ConflictException('This phone number is bound to another account');
    }

    const current = this.phones.findByUserId(userId);
    if (current && current.phone !== phone) {
      throw new ConflictException('Unbind your current phone number first');
    }

    const assessment = await this.risk.assess({
      action: 'bind_phone',
      userId,
      phone,
      ip: meta.ip ?? null,
      deviceId: meta.deviceId ?? null,
      userAgent: meta.userAgent ?? null,
    });
    this.ensureAllowed(assessment);

    this.phones.bind(userId, phone);
    return this.status(userId);
  }

  async unbind(userId: string, code: string, meta: RequestMeta): Promise<{ success: boolean }> {
    const binding = this.phones.findByUserId(userId);
    if (!binding) throw new NotFoundException('No phone number is bound to this account');

    this.sms.verifyCode(binding.phone, 'unbind', code);

    const assessment = await this.risk.assess({
      action: 'unbind_phone',
      userId,
      phone: binding.phone,
      ip: meta.ip ?? null,
      deviceId: meta.deviceId ?? null,
      userAgent: meta.userAgent ?? null,
    });
    this.ensureAllowed(assessment);

    this.phones.unbind(userId);
    return { success: true };
  }

  status(userId: string): PhoneStatus {
    const binding = this.phones.findByUserId(userId);
    if (!binding) {
      return { bound: false, phone: null, maskedPhone: null, verifiedAt: null };
    }
    const masked = maskPhone(binding.phone);
    return {
      bound: true,
      phone: masked,
      maskedPhone: masked,
      verifiedAt: binding.verifiedAt.toISOString(),
    };
  }

  private neutralRisk(): RiskAssessment {
    return { decision: 'allow', level: 'low', score: 0, signals: [], reasons: [] };
  }
}
