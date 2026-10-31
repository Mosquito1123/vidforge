export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn?: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
}

export interface LoginRequest {
  email: string;
  password: string;
  mfaCode?: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name?: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  password: string;
}

export interface EmailVerificationRequest {
  token: string;
}

export interface MfaSetupResponse {
  secret: string;
  otpauthUrl: string;
}

export interface MfaVerifyRequest {
  code: string;
}

export interface Session {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
  current?: boolean;
}

export interface ProfileUpdateRequest {
  name?: string;
  avatarUrl?: string | null;
  bio?: string | null;
  locale?: string;
}
