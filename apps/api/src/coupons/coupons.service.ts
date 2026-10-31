import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreditsService } from '../credits/credits.service.js';

function genCode(prefix = ''): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = prefix;
  for (let i = 0; i < 8; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService, private credits: CreditsService) {}

  // ---- Coupons ----
  async createCoupon(dto: any, actorId?: string) {
    const code = (dto.code && String(dto.code).trim()) || genCode('CPN');
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new BadRequestException('Coupon code already exists');
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    const coupon = await this.prisma.coupon.create({
      data: {
        code,
        type: dto.type,
        value: dto.value,
        currency: dto.currency || 'usd',
        maxRedemptions: dto.maxRedemptions ?? null,
        expiresAt,
        active: true,
      },
    });
    return coupon;
  }

  async listCoupons() {
    return this.prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async validateCoupon(code: string, userId?: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || !coupon.active) return { valid: false, code, reason: 'invalid' };
    if (coupon.expiresAt && coupon.expiresAt < new Date()) return { valid: false, code, reason: 'expired' };
    if (coupon.maxRedemptions && coupon.redemptionCount >= coupon.maxRedemptions) {
      return { valid: false, code, reason: 'exhausted' };
    }
    if (userId) {
      const existing = await this.prisma.couponRedemption.findUnique({
        where: { couponId_userId: { couponId: coupon.id, userId } },
      });
      if (existing) return { valid: false, code, reason: 'already_redeemed' };
    }
    return { valid: true, code, coupon };
  }

  async redeemCoupon(code: string, userId: string, paymentId?: string) {
    const v = await this.validateCoupon(code, userId);
    if (!v.valid || !v.coupon) throw new BadRequestException(v.reason || 'invalid coupon');
    const coupon = v.coupon as any;
    // compute discount/credits
    let discountCents: number | undefined;
    let credits: number | undefined;
    if (coupon.type === 'credits') {
      credits = Number(coupon.value);
    } else if (coupon.type === 'fixed') {
      discountCents = Math.round(Number(coupon.value) * 100);
    } else if (coupon.type === 'percent') {
      // percent of a later payment; record as percent value, no immediate credits
      discountCents = undefined;
    }

    const redemption = await this.prisma.$transaction(async (tx) => {
      const r = await tx.couponRedemption.create({
        data: {
          couponId: coupon.id,
          userId,
          discountCents: discountCents ?? null,
          credits: credits ?? null,
        },
      });
      await tx.coupon.update({
        where: { id: coupon.id },
        data: { redemptionCount: { increment: 1 } },
      });
      return r;
    });

    // grant credits immediately for credits-type coupons
    if (coupon.type === 'credits' && credits && credits > 0) {
      await this.credits.grantCredits(userId, credits, `coupon:${code}`);
    }
    return { redemption, coupon, discountCents, credits };
  }

  // ---- Invite codes ----
  async createInviteCode(userId: string, dto: any = {}) {
    const code = genCode('INV');
    const invite = await this.prisma.inviteCode.create({
      data: {
        code,
        inviterUserId: userId,
        maxUses: dto.maxUses ?? null,
        rewardCredits: dto.rewardCredits ?? 0,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        active: true,
      },
    });
    return invite;
  }

  async listInviteCodes(userId: string) {
    return this.prisma.inviteCode.findMany({ where: { inviterUserId: userId }, orderBy: { createdAt: 'desc' } });
  }

  async validateInviteCode(code: string) {
    const invite = await this.prisma.inviteCode.findUnique({ where: { code } });
    if (!invite || !invite.active) return { valid: false, code, reason: 'invalid' };
    if (invite.expiresAt && invite.expiresAt < new Date()) return { valid: false, code, reason: 'expired' };
    if (invite.maxUses && invite.uses >= invite.maxUses) return { valid: false, code, reason: 'exhausted' };
    return { valid: true, code, invite };
  }

  async redeemInviteCode(code: string, inviteeUserId: string) {
    const v = await this.validateInviteCode(code);
    if (!v.valid || !v.invite) throw new BadRequestException(v.reason || 'invalid invite code');
    const invite = v.invite as any;
    if (invite.inviterUserId === inviteeUserId) throw new BadRequestException('cannot redeem own invite');

    // prevent duplicate referral for invitee
    const existing = await this.prisma.referral.findFirst({ where: { inviteeUserId } });
    if (existing) throw new BadRequestException('already referred');

    const referral = await this.prisma.$transaction(async (tx) => {
      const r = await tx.referral.create({
        data: {
          inviterUserId: invite.inviterUserId,
          inviteeUserId,
          inviteCodeId: invite.id,
          status: 'completed',
          rewardCredits: invite.rewardCredits ?? 0,
          completedAt: new Date(),
        },
      });
      await tx.inviteCode.update({
        where: { id: invite.id },
        data: { uses: { increment: 1 } },
      });
      return r;
    });

    // grant reward to inviter
    if (invite.rewardCredits && invite.rewardCredits > 0) {
      try {
        await this.credits.grantCredits(invite.inviterUserId, invite.rewardCredits, `referral:${code}`);
      } catch {
        // ignore
      }
    }
    return referral;
  }

  // ---- Referrals ----
  async listReferrals(userId: string) {
    return this.prisma.referral.findMany({
      where: { inviterUserId: userId },
      orderBy: { createdAt: 'desc' },
      include: { invitee: { select: { id: true, email: true, name: true } } },
    });
  }

  async getReferralStats(userId: string) {
    const referrals = await this.prisma.referral.findMany({ where: { inviterUserId: userId } });
    const total = referrals.length;
    const completed = referrals.filter((r) => r.status === 'completed' || r.status === 'rewarded').length;
    const rewardedCredits = referrals.reduce((acc, r) => acc + (r.rewardCredits || 0), 0);
    return { total, completed, rewardedCredits };
  }
}
