import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { normalizePhone } from '../phone/phone.util.js';
import { AliyunSmsProvider } from './aliyun-sms.provider.js';
import { TencentSmsProvider } from './tencent-sms.provider.js';
import { SmsChannel, SmsProvider, SmsSendResult } from './sms.types.js';

export type SmsPurpose = 'login' | 'register' | 'bind' | 'unbind';

interface CodeRecord {
  phone: string;
  purpose: SmsPurpose;
  codeHash: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  requestId: string;
  channel: SmsChannel;
  stub: boolean;
}

export interface SmsCodeRequestResult {
  success: true;
  maskedPhone: string;
  channel: SmsChannel;
  expiresIn: number;
  retryAfter: number;
  debugCode?: string;
}

const CODE_TTL_SECONDS = 300;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_ATTEMPTS = 5;
const MAX_PER_PHONE_PER_HOUR = 10;

/**
 * Owns SMS code lifecycle (issue, cooldown, verify) and vendor selection.
 *
 * Codes are never stored in plaintext: only a salted SHA-256 digest is kept,
 * so a memory dump does not expose live login codes.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly codes = new Map<string, CodeRecord>();
  private readonly lastSentAt = new Map<string, number>();
  private readonly perPhoneWindow = new Map<string, number[]>();
  private readonly providers: Record<SmsChannel, SmsProvider>;

  constructor(aliyun: AliyunSmsProvider, tencent: TencentSmsProvider) {
    this.providers = { aliyun, tencent };
  }

  private defaultChannel(): SmsChannel {
    return process.env.SMS_PROVIDER === 'tencent' ? 'tencent' : 'aliyun';
  }

  private provider(channel?: SmsChannel): SmsProvider {
    return this.providers[channel ?? this.defaultChannel()];
  }

  /** Only expose the generated code for stub providers outside production. */
  private exposeDebugCode(stub: boolean): boolean {
    if (!stub) return false;
    if (process.env.SMS_EXPOSE_CODE === 'false') return false;
    return process.env.NODE_ENV !== 'production';
  }

  private pepper(): string {
    return process.env.SMS_CODE_PEPPER || process.env.JWT_SECRET || 'vidforge-sms';
  }

  private hash(phone: string, purpose: SmsPurpose, code: string): string {
    return crypto.createHash('sha256').update(`${phone}:${purpose}:${code}:${this.pepper()}`).digest('hex');
  }

  private generateCode(): string {
    return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  }

  private key(phone: string, purpose: SmsPurpose): string {
    return `${purpose}:${phone}`;
  }

  private pruneExpired(now: number) {
    for (const [key, record] of this.codes.entries()) {
      if (record.expiresAt.getTime() <= now) this.codes.delete(key);
    }
  }

  private enforceCooldown(phone: string, purpose: SmsPurpose, skipCooldown = false) {
    const now = Date.now();
    const key = this.key(phone, purpose);
    if (!skipCooldown) {
      const last = this.lastSentAt.get(key) ?? 0;
      const elapsed = Math.floor((now - last) / 1000);
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        throw new HttpException(
          `Please wait ${RESEND_COOLDOWN_SECONDS - elapsed}s before requesting another code`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    const window = (this.perPhoneWindow.get(phone) ?? []).filter(
      (ts) => now - ts < 60 * 60 * 1000,
    );
    if (window.length >= MAX_PER_PHONE_PER_HOUR) {
      this.perPhoneWindow.set(phone, window);
      throw new HttpException(
        'Too many verification codes requested for this phone number',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    window.push(now);
    this.perPhoneWindow.set(phone, window);
  }

  /** Masked number for display, without importing the phone module. */
  private mask(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.length <= 7) return `+${'*'.repeat(Math.max(digits.length, 1))}`;
    return `${phone.slice(0, 6)}****${digits.slice(-4)}`;
  }

  async requestCode(
    rawPhone: string,
    purpose: SmsPurpose,
    channel?: SmsChannel,
    options?: { skipCooldown?: boolean },
  ): Promise<SmsCodeRequestResult> {
    const phone = normalizePhone(rawPhone);
    if (!phone) throw new BadRequestException('Invalid phone number');

    const now = Date.now();
    this.pruneExpired(now);
    this.enforceCooldown(phone, purpose, options?.skipCooldown === true);

    const provider = this.provider(channel);
    if (!provider.isConfigured() && process.env.NODE_ENV === 'production' && process.env.SMS_ALLOW_STUB !== 'true') {
      throw new ServiceUnavailableException('SMS provider is not configured');
    }

    const code = this.generateCode();
    let send: SmsSendResult;
    try {
      send = await provider.send({ phone, code, purpose });
    } catch (err) {
      // The cooldown was consumed, release it so the user can retry.
      this.lastSentAt.delete(this.key(phone, purpose));
      this.logger.error(`SMS send failed for ${phone} via ${provider.channel}: ${(err as Error).message}`);
      throw new ServiceUnavailableException('Failed to send verification code');
    }

    this.codes.set(this.key(phone, purpose), {
      phone,
      purpose,
      codeHash: this.hash(phone, purpose, code),
      expiresAt: new Date(now + CODE_TTL_SECONDS * 1000),
      attempts: 0,
      createdAt: new Date(now),
      requestId: send.requestId,
      channel: send.provider,
      stub: send.stub,
    });
    this.lastSentAt.set(this.key(phone, purpose), now);

    return {
      success: true,
      maskedPhone: this.mask(phone),
      channel: send.provider,
      expiresIn: CODE_TTL_SECONDS,
      retryAfter: RESEND_COOLDOWN_SECONDS,
      ...(this.exposeDebugCode(send.stub) ? { debugCode: code } : {}),
    };
  }

  /**
   * Verify a code. Throws a 400 on failure and consumes the code on success.
   */
  verifyCode(rawPhone: string, purpose: SmsPurpose, code: string): void {
    const phone = normalizePhone(rawPhone);
    const key = this.key(phone, purpose);
    const record = this.codes.get(key);

    if (!record) throw new BadRequestException('Verification code expired or not requested');
    if (record.expiresAt.getTime() <= Date.now()) {
      this.codes.delete(key);
      throw new BadRequestException('Verification code expired');
    }
    if (record.attempts >= MAX_ATTEMPTS) {
      this.codes.delete(key);
      throw new HttpException('Too many invalid attempts', HttpStatus.TOO_MANY_REQUESTS);
    }

    const candidate = this.hash(phone, purpose, String(code ?? '').trim());
    const matches = crypto.timingSafeEqual(
      Buffer.from(candidate, 'hex'),
      Buffer.from(record.codeHash, 'hex'),
    );

    if (!matches) {
      record.attempts += 1;
      const remaining = MAX_ATTEMPTS - record.attempts;
      if (remaining <= 0) this.codes.delete(key);
      throw new BadRequestException(
        remaining > 0 ? `Invalid verification code (${remaining} attempts left)` : 'Too many invalid attempts',
      );
    }

    this.codes.delete(key);
  }

  /** Used by tests/ops to clear a stuck cooldown. */
  resetCooldown(phone: string, purpose?: SmsPurpose) {
    if (purpose) {
      this.lastSentAt.delete(this.key(normalizePhone(phone), purpose));
    } else {
      this.lastSentAt.delete(this.key(normalizePhone(phone), 'login'));
      this.lastSentAt.delete(this.key(normalizePhone(phone), 'register'));
      this.lastSentAt.delete(this.key(normalizePhone(phone), 'bind'));
      this.lastSentAt.delete(this.key(normalizePhone(phone), 'unbind'));
    }
  }
}
