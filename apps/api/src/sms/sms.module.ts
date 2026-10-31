import { Module } from '@nestjs/common';
import { AliyunSmsProvider } from './aliyun-sms.provider.js';
import { TencentSmsProvider } from './tencent-sms.provider.js';
import { SmsService } from './sms.service.js';

@Module({
  providers: [AliyunSmsProvider, TencentSmsProvider, SmsService],
  exports: [SmsService],
})
export class SmsModule {}
