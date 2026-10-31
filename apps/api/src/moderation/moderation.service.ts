import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class ModerationService {
  private readonly logger = new Logger(ModerationService.name);

  constructor(private prisma: PrismaService) {}

  async check(userId: string | null, dto: any, req?: any) {
    const type = (dto?.type || 'text').toString();
    const content = dto?.content ?? dto?.text ?? dto?.url ?? '';
    // Lightweight heuristic mirroring worker fallback; worker is source of truth.
    const banned = ['violence', 'nsfw', 'hate', 'porn', 'gore'];
    const lowered = String(content).toLowerCase();
    const hits = banned.filter((b) => lowered.includes(b));
    const verdict = hits.length ? 'rejected' : 'approved';
    const result = {
      type,
      content: String(content).slice(0, 500),
      verdict,
      score: hits.length ? 1.0 : 0.0,
      categories: hits,
      provider: 'api-heuristic',
    };

    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: 'moderation.check',
          targetType: 'content',
          targetId: dto?.taskId ?? null,
          resourceId: dto?.taskId ?? null,
          resourceType: 'content',
          details: result as any,
          metadata: result as any,
          ip: req?.ip ?? null,
          userAgent: req?.headers?.['user-agent'] ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`audit log failed: ${(err as Error).message}`);
    }

    return result;
  }

  async taskStatus(taskId: string, userId?: string | null, req?: any) {
    const task = await this.prisma.task.findUnique({ where: { id: taskId }, include: { model: true } });
    if (!task) return { taskId, found: false };
    const output = (task.output as any) || {};
    const moderation =
      output?.moderation ||
      task?.stage ||
      (task.status === 'failed' && /moderat/i.test(task.error || '') ? 'rejected' : undefined);
    const result = {
      taskId,
      status: task.status,
      stage: task.stage,
      moderation: moderation ?? 'unknown',
      error: task.error,
    };
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: 'moderation.status',
          targetType: 'task',
          targetId: taskId,
          resourceId: taskId,
          resourceType: 'task',
          details: result as any,
          metadata: result as any,
          ip: req?.ip ?? null,
          userAgent: req?.headers?.['user-agent'] ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`audit log failed: ${(err as Error).message}`);
    }
    return result;
  }

  async appeal(userId: string | null, dto: any, req?: any) {
    const appealUrl = process.env.APPEAL_URL || process.env.MODERATION_APPEAL_URL || '/report-abuse';
    const record = {
      taskId: dto?.taskId ?? null,
      reason: dto?.reason,
      appealUrl,
      status: 'submitted',
    };
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: userId ?? null,
          action: 'moderation.appeal',
          targetType: 'task',
          targetId: dto?.taskId ?? null,
          resourceId: dto?.taskId ?? null,
          resourceType: 'task',
          details: record as any,
          metadata: record as any,
          ip: req?.ip ?? null,
          userAgent: req?.headers?.['user-agent'] ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(`audit log failed: ${(err as Error).message}`);
    }
    return record;
  }
}
