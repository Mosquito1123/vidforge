import { Injectable, Logger } from '@nestjs/common';
import {
  IdVerificationInput,
  IdVerificationOutput,
  IdVerificationProvider,
} from './id-verification.provider.js';

/**
 * Aliyun real-name verification (二要素/三要素) adapter.
 *
 * Stub: expects `ALIYUN_KYC_ACCESS_KEY_ID`, `ALIYUN_KYC_ACCESS_KEY_SECRET` and
 * `ALIYUN_KYC_ENDPOINT`. Real integration should call the Cloud Auth
 * `Id2MetaVerify` / `Id3MetaVerify` API. Until that call is implemented the
 * adapter fails closed so a configured production deployment cannot silently
 * approve unverified identities.
 */
@Injectable()
export class AliyunIdVerificationProvider implements IdVerificationProvider {
  readonly name = 'aliyun' as const;
  private readonly logger = new Logger(AliyunIdVerificationProvider.name);

  private readonly accessKeyId = process.env.ALIYUN_KYC_ACCESS_KEY_ID || '';
  private readonly accessKeySecret = process.env.ALIYUN_KYC_ACCESS_KEY_SECRET || '';

  isConfigured(): boolean {
    return Boolean(this.accessKeyId && this.accessKeySecret);
  }

  async verify(input: IdVerificationInput): Promise<IdVerificationOutput> {
    if (!this.isConfigured()) {
      return {
        verified: false,
        provider: this.name,
        requestId: `aliyun_unconfigured_${Date.now()}`,
        mode: 'stub',
        message: 'Aliyun real-name verification is not configured',
      };
    }

    // TODO: call Aliyun Cloud Auth Id2MetaVerify with the configured credentials.
    this.logger.error('Aliyun real-name verification SDK wiring missing; failing closed');
    return {
      verified: false,
      provider: this.name,
      requestId: `aliyun_pending_${Date.now()}`,
      mode: 'live',
      message: 'Aliyun real-name verification is not implemented on this deployment',
    };
  }
}
