import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { PaymentsService } from './payments.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Get('plans')
  @ApiOperation({ summary: 'List subscription plans' })
  plans() {
    return this.payments.listPlans();
  }

  @Get('plans/:id')
  @ApiOperation({ summary: 'Get plan' })
  plan(@Param('id') id: string) {
    return this.payments.getPlan(id);
  }

  @Get('credit-packages')
  @ApiOperation({ summary: 'List credit packages' })
  packages() {
    return this.payments.listCreditPackages();
  }

  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create checkout session' })
  checkout(@CurrentUser() user: { id: string }, @Body() body: any) {
    return this.payments.createCheckout(user.id, body);
  }

  @Post('webhook/stripe')
  @ApiOperation({ summary: 'Stripe webhook' })
  webhook(@Req() req: any) {
    const signature = req.headers?.['stripe-signature'] as string | undefined;
    return this.payments.handleStripeWebhook(req.rawBody, signature);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Current subscription' })
  subscription(@CurrentUser() user: { id: string }) {
    return this.payments.getSubscription(user.id);
  }

  @Post('subscription/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel subscription' })
  cancel(@CurrentUser() user: { id: string }) {
    return this.payments.cancelSubscription(user.id);
  }

  @Get('invoices')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List invoices' })
  invoices(@CurrentUser() user: { id: string }) {
    return this.payments.listInvoices(user.id);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List payments' })
  history(@CurrentUser() user: { id: string }) {
    return this.payments.listPayments(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get payment and refresh status' })
  getPayment(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.payments.getPayment(user.id, id);
  }

  @Post('webhook/alipay')
  @ApiOperation({ summary: 'Alipay webhook' })
  alipayWebhook(@Req() req: any) {
    const signature = (req.body?.sign || req.headers?.['x-alipay-signature']) as string | undefined;
    return this.payments.handleAlipayWebhook(req.rawBody ?? req.body, signature);
  }

  @Post('webhook/wechat')
  @ApiOperation({ summary: 'WeChat Pay webhook' })
  wechatWebhook(@Req() req: any) {
    const signature = (req.headers?.['wechatpay-signature'] || req.headers?.['x-wechat-signature']) as string | undefined;
    return this.payments.handleWechatWebhook(req.rawBody ?? req.body, signature);
  }

  @Post('refunds')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Refund a payment' })
  refund(@CurrentUser() user: { id: string }, @Body() body: any) {
    return this.payments.refund(user.id, body);
  }
}