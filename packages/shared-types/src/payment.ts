export type PaymentProvider = "stripe" | "alipay" | "wechat";

export type PaymentStatus =
  | "pending"
  | "succeeded"
  | "failed"
  | "refunded"
  | "partially_refunded";

export type PaymentType = "credit_purchase" | "subscription";

export interface Payment {
  id: string;
  userId: string;
  type: PaymentType;
  provider: PaymentProvider;
  providerPaymentId?: string | null;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  credits: number;
  planId?: string | null;
  subscriptionId?: string | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentRequest {
  type?: PaymentType;
  provider: PaymentProvider;
  planId?: string;
  packageId?: string;
  credits?: number;
  amountCents?: number;
  idempotencyKey?: string;
  successUrl?: string;
  cancelUrl?: string;
}

export interface CreatePaymentResponse {
  provider: PaymentProvider;
  paymentId: string;
  status: PaymentStatus | string;
  checkoutUrl?: string | null;
  qrCode?: string | null;
  payUrl?: string | null;
  prepayId?: string | null;
  sessionId?: string | null;
  duplicate?: boolean;
  message?: string;
}

export interface PaymentQueryResponse extends CreatePaymentResponse {
  payment?: Payment;
}

export interface RefundRequest {
  paymentId: string;
  amountCents?: number;
  reason?: string;
}

export interface RefundResponse {
  id: string;
  paymentId?: string;
  amountCents: number;
  status: string;
  providerRefundId?: string | null;
}

export type AlipayNotifyPayload = {
  out_trade_no: string;
  trade_no: string;
  trade_status: string;
  total_amount?: string;
  [key: string]: unknown;
};

export type WechatNotifyPayload = {
  out_trade_no?: string;
  transaction_id?: string;
  trade_state?: string;
  [key: string]: unknown;
};
