/**
 * Real-name verification (KYC) contracts.
 *
 * The API never returns the full ID number or the unmasked legal name:
 * only masked representations plus derived (non-identifying) attributes.
 */

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export type KycDocumentType = "id_card";

export type KycProviderName = "stub" | "aliyun" | "tencent";

export type KycGender = "male" | "female" | "unknown";

export interface KycSubmitRequest {
  realName: string;
  idNumber: string;
  documentType?: KycDocumentType;
  /** Optional uploaded asset URLs (front/back of the ID card). */
  idCardFrontUrl?: string | null;
  idCardBackUrl?: string | null;
}

export interface KycRecord {
  id: string;
  userId: string;
  status: KycStatus;
  documentType: KycDocumentType;
  /** e.g. `张**` or `J***n`. */
  maskedRealName: string;
  /** e.g. `110***********1234`. */
  maskedIdNumber: string;
  provider: KycProviderName;
  /** Provider-side request id, useful for support tickets. */
  providerRequestId: string | null;
  /** Derived, non-identifying attributes. */
  gender: KycGender;
  age: number | null;
  isAdult: boolean;
  regionCode: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
}

export interface KycStatusResponse {
  status: KycStatus;
  record: KycRecord | null;
}

export interface KycProviderResult {
  verified: boolean;
  provider: KycProviderName;
  requestId: string;
  mode: "stub" | "live";
  message?: string;
}
