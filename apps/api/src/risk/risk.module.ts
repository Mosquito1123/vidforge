import { Module } from '@nestjs/common';
import { PhoneStoreModule } from '../phone/phone-store.module.js';
import { SmsModule } from '../sms/sms.module.js';
import { RiskService } from './risk.service.js';

@Module({
  imports: [SmsModule, PhoneStoreModule],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
