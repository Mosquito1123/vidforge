import { Injectable, Logger } from '@nestjs/common';
import { SmsProvider, SmsSendInput, SmsSendResult } from './sms.types.js';

/**
 * Tencent Cloud SMS adapter.
 *
 * Stub: when `TENCENT_SMS_SECRET_ID` / `TENCENT_SMS_SECRET_KEY` /
 * `TENCENT_SMS_SDK_APP_ID` / `TENCENT_SMS_SIGN_NAME` are present this class
 * should call `tencentcloud-sdk-nodejs` `sms.v20210111.SendSms`. Until then a
 * synthetic request id is returned so the verification pipeline stays usable.
 */
@Injectable()
export class TencentSmsProvider implements SmsProvider {
  readonly channel = 'tencent' as const;
  private readonly logger = new Logger(TencentSmsProvider.name);

  private readonly secretId = process.env.TENCENT_SMS_SECRET_ID || '';
  private readonly secretKey = process.env.TENCENT_SMS_SECRET_KEY || '';
  private readonly sdkAppId = process.env.TENCENT_SMS_SDK_APP_ID || '';
  private readonly signName = process.env.TENCENT_SMS_SIGN_NAME || '';
  private readonly templateId = process.env.TENCENT_SMS_TEMPLATE_ID || '';

  isConfigured(): boolean {
    return Boolean(this.secretId && this.secretKey && this.sdkAppId && this.signName);
  }

  async send(input: SmsSendInput): Promise<SmsSendResult> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `Tencent SMS not configured; stub send to ${input.phone} (purpose=${input.purpose})`,
      );
      return {
        requestId: `tencent_stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        provider: this.channel,
        stub: true,
      };
    }

    // TODO: replace with the real Tencent Cloud SendSms call.
    // const client = new sms.v20210111.Client({ credential: { secretId, secretKey }, region: 'ap-guangzhou' });
    // await client.SendSms({ PhoneNumberSet: [input.phone], SmsSdkAppId: this.sdkAppId,
    //   SignName: this.signName, TemplateId: input.templateId ?? this.templateId,
    //   TemplateParamSet: [input.code] });
    this.logger.warn('Tencent SMS credentials present but SDK wiring is still a stub');
    return {
      requestId: `tencent_stub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      provider: this.channel,
      stub: true,
    };
  }
}
