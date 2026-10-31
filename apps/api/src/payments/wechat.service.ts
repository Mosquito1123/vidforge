import { Injectable, Logger } from '@nestjs/common';

export interface WechatOrderParams {
  outTradeNo: string;
  amountCents: number;
  description: string;
  notifyUrl?: string;
}

@Injectable()
export class WechatService {
  private readonly logger = new Logger(WechatService.name);
  private readonly appId = process.env.WECHAT_APP_ID || '';
  private readonly mchId = process.env.WECHAT_MCH_ID || '';
  private readonly apiKey = process.env.WECHAT_API_KEY || '';
  private readonly apiV3Key = process.env.WECHAT_API_V3_KEY || '';
  private readonly apiBase = process.env.WECHAT_API_BASE || 'https://api.mch.weixin.qq.com';

  isConfigured() {
    return Boolean(this.appId && this.mchId && this.apiKey);
  }

  async createOrder(params: WechatOrderParams): Promise<{ prepayId: string | null; codeUrl: string | null }> {
    // TODO: replace with real WeChat Pay SDK call (wechatpay-node-v3 / tenpay).
    // Real implementation should call /v3/pay/transactions/native and return code_url.
    if (!this.isConfigured()) {
      const prepayId = `wx_prepay_stub_${Date.now()}`;
      this.logger.warn('WeChat Pay not configured; returning stub order');
      return {
        prepayId,
        codeUrl: `weixin://wxpay/bizpayurl?pr=${params.outTradeNo}`,
      };
    }
    this.logger.warn('WeChat Pay SDK wiring is a stub (TODO: real keys)');
    return { prepayId: null, codeUrl: null };
  }

  async queryOrder(outTradeNo: string): Promise<{ status: 'pending' | 'succeeded' | 'failed'; tradeState?: string; transactionId?: string }> {
    // TODO: real /v3/pay/transactions/out-trade-no/{out_trade_no}
    return { status: 'pending', tradeState: 'NOTPAY' };
  }

  async refund(outTradeNo: string, amountCents: number): Promise<{ refundId: string }> {
    // TODO: real /v3/refund/domestic/refunds
    return { refundId: `rf_wechat_${Date.now()}` };
  }

  verifyWebhookSignature(rawBody: Buffer | string | undefined, signature: string | undefined): boolean {
    // WeChat Pay v3 signature is RSA/SM2 verified with platform certificate.
    // Scaffolding only: real verification TODO.
    if (!this.apiV3Key && !this.apiKey) return true; // verification disabled when no key configured
    if (!signature) throw new Error('Missing wechat signature');
    // TODO: implement signature verification with platform cert / apiV3Key.
    return true;
  }
}
