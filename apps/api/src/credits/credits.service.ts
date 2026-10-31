import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Transaction, TransactionType } from '@prisma/client';

interface ParsedCreditArgs {
  userId: string;
  amount: number;
  reason: string;
  taskId?: string;
  idempotencyKey?: string;
}

@Injectable()
export class CreditsService {
  constructor(private prisma: PrismaService) {}

  private parseArgs(...raw: any[]): ParsedCreditArgs {
    const [userIdOrDto, amount, reason, taskId, idempotencyKey] = raw;
    if (userIdOrDto && typeof userIdOrDto === 'object' && !Array.isArray(userIdOrDto)) {
      const dto = userIdOrDto;
      return {
        userId: dto.userId ?? dto.user ?? dto.id,
        amount: dto.amount ?? amount,
        reason: dto.reason ?? reason ?? 'credit',
        taskId: dto.taskId ?? dto.task ?? taskId,
        idempotencyKey: dto.idempotencyKey ?? dto.idempotency ?? dto.key ?? idempotencyKey,
      };
    }

    if (amount && typeof amount === 'object' && !Array.isArray(amount)) {
      const opts = amount;
      return {
        userId: userIdOrDto,
        amount: opts.amount ?? 0,
        reason: opts.reason ?? reason ?? 'credit',
        taskId: opts.taskId ?? opts.task ?? taskId,
        idempotencyKey: opts.idempotencyKey ?? opts.idempotency ?? opts.key ?? idempotencyKey,
      };
    }

    if (reason && typeof reason === 'object' && !Array.isArray(reason)) {
      const opts = reason;
      return {
        userId: userIdOrDto,
        amount: amount ?? opts.amount ?? 0,
        reason: opts.reason ?? 'credit',
        taskId: opts.taskId ?? opts.task ?? taskId,
        idempotencyKey: opts.idempotencyKey ?? opts.idempotency ?? opts.key ?? idempotencyKey,
      };
    }

    if (taskId && typeof taskId === 'object' && !Array.isArray(taskId)) {
      const opts = taskId;
      return {
        userId: userIdOrDto,
        amount: amount ?? 0,
        reason: reason ?? opts.reason ?? 'credit',
        taskId: opts.taskId ?? opts.task,
        idempotencyKey: opts.idempotencyKey ?? opts.idempotency ?? opts.key ?? idempotencyKey,
      };
    }

    if (idempotencyKey && typeof idempotencyKey === 'object' && !Array.isArray(idempotencyKey)) {
      const opts = idempotencyKey;
      return {
        userId: userIdOrDto,
        amount: amount ?? 0,
        reason: reason ?? opts.reason ?? 'credit',
        taskId: taskId ?? opts.taskId ?? opts.task,
        idempotencyKey: opts.idempotencyKey ?? opts.idempotency ?? opts.key,
      };
    }

    return {
      userId: userIdOrDto,
      amount: amount ?? 0,
      reason: reason ?? 'credit',
      taskId,
      idempotencyKey,
    };
  }

  private storedReason(reason: string, idempotencyKey?: string) {
    return idempotencyKey ? `${reason}\u0000${idempotencyKey}` : reason;
  }

  private restoreReason(tx: Transaction, originalReason: string): Transaction {
    return { ...tx, reason: originalReason } as Transaction;
  }

  async getOrCreateAccount(userId: string) {
    let account = await this.prisma.creditAccount.findUnique({ where: { userId } });
    if (account) return account;
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.creditAccount.create({ data: { userId, balance: 0 } });
  }

  async getAccount(userId: string) {
    let account = await this.prisma.creditAccount.findUnique({
      where: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!account) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new NotFoundException('User not found');
      const created = await this.prisma.creditAccount.create({ data: { userId, balance: 0 } });
      account = await this.prisma.creditAccount.findUnique({
        where: { id: created.id },
        include: { transactions: { orderBy: { createdAt: 'desc' }, take: 20 } },
      });
    }
    if (!account) throw new NotFoundException('Credit account not found');
    return account;
  }

  async getBalance(userId: string) {
    const account = await this.getOrCreateAccount(userId);
    return Number(account.balance);
  }

