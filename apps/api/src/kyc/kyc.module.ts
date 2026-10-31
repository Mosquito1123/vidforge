import { Module } from '@nestjs/common';
import { RiskModule } from '../risk/risk.module.js';
import { KycController } from './kyc.controller.js';
import { KycService } from './kyc.service.js';
import { AliyunIdVerificationProvider } from './providers/aliyun-idverify.provider.js';
import { StubIdVerificationProvider } from './providers/stub-idverify.provider.js';
import { TencentIdVerificationProvider } from './providers/tencent-idverify.provider.js';

@Module({
  imports: [RiskModule],
  controllers: [KycController],
  providers: [
    KycService,
    StubIdVerificationProvider,
    AliyunIdVerificationProvider,
    TencentIdVerificationProvider,
  ],
  exports: [KycService],
})
export class KycModule {}
