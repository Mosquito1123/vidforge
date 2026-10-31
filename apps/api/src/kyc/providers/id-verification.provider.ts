export type KycProviderName = 'stub' | 'aliyun' | 'tencent';

export interface IdVerificationInput {
  userId: string;
  realName: string;
  idNumber: string;
}

export interface IdVerificationOutput {
  verified: boolean;
  provider: KycProviderName;
  requestId: string;
  mode: 'stub' | 'live';
  message?: string;
}

/**
 * Real-name / ID-match adapter contract.
 *
 * Implementations must fail closed: any ambiguity or configuration problem
 * returns `verified: false` rather than fabricating a success.
 */
export interface IdVerificationProvider {
  readonly name: KycProviderName;
  isConfigured(): boolean;
  verify(input: IdVerificationInput): Promise<IdVerificationOutput>;
}
