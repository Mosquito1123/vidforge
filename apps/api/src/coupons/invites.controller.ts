import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateInviteCodeDto, RedeemInviteCodeDto } from './dto/coupon.dto.js';

@ApiTags('invites')
@Controller('invites')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class InvitesController {
  constructor(private service: CouponsService) {}

  @Post()
  @ApiOperation({ summary: 'Generate invite code' })
  create(@Body() dto: CreateInviteCodeDto, @CurrentUser() user: { id: string }) {
    return this.service.createInviteCode(user.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List my invite codes' })
  list(@CurrentUser() user: { id: string }) {
    return this.service.listInviteCodes(user.id);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate invite code' })
  validate(@Body() body: { code: string }) {
    return this.service.validateInviteCode(body.code);
  }

  @Post('redeem')
  @ApiOperation({ summary: 'Redeem invite code' })
  redeem(@Body() dto: RedeemInviteCodeDto, @CurrentUser() user: { id: string }) {
    return this.service.redeemInviteCode(dto.code, user.id);
  }
}
