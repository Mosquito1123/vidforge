export type RiskAction =
  | 'login'
  | 'phone_login'
  | 'phone_register'
  | 'sms_send'
  | 'bind_phone'
  | 'unbind_phone'
  | 'kyc_submit';

export type RiskDecision = 'allow' | 'challenge' | 'deny';

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export type RiskSignalType =
  | 'blocked_ip'
  | 'missing_device_id'
  | 'missing_user_agent'
  | 'suspicious_user_agent'
  | 'new_device'
  | 'device_fanout'
  | 'new_ip'
  | 'ip_fanout'
  | 'recent_failures'
  | 'rate_limited'
  | 'phone_reuse'
  | 'challenge_unavailable';

export interface RiskSignal {
  type: RiskSignalType;
  severity: number;
  detail: string;
}

export interface RiskAssessment {
  decision: RiskDecision;
  level: RiskLevel;
  score: number;
  signals: RiskSignal[];
  reasons: string[];
  retryAfter?: number;
}

export interface RiskContext {
  action: RiskAction;
  userId?: string | null;
  phone?: string | null;
  email?: string | null;
  ip?: string | null;
  deviceId?: string | null;
  userAgent?: string | null;
  /** Newly created accounts should not be penalised for being a new device. */
  isNewUser?: boolean;
}

export type LoginMethod = 'password' | 'phone' | 'oauth' | 'mfa';

export type LoginAuditResult = 'succeeded' | 'failed' | 'challenged' | 'blocked';

export interface LoginAuditInput {
  userId?: string | null;
  method: LoginMethod;
  result: LoginAuditResult;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
  risk: RiskAssessment;
}

export interface LoginAuditEntry {
  id: string;
  userId: string | null;
  method: LoginMethod;
  result: LoginAuditResult;
  reason: string | null;
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

export interface RequestMeta {
  ip?: string | null;
  userAgent?: string | null;
  deviceId?: string | null;
}
