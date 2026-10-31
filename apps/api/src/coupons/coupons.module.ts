import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CreditsModule } from '../credits/credits.module.js';
import { CouponsService } from './coupons.service.js';
import { CouponsController } from './coupons.controller.js';
import { InvitesController } from './invites.controller.js';
import { ReferralsController } from './referrals.controller.js';

@Module({
  imports: [PrismaModule, CreditsModule],
  controllers: [CouponsController, InvitesController, ReferralsController],
  providers: [CouponsService],
  exports: [CouponsService],
})
export class CouponsModule {}
