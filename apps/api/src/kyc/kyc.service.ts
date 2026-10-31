import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { RiskService } from '../risk/risk.service.js';
import { RequestMeta, RiskAssessment } from '../risk/risk.types.js';
import {
  isValidRealName,
  maskIdNumber,
  maskRealName,
  parseIdCard,
} from './id-card.util.js';
import {
  IdVerificationProvider,
} from './providers/id-verification.provider.js';
import { AliyunIdVerificationProvider } from './providers/aliyun-idverify.provider.js';
import { StubIdVerificationProvider } from './providers/stub-idverify.provider.js';
import { TencentIdVerificationProvider } from './providers/tencent-idverify.provider.js';

export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type KycProviderName = 'stub' | 'aliyun' | 'tencent';
export type KycGender = 'male' | 'female' | 'unknown';

export interface KycRecord {
  id: string;
  userId: string;
  status: KycStatus;
  documentType: 'id_card';
  maskedRealName: string;
  maskedIdNumber: string;
  provider: KycProviderName;
  providerRequestId: string | null;
  gender: KycGender;
  age: number | null;
  isAdult: boolean;
  regionCode: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
}

interface InternalRecord extends Omit<KycRecord, 'submittedAt' | 'verifiedAt'> {
  submittedAt: Date;
  verifiedAt: Date | null;
  idHash: string;
}

export interface KycSubmitInput {
  realName: string;
  idNumber: string;
  documentType?: 'id_card';
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
}

/**
 * Real-name verification orchestration.
 *
 * The ID number is validated locally (checksum, date, region), hashed with a
 * server-side pepper for duplicate detection, and only the masked form is kept.
 * Actual name/ID matching is delegated to a pluggable provider adapter.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly records = new Map<string, InternalRecord>();
  private readonly idOwners = new Map<string, string>();
  private readonly providers: Record<KycProviderName, IdVerificationProvider>;

  constructor(
    private prisma: PrismaService,
    private risk: RiskService,
    stub: StubIdVerificationProvider,
    aliyun: AliyunIdVerificationProvider,
    tencent: TencentIdVerificationProvider,
  ) {
    this.providers = { stub, aliyun, tencent };
  }

  private pepper(): string {
    return process.env.KYC_ID_PEPPER || process.env.JWT_SECRET || 'vidforge-kyc';
  }

  private hashId(idNumber: string): string {
    return crypto.createHash('sha256').update(`${idNumber}:${this.pepper()}`).digest('hex');
  }

  private provider(): IdVerificationProvider {
    const requested = (process.env.KYC_PROVIDER || 'stub') as KycProviderName;
    return this.providers[requested] ?? this.providers.stub;
  }

  private sanitize(record: InternalRecord | undefined): KycRecord | null {
    if (!record) return null;
    return {
      id: record.id,
      userId: record.userId,
      status: record.status,
      documentType: record.documentType,
      maskedRealName: record.maskedRealName,
      maskedIdNumber: record.maskedIdNumber,
      provider: record.provider,
      providerRequestId: record.providerRequestId,
      gender: record.gender,
      age: record.age,
      isAdult: record.isAdult,
      regionCode: record.regionCode,
      submittedAt: record.submittedAt.toISOString(),
      verifiedAt: record.verifiedAt ? record.verifiedAt.toISOString() : null,
      rejectionReason: record.rejectionReason,
    };
  }

  status(userId: string): { status: KycStatus; record: KycRecord | null } {
    const record = this.records.get(userId);
    return { status: record?.status ?? 'unverified', record: this.sanitize(record) };
  }

  private ensureAllowed(assessment: RiskAssessment) {
    if (assessment.decision !== 'deny') return;
    if (assessment.reasons.includes('blocked_ip')) {
      throw new ForbiddenException('Requests from this network are blocked');
    }
    const retry = assessment.retryAfter ? ` Try again in ${assessment.retryAfter}s.` : '';
    throw new HttpException(`Too many verification attempts.${retry}`.trim(), HttpStatus.TOO_MANY_REQUESTS);
  }

  async submit(userId: string, input: KycSubmitInput, meta: RequestMeta): Promise<KycRecord> {
    const assessment = await this.risk.assess({
      action: 'kyc_submit',
      userId,
      ip: meta.ip ?? null,
      deviceId: meta.deviceId ?? null,
      userAgent: meta.userAgent ?? null,
    });
    this.ensureAllowed(assessment);

    const existing = this.records.get(userId);
    if (existing?.status === 'verified') {
      throw new ConflictException('Identity is already verified');
    }

    const realName = String(input.realName ?? '').trim();
    const idNumber = String(input.idNumber ?? '').trim().toUpperCase();

    if (!isValidRealName(realName)) {
      throw new BadRequestException('Real name format is invalid');
    }

    const parsed = parseIdCard(idNumber);
    if (!parsed.valid) {
      throw new BadRequestException(parsed.reason || 'ID number is invalid');
    }

    const idHash = this.hashId(idNumber);
    const owner = this.idOwners.get(idHash);
    if (owner && owner !== userId) {
      throw new ConflictException('This ID number is already verified on another account');
    }

    const provider = this.provider();
    let result;
    try {
      result = await provider.verify({ userId, realName, idNumber });
    } catch (err) {
      this.logger.error(`KYC provider ${provider.name} failed: ${(err as Error).message}`);
      throw new HttpException(
        'Real-name verification service is temporarily unavailable',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    const now = new Date();
    const verified = result.verified;
    const record: InternalRecord = {
      id: crypto.randomUUID(),
      userId,
      status: verified ? 'verified' : 'rejected',
      documentType: input.documentType ?? 'id_card',
      maskedRealName: maskRealName(realName),
      maskedIdNumber: maskIdNumber(idNumber),
      provider: result.provider,
      providerRequestId: result.requestId ?? null,
      gender: parsed.gender,
      age: parsed.age,
      isAdult: parsed.isAdult,
      regionCode: parsed.regionCode,
      submittedAt: now,
      verifiedAt: verified ? now : null,
      rejectionReason: verified ? null : result.message || 'Name and ID number do not match',
      idHash,
    };

    this.records.set(userId, record);
    if (verified) this.idOwners.set(idHash, userId);

    await this.audit(userId, verified ? 'kyc.verified' : 'kyc.rejected', {
      provider: result.provider,
      mode: result.mode,
      providerRequestId: result.requestId,
      reason: verified ? null : record.rejectionReason,
    }, meta);

    const sanitized = this.sanitize(record);
    if (!sanitized) {
      throw new HttpException('Failed to store verification record', HttpStatus.INTERNAL_SERVER_ERROR);
    }
    return sanitized;
  }

  private async audit(
    userId: string,
    action: string,
    details: Record<string, unknown>,
    meta: RequestMeta,
  ) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId,
          action,
          targetType: 'kyc',
          targetId: null,
          details: details as any,
          metadata: { deviceId: meta.deviceId ?? null } as any,
          ip: meta.ip ?? null,
          userAgent: meta.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.debug(`KYC audit persistence skipped: ${(err as Error).message}`);
    }
  }
}
