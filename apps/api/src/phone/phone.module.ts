import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { RiskModule } from '../risk/risk.module.js';
import { SmsModule } from '../sms/sms.module.js';
import { PhoneStoreModule } from './phone-store.module.js';
import { PhoneController } from './phone.controller.js';
import { PhoneService } from './phone.service.js';

@Module({
  imports: [AuthModule, RiskModule, SmsModule, PhoneStoreModule],
  controllers: [PhoneController],
  providers: [PhoneService],
  exports: [PhoneService],
})
export class PhoneModule {}
