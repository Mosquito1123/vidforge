import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CreditsModule } from '../credits/credits.module.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { PlansController } from './plans.controller.js';
import { StripeService } from './stripe.service.js';
import { AlipayService } from './alipay.service.js';
import { WechatService } from './wechat.service.js';

@Module({
  imports: [PrismaModule, CreditsModule, ConfigModule],
  controllers: [PaymentsController, PlansController],
  providers: [PaymentsService, StripeService, AlipayService, WechatService],
  exports: [PaymentsService, StripeService, AlipayService, WechatService],
})
export class PaymentsModule {}