  async listTransactions(userId: string) {
    const account = await this.getOrCreateAccount(userId);
    return this.prisma.transaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
    });
  }

  async grantCredits(...args: any[]): Promise<Transaction> {
    const { userId, amount, reason, taskId, idempotencyKey } = this.parseArgs(...args);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }
    const stored = this.storedReason(reason, idempotencyKey);

    return this.prisma.$transaction(async (tx) => {
      let account = await tx.creditAccount.findUnique({ where: { userId } });
      if (!account) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        account = await tx.creditAccount.create({ data: { userId, balance: 0 } });
      }

      if (idempotencyKey) {
        const existing = await tx.transaction.findFirst({
          where: { accountId: account.id, type: TransactionType.CREDIT, reason: stored },
        });
        if (existing) return this.restoreReason(existing, reason);
      }

      const newBalance = Number(account.balance) + amount;
      await tx.creditAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });
      const created = await tx.transaction.create({
        data: {
          accountId: account.id,
          type: TransactionType.CREDIT,
          amount,
          reason: stored,
          taskId: taskId ?? null,
          balanceAfter: newBalance,
        },
      });
      return this.restoreReason(created, reason);
    });
  }

  async spendCredits(...args: any[]): Promise<Transaction> {
    const { userId, amount, reason, taskId, idempotencyKey } = this.parseArgs(...args);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException('Amount must be a positive number');
    }
    // auto-refill before attempting to spend
    try {
      const settings = this.getAutoRefillSettings(userId);
      if (settings.enabled) {
        const balance = await this.getBalance(userId);
        if (balance <= settings.threshold) {
          await this.tryAutoRefill(userId);
        }
      }
    } catch {
      // ignore auto-refill failures
    }
    const stored = this.storedReason(reason, idempotencyKey);

    return this.prisma.$transaction(async (tx) => {
      let account = await tx.creditAccount.findUnique({ where: { userId } });
      if (!account) {
        const user = await tx.user.findUnique({ where: { id: userId } });
        if (!user) throw new NotFoundException('User not found');
        account = await tx.creditAccount.create({ data: { userId, balance: 0 } });
      }

      if (idempotencyKey) {
        const existing = await tx.transaction.findFirst({
          where: { accountId: account.id, type: TransactionType.DEBIT, reason: stored },
        });
        if (existing) return this.restoreReason(existing, reason);
      }

      if (Number(account.balance) < amount) {
        throw new BadRequestException('Insufficient credits');
      }

      const newBalance = Number(account.balance) - amount;
      await tx.creditAccount.update({
        where: { id: account.id },
        data: { balance: newBalance },
      });
      const created = await tx.transaction.create({
        data: {
          accountId: account.id,
          type: TransactionType.DEBIT,
          amount,
          reason: stored,
          taskId: taskId ?? null,
          balanceAfter: newBalance,
        },
      });
      return this.restoreReason(created, reason);
    });
  }

  async refundCredits(...args: any[]): Promise<Transaction> {
    const parsed = this.parseArgs(...args);
    const reason = parsed.reason || 'refund';
    return this.grantCredits(parsed.userId, parsed.amount, reason, parsed.taskId, parsed.idempotencyKey);
  }

  // Aliases
  async addCredits(...args: any[]) {
    return this.grantCredits(...(args as any[]));
  }

  async consumeCredits(...args: any[]) {
    return this.spendCredits(...args);
  }

  async credit(...args: any[]) {
    return this.grantCredits(...(args as any[]));
  }

  async debit(...args: any[]) {
    return this.spendCredits(...args);
  }

  async topup(userId: string, amount: number, reason = 'topup', idempotencyKey?: string) {
    return this.grantCredits(userId, amount, reason, undefined, idempotencyKey);
  }

  // --- Auto-refill settings & logic ---
  private autoRefillSettings = new Map<string, { enabled: boolean; threshold: number; amount: number; packageId?: string | null; updatedAt?: string }>();

  getAutoRefillSettings(userId: string) {
    const s = this.autoRefillSettings.get(userId);
    if (s) return s;
    return { enabled: false, threshold: 0, amount: 0, packageId: null, updatedAt: undefined };
  }

  updateAutoRefillSettings(userId: string, dto: any) {
    const prev = this.getAutoRefillSettings(userId);
    const next = {
      enabled: dto?.enabled ?? prev.enabled ?? false,
      threshold: dto?.threshold ?? prev.threshold ?? 0,
      amount: dto?.amount ?? prev.amount ?? 0,
      packageId: dto?.packageId !== undefined ? dto.packageId : prev.packageId ?? null,
      updatedAt: new Date().toISOString(),
    };
    this.autoRefillSettings.set(userId, next);
    return next;
  }

  async tryAutoRefill(userId: string) {
    const settings = this.getAutoRefillSettings(userId);
    if (!settings.enabled) return { refilled: false, reason: 'disabled' };
    const balance = await this.getBalance(userId);
    if (balance > settings.threshold) return { refilled: false, reason: 'above_threshold', balance };
    let credits = Number(settings.amount) || 0;
    let pkg: any = null;
    if (settings.packageId) {
      try {
        pkg = await this.prisma.creditPackage.findUnique({ where: { id: settings.packageId } });
      } catch {
        pkg = null;
      }
      if (pkg && pkg.active) {
        credits = Number(pkg.credits) || credits;
      }
    }
    if (!Number.isFinite(credits) || credits <= 0) return { refilled: false, reason: 'invalid_amount' };

    const tx = await this.grantCredits(userId, credits, 'auto_refill', undefined, `autorefill:${userId}:${Date.now()}`);
    // record a succeeded payment for accounting (best effort)
    try {
      await this.prisma.payment.create({
        data: {
          userId,
          type: 'credit_purchase' as any,
          provider: 'stripe' as any,
          amountCents: pkg ? Number(pkg.priceCents) : Math.round(credits),
          currency: 'usd',
          status: 'succeeded' as any,
          credits,
          metadata: { autoRefill: true },
        },
      });
    } catch {
      // ignore
    }
    return { refilled: true, credits, transaction: tx };
  }

  async refillIfNeeded(userId: string) {
    return this.tryAutoRefill(userId);
  }
}
