import { Injectable, Logger } from '@nestjs/common';
import {
  IdVerificationInput,
  IdVerificationOutput,
  IdVerificationProvider,
} from './id-verification.provider.js';

/**
 * Tencent Cloud real-name verification adapter.
 *
 * Stub: expects `TENCENT_KYC_SECRET_ID` and `TENCENT_KYC_SECRET_KEY`. Real
 * integration should call the FaceID `IdCardVerification` API. The adapter
 * fails closed until that call exists.
 */
@Injectable()
export class TencentIdVerificationProvider implements IdVerificationProvider {
  readonly name = 'tencent' as const;
  private readonly logger = new Logger(TencentIdVerificationProvider.name);

  private readonly secretId = process.env.TENCENT_KYC_SECRET_ID || '';
  private readonly secretKey = process.env.TENCENT_KYC_SECRET_KEY || '';

  isConfigured(): boolean {
    return Boolean(this.secretId && this.secretKey);
  }

  async verify(input: IdVerificationInput): Promise<IdVerificationOutput> {
    if (!this.isConfigured()) {
      return {
        verified: false,
        provider: this.name,
        requestId: `tencent_unconfigured_${Date.now()}`,
        mode: 'stub',
        message: 'Tencent real-name verification is not configured',
      };
    }

    // TODO: call Tencent FaceID IdCardVerification with the configured credentials.
    this.logger.error('Tencent real-name verification SDK wiring missing; failing closed');
    return {
      verified: false,
      provider: this.name,
      requestId: `tencent_pending_${Date.now()}`,
      mode: 'live',
      message: 'Tencent real-name verification is not implemented on this deployment',
    };
  }
}
