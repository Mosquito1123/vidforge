import {
  BadRequestException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreditsService } from '../credits/credits.service.js';
import { StripeService } from './stripe.service.js';
import { AlipayService } from './alipay.service.js';
import { WechatService } from './wechat.service.js';

@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    private config: ConfigService,
    private stripe: StripeService,
    private alipay: AlipayService,
    private wechat: WechatService,
  ) {}

  async listPlans() {
    return this.prisma.plan.findMany({ where: { active: true }, orderBy: { priceCents: 'asc' } });
  }

  async getPlan(id: string) {
    const plan = await this.prisma.plan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundException('Plan not found');
    return plan;
  }

  async listCreditPackages() {
    return this.prisma.creditPackage.findMany({ where: { active: true }, orderBy: { priceCents: 'asc' } });
  }

  private async resolveAmount(dto: any): Promise<{ amountCents: number; credits: number; planId?: string; type: 'credit_purchase' | 'subscription' }> {
    const type = dto.type === 'subscription' ? 'subscription' : 'credit_purchase';
    if (type === 'subscription') {
      if (!dto.planId) throw new BadRequestException('planId is required for subscription');
      const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
      if (!plan || !plan.active) throw new NotFoundException('Plan not found');
      return { amountCents: plan.priceCents, credits: plan.credits, planId: plan.id, type };
    }
    // credit purchase
    if (dto.packageId) {
      const pkg = await this.prisma.creditPackage.findUnique({ where: { id: dto.packageId } });
      if (!pkg || !pkg.active) throw new NotFoundException('Credit package not found');
      return { amountCents: pkg.priceCents, credits: pkg.credits, type };
    }
    const credits = Number(dto.credits);
    if (!Number.isFinite(credits) || credits <= 0) throw new BadRequestException('credits must be positive');
    const priceCents = Number(dto.amountCents);
    if (!Number.isFinite(priceCents) || priceCents <= 0) {
      // default 1 cent per credit
      return { amountCents: Math.round(credits), credits, type };
    }
    return { amountCents: Math.round(priceCents), credits, type };
  }

  async createCheckout(userId: string, dto: any) {
    const provider = dto.provider || 'stripe';
    const { amountCents, credits, planId, type } = await this.resolveAmount(dto);

    // idempotency
    if (dto.idempotencyKey) {
      const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) {
        return {
          provider: existing.provider,
          paymentId: existing.id,
          status: existing.status,
          checkoutUrl: (existing.metadata as any)?.checkoutUrl ?? null,
          sessionId: existing.providerPaymentId,
          duplicate: true,
        };
      }
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        type: type as any,
        provider: provider as any,
        amountCents,
        currency: 'usd',
        status: 'pending',
        credits,
        planId: planId ?? null,
        idempotencyKey: dto.idempotencyKey ?? null,
        metadata: { checkoutUrl: null },
      },
    });

    const successUrl = dto.successUrl || `${this.config.get('WEB_URL') || 'http://localhost:3000'}/billing?success=1&payment=${payment.id}`;
    const cancelUrl = dto.cancelUrl || `${this.config.get('WEB_URL') || 'http://localhost:3000'}/pricing?canceled=1`;

    if (provider === 'stripe') {
      const plan = planId ? await this.prisma.plan.findUnique({ where: { id: planId } }) : null;
      const session = await this.stripe.createCheckoutSession({
        mode: type === 'subscription' ? 'subscription' : 'payment',
        successUrl,
        cancelUrl,
        customerEmail: user.email,
        lineItems: [
          plan && plan.stripePriceId
            ? { price: plan.stripePriceId, quantity: 1 }
            : {
                priceData: {
                  currency: 'usd',
                  unitAmount: amountCents,
                  productName: type === 'subscription' ? (plan?.name || 'Subscription') : `${credits} credits`,
                  recurring: type === 'subscription' ? { interval: 'month' } : undefined,
                },
                quantity: 1,
              },
        ],
        metadata: { paymentId: payment.id, userId, type },
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: session.id,
          metadata: { checkoutUrl: session.url, sessionId: session.id },
        },
      });

      return {
        provider: 'stripe',
        paymentId: payment.id,
        status: 'pending',
        checkoutUrl: session.url,
        sessionId: session.id,
      };
    }

    if (provider === 'alipay') {
      const notifyUrl = `${this.config.get('API_URL') || 'http://localhost:4000'}/webhooks/alipay`;
      const order = await this.alipay.createOrder({
        outTradeNo: payment.id,
        amountCents,
        subject: type === 'subscription' ? (planId ? 'Subscription' : 'Subscription') : `${credits} credits`,
        notifyUrl,
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: order.tradeNo,
          currency: 'cny',
          metadata: { qrCode: order.qrCode, payUrl: order.payUrl, notifyUrl },
        },
      });
      return {
        provider: 'alipay',
        paymentId: payment.id,
        status: 'pending',
        qrCode: order.qrCode,
        payUrl: order.payUrl,
        sessionId: order.tradeNo,
      };
    }

    if (provider === 'wechat') {
      const notifyUrl = `${this.config.get('API_URL') || 'http://localhost:4000'}/webhooks/wechat`;
      const order = await this.wechat.createOrder({
        outTradeNo: payment.id,
        amountCents,
        description: type === 'subscription' ? 'Subscription' : `${credits} credits`,
        notifyUrl,
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: order.prepayId ?? undefined,
          currency: 'cny',
          metadata: { qrCode: order.codeUrl, prepayId: order.prepayId, notifyUrl },
        },
      });
      return {
        provider: 'wechat',
        paymentId: payment.id,
        status: 'pending',
        qrCode: order.codeUrl,
        prepayId: order.prepayId,
        sessionId: order.prepayId,
      };
    }

    // Unknown provider stub
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { metadata: { stub: true, provider } },
    });
    return {
      provider,
      paymentId: payment.id,
      status: 'pending',
      checkoutUrl: null,
      message: `${provider} checkout is a stub in this environment`,
    };
  }

  async handleStripeWebhook(rawBody: any, signature: string | undefined) {
    try {
      this.stripe.verifyWebhookSignature(rawBody, signature);
    } catch (e) {
      throw new UnauthorizedException(e instanceof Error ? e.message : 'Invalid signature');
    }

    let event: any;
    const bodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
    try {
      event = JSON.parse(bodyStr);
    } catch {
      throw new BadRequestException('Invalid webhook payload');
    }

    const eventId = event.id || event?.data?.object?.id || `${Date.now()}`;
    const type = event.type || 'unknown';

    // idempotency
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'stripe', eventId } },
    });
    if (existing) {
      return { received: true, duplicate: true };
    }
    await this.prisma.webhookEvent.create({
      data: { provider: 'stripe', eventId, type, payload: event },
    });

    switch (type) {
      case 'checkout.session.completed':
        await this.processCheckoutSession(event.data?.object);
        break;
      case 'checkout.session.expired':
        // mark payment failed if found
        await this.markPaymentFailed(event.data?.object);
        break;
      default:
        break;
    }

    return { received: true };
  }

  private async markPaymentFailed(session: any) {
    const paymentId = session?.metadata?.paymentId;
    if (!paymentId) return;
    await this.prisma.payment.updateMany({
      where: { id: paymentId, status: 'pending' },
      data: { status: 'failed' },
    });
  }

  private async processCheckoutSession(session: any) {
    if (!session) return;
    const paymentId = session.metadata?.paymentId;
    const userId = session.metadata?.userId;
    const type = session.metadata?.type;

    let payment = null;
    if (paymentId) {
      payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    }
    if (!payment && session.id) {
      payment = await this.prisma.payment.findFirst({ where: { providerPaymentId: session.id } });
    }
    if (!payment) {
      // create a payment record from session
      if (!userId) return;
      payment = await this.prisma.payment.create({
        data: {
          userId,
          type: (type === 'subscription' ? 'subscription' : 'credit_purchase') as any,
          provider: 'stripe',
          amountCents: session.amount_total ?? 0,
          currency: session.currency ?? 'usd',
          status: 'pending',
          credits: 0,
          providerPaymentId: session.id,
        },
      });
    }

    if (payment.status === 'succeeded') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        providerPaymentId: session.id ?? payment.providerPaymentId,
        metadata: { ...(payment.metadata as any), paymentIntent: session.payment_intent ?? null },
      },
    });

    // grant credits
    if (payment.credits > 0) {
      try {
        await this.credits.grantCredits(payment.userId, payment.credits, 'purchase', undefined, payment.id);
      } catch (e) {
        // ignore duplicate
      }
    }

    // subscription handling
    if (payment.type === 'subscription' && payment.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: payment.planId } });
      const sub = await this.prisma.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId,
          provider: 'stripe',
          providerSubscriptionId: session.subscription ?? null,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { subscriptionId: sub.id },
      });
      if (plan && plan.credits > 0) {
        try {
          await this.credits.grantCredits(payment.userId, plan.credits, 'subscription', undefined, `sub:${sub.id}`);
        } catch {}
      }
    }

    // invoice
    const number = `INV-${Date.now()}-${payment.id.slice(0, 6)}`;
    await this.prisma.invoice.create({
      data: {
        userId: payment.userId,
        paymentId: payment.id,
        number,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: 'paid',
        hostedUrl: session.url ?? null,
      },
    });
  }

  private parsePayload(rawBody: any): any {
    const str = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
    try {
      return JSON.parse(str);
    } catch {
      // form-urlencoded (Alipay notify) or XML (WeChat notify)
    }
    const params = new URLSearchParams(str);
    const obj: Record<string, string> = {};
    params.forEach((v, k) => {
      obj[k] = v;
    });
    if (Object.keys(obj).length) return obj;
    // WeChat XML fallback
    const xmlObj: Record<string, string> = {};
    const re = /<(\w+)><!\[CDATA\[(.*?)\]\]><\/\1>|<(\w+)>([^<]*)<\/\3>/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(str)) !== null) {
      const key = m[1] || m[3];
      const val = m[2] !== undefined ? m[2] : m[4];
      if (key) xmlObj[key] = val;
    }
    return xmlObj;
  }

  async getPayment(userId: string, paymentId: string) {
    let payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { refunds: true, plan: true },
    });
    if (!payment || payment.userId !== userId) throw new NotFoundException('Payment not found');

    // refresh status from provider for pending domestic payments
    if (payment.status === 'pending') {
      if (payment.provider === 'alipay') {
        const q = await this.alipay.queryOrder(payment.id);
        if (q.status === 'succeeded') {
          await this.processDomesticSuccess('alipay', payment.id, q.tradeNo);
        }
      } else if (payment.provider === 'wechat') {
        const q = await this.wechat.queryOrder(payment.id);
        if (q.status === 'succeeded') {
          await this.processDomesticSuccess('wechat', payment.id, q.transactionId);
        }
      }
      payment = await this.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { refunds: true, plan: true },
      });
    }
    return payment;
  }

  private async processDomesticSuccess(provider: 'alipay' | 'wechat', paymentId: string, providerPaymentId?: string) {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) return;
    if (payment.status === 'succeeded') return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: 'succeeded',
        providerPaymentId: providerPaymentId ?? payment.providerPaymentId,
        metadata: { ...(payment.metadata as any), processedAt: new Date().toISOString() },
      },
    });

    if (payment.credits > 0) {
      try {
        await this.credits.grantCredits(payment.userId, payment.credits, 'purchase', undefined, payment.id);
      } catch {
        // ignore duplicate
      }
    }

    if (payment.type === 'subscription' && payment.planId) {
      const plan = await this.prisma.plan.findUnique({ where: { id: payment.planId } });
      const sub = await this.prisma.subscription.create({
        data: {
          userId: payment.userId,
          planId: payment.planId,
          provider: provider as any,
          providerSubscriptionId: providerPaymentId ?? null,
          status: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { subscriptionId: sub.id },
      });
      if (plan && plan.credits > 0) {
        try {
          await this.credits.grantCredits(payment.userId, plan.credits, 'subscription', undefined, `sub:${sub.id}`);
        } catch {}
      }
    }

    const number = `INV-${Date.now()}-${payment.id.slice(0, 6)}`;
    try {
      await this.prisma.invoice.create({
        data: {
          userId: payment.userId,
          paymentId: payment.id,
          number,
          amountCents: payment.amountCents,
          currency: payment.currency,
          status: 'paid',
        },
      });
    } catch {
      // ignore duplicate invoice
    }
  }

  async handleAlipayWebhook(rawBody: any, signature?: string) {
    const payload = this.parsePayload(rawBody);
    const sig = signature ?? payload?.sign;
    try {
      this.alipay.verifyWebhookSignature(rawBody, sig);
    } catch (e) {
      throw new UnauthorizedException(e instanceof Error ? e.message : 'Invalid signature');
    }

    const eventId = payload?.trade_no || payload?.out_trade_no || `${Date.now()}`;
    // idempotency
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'alipay', eventId } },
    });
    if (existing) {
      return { received: true, duplicate: true };
    }
    await this.prisma.webhookEvent.create({
      data: { provider: 'alipay', eventId, type: payload?.trade_status || 'notify', payload },
    });

    const outTradeNo = payload?.out_trade_no;
    const tradeStatus = payload?.trade_status;
    if (outTradeNo) {
      if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
        await this.processDomesticSuccess('alipay', outTradeNo, payload?.trade_no);
      } else if (tradeStatus === 'TRADE_CLOSED') {
        await this.prisma.payment.updateMany({
          where: { id: outTradeNo, status: 'pending' },
          data: { status: 'failed' },
        });
      }
    }

    return { received: true };
  }

  async handleWechatWebhook(rawBody: any, signature?: string) {
    const payload = this.parsePayload(rawBody);
    try {
      this.wechat.verifyWebhookSignature(rawBody, signature);
    } catch (e) {
      throw new UnauthorizedException(e instanceof Error ? e.message : 'Invalid signature');
    }

    const eventId = payload?.transaction_id || payload?.out_trade_no || `${Date.now()}`;
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { provider_eventId: { provider: 'wechat', eventId } },
    });
    if (existing) {
      return { received: true, duplicate: true };
    }
    await this.prisma.webhookEvent.create({
      data: { provider: 'wechat', eventId, type: payload?.trade_state || payload?.event_type || 'notify', payload },
    });

    const outTradeNo = payload?.out_trade_no;
    const tradeState = payload?.trade_state || payload?.trade_state_desc;
    if (outTradeNo) {
      if (tradeState === 'SUCCESS') {
        await this.processDomesticSuccess('wechat', outTradeNo, payload?.transaction_id);
      } else if (tradeState && tradeState !== 'SUCCESS') {
        // leave pending for non-success; mark failed for closed states
        if (tradeState === 'CLOSED' || tradeState === 'REVOKED' || tradeState === 'PAYERROR') {
          await this.prisma.payment.updateMany({
            where: { id: outTradeNo, status: 'pending' },
            data: { status: 'failed' },
          });
        }
      }
    }

    return { received: true };
  }

  async getSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true },
    });
  }

  async cancelSubscription(userId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });
    if (!sub) throw new NotFoundException('No active subscription');
    if (sub.providerSubscriptionId) {
      try {
        await this.stripe.cancelSubscription(sub.providerSubscriptionId);
      } catch {}
    }
    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'canceled', cancelAtPeriodEnd: true, canceledAt: new Date() },
    });
    return sub;
  }

  async listInvoices(userId: string) {
    return this.prisma.invoice.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPayments(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { plan: true, refunds: true },
    });
  }

  async refund(userId: string, dto: any, isAdmin = false) {
    const payment = await this.prisma.payment.findUnique({ where: { id: dto.paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    if (!isAdmin && payment.userId !== userId) throw new BadRequestException('Not allowed');
    if (payment.status !== 'succeeded') throw new BadRequestException('Payment not refundable');

    const amountCents = dto.amountCents ? Number(dto.amountCents) : payment.amountCents;
    if (!Number.isFinite(amountCents) || amountCents <= 0 || amountCents > payment.amountCents) {
      throw new BadRequestException('Invalid refund amount');
    }

    let providerRefundId: string | undefined;
    if (payment.provider === 'alipay') {
      const r = await this.alipay.refund(payment.id, amountCents);
      providerRefundId = r.refundId;
    } else if (payment.provider === 'wechat') {
      const r = await this.wechat.refund(payment.id, amountCents);
      providerRefundId = r.refundId;
    } else if (payment.provider === 'stripe' && payment.providerPaymentId) {
      // need payment intent; session id not intent. Try metadata.
      const pi = (payment.metadata as any)?.paymentIntent;
      if (pi) {
        const r = await this.stripe.createRefund(pi, amountCents);
        providerRefundId = r.id;
      } else {
        const r = await this.stripe.createRefund(payment.providerPaymentId, amountCents);
        providerRefundId = r.id;
      }
    } else {
      providerRefundId = `rf_stub_${Date.now()}`;
    }

    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        amountCents,
        reason: dto.reason ?? null,
        status: 'succeeded',
        providerRefundId: providerRefundId ?? null,
      },
    });

    const newStatus = amountCents >= payment.amountCents ? 'refunded' : 'partially_refunded';
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus as any },
    });

    // reverse credits for credit purchases
    if (payment.type === 'credit_purchase' && payment.credits > 0) {
      const ratio = amountCents / payment.amountCents;
      const creditsToReverse = Math.round(payment.credits * ratio);
      if (creditsToReverse > 0) {
        try {
          await this.credits.spendCredits(payment.userId, creditsToReverse, 'refund', undefined, `refund:${refund.id}`);
        } catch {
          // insufficient credits; ignore
        }
      }
    }

    return refund;
  }
}