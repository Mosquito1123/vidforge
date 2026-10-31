import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CouponsService } from './coupons.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { AdminGuard } from '../admin/guards/admin.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateCouponDto, ValidateCouponDto, RedeemCouponDto } from './dto/coupon.dto.js';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private service: CouponsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create coupon (admin)' })
  create(@Body() dto: CreateCouponDto, @CurrentUser() user: { id: string }, @Req() req: any) {
    return this.service.createCoupon(dto, user.id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List coupons (admin)' })
  list() {
    return this.service.listCoupons();
  }

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Validate coupon code' })
  validate(@Body() dto: ValidateCouponDto, @CurrentUser() user: { id: string }) {
    return this.service.validateCoupon(dto.code, user.id);
  }

  @Post('redeem')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Redeem coupon code' })
  redeem(@Body() dto: RedeemCouponDto, @CurrentUser() user: { id: string }) {
    return this.service.redeemCoupon(dto.code, user.id, dto.paymentId);
  }
}
