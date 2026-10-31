import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreditsService } from '../credits/credits.service.js';
import { TasksService } from '../tasks/tasks.service.js';
import { ModelsService } from '../models/models.service.js';
import { PaymentsService } from '../payments/payments.service.js';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    private tasks: TasksService,
    private models: ModelsService,
    private payments: PaymentsService,
  ) {}

  private pageParams(dto: any) {
    const page = Math.max(1, Number(dto?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(dto?.limit) || 20));
    return { skip: (page - 1) * limit, take: limit, page, limit };
  }

  // ---- Users ----
  async listUsers(dto: any = {}) {
    const { skip, take, page, limit } = this.pageParams(dto);
    const where: any = {};
    const and: any[] = [];
    if (dto?.search) {
      and.push({
        OR: [
          { email: { contains: dto.search, mode: 'insensitive' } },
          { name: { contains: dto.search, mode: 'insensitive' } },
        ],
      });
    }
    if (dto?.status === 'banned') {
      and.push({ OR: [{ banned: true }, { isBanned: true }] });
    } else if (dto?.status === 'active') {
      and.push({ banned: false, isBanned: false });
    }
    if (and.length) where.AND = and;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          adminRole: true,
          isAdmin: true,
          banned: true,
          isBanned: true,
          bannedAt: true,
          banReason: true,
          createdAt: true,
          updatedAt: true,
          creditAccount: { select: { balance: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async getUser(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { creditAccount: true, tasks: { take: 10, orderBy: { createdAt: 'desc' } } },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async banUser(id: string, reason?: string, actorId?: string, req?: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        banned: true,
        isBanned: true,
        bannedAt: new Date(),
        banReason: reason ?? null,
      },
    });
    await this.audit(actorId ?? null, 'user.ban', 'user', id, { reason }, req);
    return updated;
  }

  async unbanUser(id: string, actorId?: string, req?: any) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        banned: false,
        isBanned: false,
        bannedAt: null,
        banReason: null,
      },
    });
    await this.audit(actorId ?? null, 'user.unban', 'user', id, {}, req);
    return updated;
  }

  async adjustCredits(userId: string, amount: number, reason?: string, actorId?: string, idempotencyKey?: string, req?: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    const r = reason || 'admin_adjust';
    let tx: any = null;
    if (amount > 0) {
      tx = await this.credits.grantCredits(userId, amount, r, undefined, idempotencyKey);
    } else if (amount < 0) {
      tx = await this.credits.spendCredits(userId, -amount, r, undefined, idempotencyKey);
    }
    const balance = await this.credits.getBalance(userId);
    await this.audit(actorId ?? null, 'credits.adjust', 'user', userId, { amount, reason: r }, req);
    return { userId, amount, balance, transaction: tx };
  }

  // ---- Tasks ----
  async listTasks(dto: any = {}) {
    const { skip, take, page, limit } = this.pageParams(dto);
    const where: any = {};
    if (dto?.status) where.status = dto.status;
    if (dto?.userId) where.userId = dto.userId;
    const [items, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { model: true, user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.task.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async retryTask(id: string, actorId?: string, req?: any) {
    const task = await this.tasks.findOneUnsafe(id);
    const updated = await this.tasks.retryById(id);
    await this.audit(actorId ?? null, 'task.retry', 'task', id, { userId: task.userId }, req);
    return updated;
  }

  async cancelTask(id: string, actorId?: string, req?: any) {
    const task = await this.tasks.findOneUnsafe(id);
    const updated = await this.tasks.cancel(task.userId, id);
    await this.audit(actorId ?? null, 'task.cancel', 'task', id, { userId: task.userId }, req);
    return updated;
  }

  // ---- Models (CRUD) ----
  async listModels(all = true) {
    return this.models.findAll(all);
  }

  async getModel(id: string) {
    return this.models.findOne(id);
  }

  async createModel(data: any, actorId?: string, req?: any) {
    const created = await this.models.create(data);
    await this.audit(actorId ?? null, 'model.create', 'model', (created as any)?.id, data, req);
    return created;
  }

  async updateModel(id: string, data: any, actorId?: string, req?: any) {
    const updated = await this.models.update(id, data);
    await this.audit(actorId ?? null, 'model.update', 'model', id, data, req);
    return updated;
  }

  async deleteModel(id: string, actorId?: string, req?: any) {
    const deleted = await this.models.remove(id);
    await this.audit(actorId ?? null, 'model.delete', 'model', id, {}, req);
    return deleted;
  }

  // ---- Refunds approval ----
  async listRefunds(dto: any = {}) {
    const { skip, take, page, limit } = this.pageParams(dto);
    const where: any = {};
    if (dto?.status) where.status = dto.status;
    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { payment: { include: { user: { select: { id: true, email: true, name: true } } } } },
      }),
      this.prisma.refund.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async listPayments(dto: any = {}) {
    const { skip, take, page, limit } = this.pageParams(dto);
    const where: any = {};
    if (dto?.userId) where.userId = dto.userId;
    if (dto?.status) where.status = dto.status;
    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } }, refunds: true },
      }),
      this.prisma.payment.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async refundPayment(dto: any, actorId?: string, req?: any) {
    const payment = await this.prisma.payment.findUnique({ where: { id: dto.paymentId } });
    if (!payment) throw new NotFoundException('Payment not found');
    const refund = await this.payments.refund(payment.userId, dto, true);
    await this.audit(actorId ?? null, 'refund.process', 'payment', payment.id, { amountCents: dto.amountCents, reason: dto.reason }, req);
    return refund;
  }

  async approveRefund(id: string, actorId?: string, req?: any) {
    const refund = await this.prisma.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException('Refund not found');
    if (refund.status === 'rejected') throw new BadRequestException('Refund already rejected');
    const updated = await this.prisma.refund.update({ where: { id }, data: { status: 'succeeded' } });
    await this.audit(actorId ?? null, 'refund.approve', 'refund', id, {}, req);
    return updated;
  }

  async rejectRefund(id: string, reason?: string, actorId?: string, req?: any) {
    const refund = await this.prisma.refund.findUnique({ where: { id } });
    if (!refund) throw new NotFoundException('Refund not found');
    const updated = await this.prisma.refund.update({ where: { id }, data: { status: 'rejected', reason: reason ?? refund.reason } });
    await this.audit(actorId ?? null, 'refund.reject', 'refund', id, { reason }, req);
    return updated;
  }

  // ---- Audit logs ----
  async listAuditLogs(dto: any = {}) {
    const { skip, take, page, limit } = this.pageParams(dto);
    const where: any = {};
    if (dto?.userId) where.userId = dto.userId;
    if (dto?.action) where.action = dto.action;
    if (dto?.targetId) where.targetId = dto.targetId;
    if (dto?.targetType) where.targetType = dto.targetType;
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { id: true, email: true, name: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async createAuditLog(data: any, actorId?: string, req?: any) {
    return this.prisma.auditLog.create({
      data: {
        userId: actorId ?? data?.userId ?? null,
        action: data?.action ?? 'admin.action',
        targetType: data?.targetType ?? data?.resourceType ?? null,
        targetId: data?.targetId ?? data?.resourceId ?? null,
        resourceId: data?.resourceId ?? data?.targetId ?? null,
        resourceType: data?.resourceType ?? data?.targetType ?? null,
        details: data?.details ?? null,
        metadata: data?.metadata ?? null,
        ip: req?.ip ?? data?.ip ?? null,
        userAgent: req?.headers?.['user-agent'] ?? data?.userAgent ?? null,
      },
    });
  }

  // ---- Aliases for compatibility ----
  async getUsers(dto: any = {}) { return this.listUsers(dto); }
  async searchUsers(dto: any = {}) { return this.listUsers(dto); }
  async ban(id: string, reason?: string, actorId?: string, req?: any) { return this.banUser(id, reason, actorId, req); }
  async unban(id: string, actorId?: string, req?: any) { return this.unbanUser(id, actorId, req); }
  async adjustUserCredits(userId: string, amount: number, reason?: string, actorId?: string, idempotencyKey?: string, req?: any) {
    return this.adjustCredits(userId, amount, reason, actorId, idempotencyKey, req);
  }
  async getTasks(dto: any = {}) { return this.listTasks(dto); }
  async retry(id: string, actorId?: string, req?: any) { return this.retryTask(id, actorId, req); }
  async cancel(id: string, actorId?: string, req?: any) { return this.cancelTask(id, actorId, req); }
  async getModels(all = true) { return this.listModels(all); }
  async removeModel(id: string, actorId?: string, req?: any) { return this.deleteModel(id, actorId, req); }
  async getRefunds(dto: any = {}) { return this.listRefunds(dto); }
  async getPayments(dto: any = {}) { return this.listPayments(dto); }
  async processRefund(dto: any, actorId?: string, req?: any) { return this.refundPayment(dto, actorId, req); }
  async getAuditLogs(dto: any = {}) { return this.listAuditLogs(dto); }
  async log(data: any, actorId?: string, req?: any) { return this.createAuditLog(data, actorId, req); }

  async audit(actorId: string | null, action: string, targetType: string, targetId: string, metadata?: any, req?: any) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: actorId,
          action,
          targetType,
          targetId,
          metadata: metadata ?? null,
          ip: req?.ip ?? null,
          userAgent: req?.headers?.['user-agent'] ?? null,
        },
      });
    } catch {
      // never fail main action due to audit
    }
  }
}