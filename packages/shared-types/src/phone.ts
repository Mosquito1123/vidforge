/**
 * Phone / SMS authentication contracts shared by the API and web client.
 */

export type PhonePurpose = "login" | "register" | "bind" | "unbind";

export type SmsChannel = "aliyun" | "tencent";

export interface SmsCodeRequest {
  phone: string;
  purpose: PhonePurpose;
  channel?: SmsChannel;
}

export interface SmsCodeResponse {
  success: true;
  /** E.164 number with the middle digits masked, safe to display. */
  maskedPhone: string;
  channel: SmsChannel;
  /** Seconds the code stays valid. */
  expiresIn: number;
  /** Seconds until another code may be requested for the same number. */
  retryAfter: number;
  /** Only returned by non-production stub providers so local flows can be tested. */
  debugCode?: string;
}

export interface PhoneLoginRequest {
  phone: string;
  code: string;
  deviceId?: string;
}

export interface PhoneRegisterRequest {
  phone: string;
  code: string;
  name?: string;
  deviceId?: string;
}

export interface PhoneBindRequest {
  phone: string;
  code: string;
}

export interface PhoneUnbindRequest {
  /** SMS code sent to the currently bound number. */
  code: string;
}

export interface PhoneBindingStatus {
  bound: boolean;
  /** Masked number only; the raw number is never returned to the client. */
  phone: string | null;
  maskedPhone: string | null;
  verifiedAt: string | null;
}
