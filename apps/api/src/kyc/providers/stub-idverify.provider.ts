import { Injectable, Logger } from '@nestjs/common';
import {
  IdVerificationInput,
  IdVerificationOutput,
  IdVerificationProvider,
} from './id-verification.provider.js';

/**
 * Local stub provider.
 *
 * It accepts the ID only after the structural checksum/date validation in
 * `KycService` passed, and assumes the name matches. It exists so development
 * and tests can exercise the full KYC flow without vendor credentials.
 */
@Injectable()
export class StubIdVerificationProvider implements IdVerificationProvider {
  readonly name = 'stub' as const;
  private readonly logger = new Logger(StubIdVerificationProvider.name);

  isConfigured(): boolean {
    return process.env.NODE_ENV !== 'production' || process.env.KYC_ALLOW_STUB === 'true';
  }

  async verify(input: IdVerificationInput): Promise<IdVerificationOutput> {
    this.logger.warn(`KYC stub verification accepted for user ${input.userId}`);
    return {
      verified: true,
      provider: this.name,
      requestId: `stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      mode: 'stub',
      message: 'Stub provider: checksum passed, name/ID match assumed',
    };
  }
}
