import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { PaymentsService } from '../payments/payments.service.js';

@Injectable()
export class WebhooksService {
  constructor(
    private prisma: PrismaService,
    private tasks: TasksService,
    private payments: PaymentsService,
  ) {}

  private secret() {
    return process.env.WEBHOOK_SECRET || process.env.API_INTERNAL_TOKEN || '';
  }

  verifySignature(rawBody: Buffer | string | undefined, signature: string | undefined, secret?: string) {
    const s = secret ?? this.secret();
    if (!s) return true; // verification disabled when no secret configured
    if (!signature) throw new UnauthorizedException('Missing webhook signature');
    const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody ?? '', 'utf8');
    const expected = createHmac('sha256', s).update(body).digest('hex');
    const provided = signature.replace(/^sha256=/, '').trim();
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(provided, 'hex');
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    return true;
  }

  async handleTaskEvent(payload: any, rawBody?: Buffer | string, signature?: string) {
    if (signature !== undefined) this.verifySignature(rawBody, signature);
    const { taskId, status, progress, output, error, stage } = payload || {};
    if (!taskId) throw new BadRequestException('missing taskId');
    return this.tasks.updateStatus(taskId, status ?? 'running', progress, output, error, stage);
  }

  async handleProvider(provider: string, event: string, payload: any, rawBody?: Buffer | string, signature?: string) {
    if (provider === 'stripe') {
      return this.payments.handleStripeWebhook(rawBody, signature);
    }
    if (provider === 'alipay') {
      return this.payments.handleAlipayWebhook(rawBody ?? payload, signature ?? payload?.sign);
    }
    if (provider === 'wechat' || provider === 'wechatpay') {
      const sig = signature ?? (payload && (payload['wechatpay-signature'] || payload.signature));
      return this.payments.handleWechatWebhook(rawBody ?? payload, sig);
    }
    this.verifySignature(rawBody, signature);
    const normalizedEvent = event || payload?.event || payload?.type || 'webhook.received';
    if (normalizedEvent.startsWith('task.') || payload?.taskId) {
      return this.handleTaskEvent(payload, undefined, undefined);
    }
    return { received: true, provider, event: normalizedEvent, payload };
  }

  async dispatch(event: string, payload: any) {
    switch (event) {
      case 'task.updated':
      case 'task.status':
        return this.handleTaskEvent(payload);
      default:
        return { received: true, event, payload };
    }
  }

  async handleGeneric(event: string, payload: any) {
    return { received: true, event, payload };
  }
}
