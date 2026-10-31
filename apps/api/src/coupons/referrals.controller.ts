import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('referrals')
@Controller('referrals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReferralsController {
  constructor(private service: CouponsService) {}

  @Get()
  @ApiOperation({ summary: 'List my referrals' })
  list(@CurrentUser() user: { id: string }) {
    return this.service.listReferrals(user.id);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Referral stats' })
  stats(@CurrentUser() user: { id: string }) {
    return this.service.getReferralStats(user.id);
  }
}
