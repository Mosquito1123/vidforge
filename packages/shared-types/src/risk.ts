/**
 * Login risk-control contracts: device/IP/rate-limit assessment,
 * suspicious-login challenges and login audit records.
 */

export type RiskAction =
  | "login"
  | "phone_login"
  | "phone_register"
  | "sms_send"
  | "bind_phone"
  | "unbind_phone"
  | "kyc_submit";

export type RiskDecision = "allow" | "challenge" | "deny";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type RiskSignalType =
  | "blocked_ip"
  | "missing_device_id"
  | "missing_user_agent"
  | "suspicious_user_agent"
  | "new_device"
  | "device_fanout"
  | "new_ip"
  | "ip_fanout"
  | "recent_failures"
  | "rate_limited"
  | "phone_reuse"
  | "challenge_unavailable";

export interface RiskSignal {
  type: RiskSignalType;
  /** Contribution to the aggregate risk score (0-100). */
  severity: number;
  detail: string;
}

export interface RiskAssessment {
  decision: RiskDecision;
  level: RiskLevel;
  /** Aggregate score 0-100. */
  score: number;
  signals: RiskSignal[];
  /** Machine-readable reasons, e.g. `new_device`, `rate_limited`. */
  reasons: string[];
  /** Present when the decision is `deny` or `challenge` and a retry makes sense. */
  retryAfter?: number;
}

export type RiskChallengeType = "sms";

export interface RiskChallenge {
  challengeToken: string;
  challengeType: RiskChallengeType;
  maskedPhone: string;
  expiresIn: number;
}

export interface RiskChallengeVerifyRequest {
  challengeToken: string;
  code: string;
  deviceId?: string;
}

export interface RiskChallengeResendRequest {
  challengeToken: string;
}

/**
 * Response returned instead of tokens when a login is held for verification.
 */
export interface RiskChallengeRequiredResponse {
  riskChallengeRequired: true;
  challengeToken: string;
  challengeType: RiskChallengeType;
  maskedPhone: string | null;
  expiresIn: number;
  risk: RiskAssessment;
}

export type LoginMethod = "password" | "phone" | "oauth" | "mfa";

export type LoginAuditResult = "succeeded" | "failed" | "challenged" | "blocked";

export interface LoginAuditEntry {
  id: string;
  userId: string | null;
  method: LoginMethod;
  result: LoginAuditResult;
  reason: string | null;
  /** Masked for privacy, e.g. `203.0.113.x`. */
  ipMasked: string | null;
  userAgent: string | null;
  deviceId: string | null;
  riskLevel: RiskLevel;
  riskScore: number;
  createdAt: string;
}

export interface RiskEvent {
  id: string;
  userId: string | null;
  action: RiskAction;
  decision: RiskDecision;
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
  ipMasked: string | null;
  deviceId: string | null;
  createdAt: string;
}
