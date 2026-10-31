export type CouponType = "percent" | "fixed" | "credits";

export interface Coupon {
  id: string;
  code: string;
  type: CouponType;
  value: number;
  currency: string;
  maxRedemptions: number | null;
  redemptionCount: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CouponValidation {
  valid: boolean;
  code: string;
  reason?: string;
  coupon?: Coupon;
  discountCents?: number;
  credits?: number;
}

export interface CouponRedemption {
  id: string;
  couponId: string;
  userId: string;
  discountCents?: number | null;
  credits?: number | null;
  createdAt: string;
}

export interface InviteCode {
  id: string;
  code: string;
  inviterUserId: string;
  maxUses: number | null;
  uses: number;
  rewardCredits: number;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
}

export interface Referral {
  id: string;
  inviterUserId: string;
  inviteeUserId: string | null;
  inviteCodeId: string | null;
  status: "pending" | "completed" | "rewarded";
  rewardCredits: number;
  completedAt: string | null;
  createdAt: string;
}

export interface CreateCouponRequest {
  code?: string;
  type: CouponType;
  value: number;
  currency?: string;
  maxRedemptions?: number | null;
  expiresAt?: string | null;
}

export interface RedeemCouponRequest {
  code: string;
}

export interface CreateInviteCodeRequest {
  maxUses?: number | null;
  rewardCredits?: number;
  expiresAt?: string | null;
}

export interface RedeemInviteCodeRequest {
  code: string;
}
