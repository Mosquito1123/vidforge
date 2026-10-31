import { Injectable } from '@nestjs/common';

export interface PhoneBinding {
  userId: string;
  phone: string;
  verifiedAt: Date;
  updatedAt: Date;
}

/**
 * Authoritative phone-binding store.
 *
 * Kept dependency-free (no Prisma, no SMS) so the risk engine can read a
 * user's verified phone without creating a module cycle.
 */
@Injectable()
export class PhoneStore {
  private readonly byPhone = new Map<string, PhoneBinding>();
  private readonly byUser = new Map<string, PhoneBinding>();

  findByPhone(phone: string): PhoneBinding | null {
    return this.byPhone.get(phone) ?? null;
  }

  findByUserId(userId: string): PhoneBinding | null {
    return this.byUser.get(userId) ?? null;
  }

  isBoundToOther(phone: string, userId: string): boolean {
    const existing = this.byPhone.get(phone);
    return Boolean(existing && existing.userId !== userId);
  }

  bind(userId: string, phone: string): PhoneBinding {
    const previous = this.byUser.get(userId);
    if (previous) this.byPhone.delete(previous.phone);

    const now = new Date();
    const binding: PhoneBinding = {
      userId,
      phone,
      verifiedAt: now,
      updatedAt: now,
    };
    this.byPhone.set(phone, binding);
    this.byUser.set(userId, binding);
    return binding;
  }

  unbind(userId: string): boolean {
    const existing = this.byUser.get(userId);
    if (!existing) return false;
    this.byUser.delete(userId);
    if (this.byPhone.get(existing.phone)?.userId === userId) {
      this.byPhone.delete(existing.phone);
    }
    return true;
  }

  all(): PhoneBinding[] {
    return Array.from(this.byPhone.values());
  }
}
