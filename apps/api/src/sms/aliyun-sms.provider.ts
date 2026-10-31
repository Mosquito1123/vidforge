import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult } from './sms.types.js';

/**
 * Aliyun SMS adapter.
 *
 * Stub: when `ALIYUN_SMS_ACCESS_KEY_ID` / `ALIYUN_SMS_ACCESS_KEY_SECRET` /
 * `ALIYUN_SMS_SIGN_NAME` are present this class is the place to call
 * `@alicloud/dysmsapi20170525` `SendSms`. The SDK is intentionally not wired
 * yet; the call is logged and a synthetic request id is returned so the rest of
 * the flow (rate limits, challenge verification, audit) is fully exercisable.
 */
@Injectable()
export class AliyunSmsProvider implements SmsProvider {
  readonly channel = 'aliyun' as const;
  private readonly logger = new Logger(AliyunSmsProvider.name);

  private readonly accessKeyId = process.env.ALIYUN_SMS_ACCESS_KEY_ID || '';
  private readonly accessKeySecret = process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || '';
  private readonly signName = process.env.ALIYUN_SMS_SIGN_NAME || '';
  private readonly templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || 'SMS_LOGIN';

  isConfigured(): boolean {
    return Boolean(this.accessKeyId && this.accessKeySecret && this.signName);
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Aliyun SMS not configured; stub send to ${input.phone} (purpose=${input.purpose})`,
      );
      return {
        requestId: `aliyun_stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        provider: this.channel,
        stub: true,
      };
    }

    // TODO: replace with the real Aliyun SendSms call.
    // const client = new Dysmsapi20170525.default({ accessKeyId, accessKeySecret, endpoint: 'dysmsapi.aliyuncs.com' });
    // await client.sendSms({ phoneNumbers: input.phone, signName: this.signName,
    //   templateCode: input.templateId ?? this.templateCode, templateParam: JSON.stringify({ code: input.code }) });
    this.logger.warn('Aliyun SMS credentials present but SDK wiring is still a stub');
    return {
      requestId: `aliyun_stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      provider: this.channel,
      stub: true,
    };
  }
}
