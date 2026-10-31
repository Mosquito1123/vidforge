import { Injectable, Logger } from '@nestjs/common';

export interface AlipayOrderParams {
  outTradeNo: string;
  amountCents: number;
  subject: string;
  notifyUrl?: string;
  returnUrl?: string;
}

@Injectable()
export class AlipayService {
  private readonly logger = new Logger(AlipayService.name);
  private readonly appId = process.env.ALIPAY_APP_ID || '';
  private readonly privateKey = process.env.ALIPAY_PRIVATE_KEY || '';
  private readonly publicKey = process.env.ALIPAY_PUBLIC_KEY || '';
  private readonly gateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do';

  isConfigured() {
    return Boolean(this.appId && this.privateKey);
  }

  async createOrder(params: AlipayOrderParams): Promise<{ tradeNo: string; qrCode: string | null; payUrl: string | null }> {
    // TODO: replace with real Alipay SDK call (alipay-sdk) using appId/privateKey.
    // Real implementation should call alipay.trade.precreate (native QR) or
    // alipay.trade.page.pay (web) and return the QR code / pay URL.
    if (!this.isConfigured()) {
      const tradeNo = `alipay_stub_${Date.now()}`;
      this.logger.warn('Alipay not configured; returning stub order');
      return {
        tradeNo,
        qrCode: `https://example.com/qr/${params.outTradeNo}`,
        payUrl: null,
      };
    }
    this.logger.warn('Alipay SDK wiring is a stub (TODO: real keys)');
    return {
      tradeNo: params.outTradeNo,
      qrCode: null,
      payUrl: null,
    };
  }

  async queryOrder(outTradeNo: string): Promise<{ status: 'pending' | 'succeeded' | 'failed'; tradeStatus?: string; tradeNo?: string }> {
    // TODO: real alipay.trade.query
    return { status: 'pending', tradeStatus: 'WAIT_BUYER_PAY' };
  }

  async refund(outTradeNo: string, amountCents: number): Promise<{ refundId: string }> {
    // TODO: real alipay.trade.refund
    return { refundId: `rf_alipay_${Date.now()}` };
  }

  verifyWebhookSignature(rawBody: Buffer | string | undefined, signature: string | undefined): boolean {
    // Alipay notify signature is RSA-SHA256 verified with the Alipay public key.
    // Scaffolding only: real verification TODO.
    if (!this.publicKey) return true; // verification disabled when no key configured
    if (!signature) throw new Error('Missing alipay signature');
    // TODO: implement RSA verification with publicKey.
    return true;
  }
}
