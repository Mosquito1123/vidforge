import { Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';

export interface StripeCheckoutParams {
  mode: 'payment' | 'subscription';
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  lineItems: Array<{
    price?: string;
    quantity?: number;
    priceData?: {
      currency: string;
      unitAmount: number;
      productName: string;
      recurring?: { interval: 'month' | 'year' | 'week' | 'day' };
    };
  }>;
  metadata: Record<string, string>;
}

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly secretKey = process.env.STRIPE_SECRET_KEY || '';
  private readonly webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
  private readonly apiBase = 'https://api.stripe.com/v1';

  isConfigured() {
    return Boolean(this.secretKey);
  }

  private authHeaders() {
    return {
      Authorization: `Bearer ${this.secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  private encodeForm(obj: Record<string, any>, prefix = ''): string {
    const parts: string[] = [];
    const append = (key: string, value: any) => {
      if (value === undefined || value === null) return;
      if (Array.isArray(value)) {
        value.forEach((v, i) => append(`${key}[${i}]`, v));
      } else if (typeof value === 'object') {
        Object.entries(value).forEach(([k, v]) => append(`${key}[${k}]`, v));
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
      }
    };
    Object.entries(obj).forEach(([k, v]) => append(prefix ? `${prefix}[${k}]` : k, v));
    return parts.join('&');
  }

  async createCheckoutSession(params: StripeCheckoutParams): Promise<{ id: string; url: string | null }> {
    if (!this.secretKey) {
      // Stub mode: return a fake session so flows can be exercised without Stripe keys.
      const id = `cs_stub_${Date.now()}`;
      return { id, url: params.successUrl };
    }

    const body: Record<string, any> = {
      mode: params.mode,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    };
    if (params.customerEmail) body.customer_email = params.customerEmail;

    params.lineItems.forEach((li, idx) => {
      if (li.price) {
        body[`line_items[${idx}][price]`] = li.price;
        body[`line_items[${idx}][quantity]`] = li.quantity ?? 1;
      } else if (li.priceData) {
        const pd = li.priceData;
        body[`line_items[${idx}][price_data][currency]`] = pd.currency;
        body[`line_items[${idx}][price_data][unit_amount]`] = pd.unitAmount;
        body[`line_items[${idx}][price_data][product_data][name]`] = pd.productName;
        body[`line_items[${idx}][quantity]`] = li.quantity ?? 1;
        if (pd.recurring) {
          body[`line_items[${idx}][price_data][recurring][interval]`] = pd.recurring.interval;
        }
      }
    });

    const res = await fetch(`${this.apiBase}/checkout/sessions`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: this.encodeForm(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe checkout session failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { id: string; url: string | null };
    return { id: data.id, url: data.url };
  }

  async cancelSubscription(providerSubscriptionId: string): Promise<void> {
    if (!this.secretKey) return;
    const res = await fetch(`${this.apiBase}/subscriptions/${providerSubscriptionId}`, {
      method: 'DELETE',
      headers: this.authHeaders(),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe cancel subscription failed: ${res.status} ${text}`);
    }
  }

  async createRefund(paymentIntentId: string, amountCents?: number): Promise<{ id: string }> {
    if (!this.secretKey) {
      return { id: `re_stub_${Date.now()}` };
    }
    const body: Record<string, any> = { payment_intent: paymentIntentId };
    if (amountCents) body.amount = amountCents;
    const res = await fetch(`${this.apiBase}/refunds`, {
      method: 'POST',
      headers: this.authHeaders(),
      body: this.encodeForm(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Stripe refund failed: ${res.status} ${text}`);
    }
    const data = (await res.json()) as { id: string };
    return { id: data.id };
  }

  verifyWebhookSignature(rawBody: Buffer | string | undefined, signature: string | undefined): any {
    if (!this.webhookSecret) {
      // verification disabled when no secret configured
      if (!signature) return null;
    }
    if (!signature) throw new Error('Missing stripe-signature');
    const body = Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : String(rawBody ?? '');
    const parts = signature.split(',').reduce<Record<string, string>>((acc, p) => {
      const [k, v] = p.split('=');
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const t = parts.t;
    const v1 = parts.v1;
    if (!t || !v1) throw new Error('Invalid stripe-signature header');

    // timestamp tolerance 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - Number(t)) > 300) throw new Error('Webhook timestamp too old');

    const signedPayload = `${t}.${body}`;
    const expected = createHmac('sha256', this.webhookSecret || '').update(signedPayload).digest('hex');
    const expectedBuf = Buffer.from(expected, 'hex');
    const providedBuf = Buffer.from(v1, 'hex');
    if (expectedBuf.length !== providedBuf.length || !timingSafeEqual(expectedBuf, providedBuf)) {
      throw new Error('Invalid webhook signature');
    }
    // caller parses body
    return true;
  }
}