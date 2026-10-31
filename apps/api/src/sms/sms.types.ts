export type SmsChannel = 'aliyun' | 'tencent';

export interface SmsSendInput {
  phone: string;
  code: string;
  purpose: string;
  templateId?: string;
}

export interface SmsSendResult {
  requestId: string;
  provider: SmsChannel;
  /** True when no credentials are configured and the message was not sent. */
  stub: boolean;
}

/**
 * Adapter contract implemented by every SMS vendor.
 *
 * Real SDK calls should live inside the concrete provider and must never leak
 * vendor-specific types into `SmsService`.
 */
export interface SmsProvider {
  readonly channel: SmsChannel;
  isConfigured(): boolean;
  send(input: SmsSendInput): Promise<SmsSendResult>;
}
