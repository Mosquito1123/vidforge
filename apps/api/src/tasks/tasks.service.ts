import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreditsService } from '../credits/credits.service.js';
import { TasksGateway } from './tasks.gateway.js';
import { TaskStatus, canTransition, TASK_TRANSITIONS } from './task-status.enum.js';
import { resolveTool, type ToolDefinition } from './tool-catalog.js';

function taskWatermarkOf(task: any): boolean {
  if (typeof task?.watermark === 'boolean') return task.watermark;
  if (typeof task?.output?.watermark === 'boolean') return task.output.watermark;
  if (typeof task?.model?.watermark === 'boolean') return task.model.watermark;
  if (typeof task?.model?.metadata?.watermark === 'boolean') return task.model.metadata.watermark;
  if (typeof task?.model?.metadata?.watermarkPolicy === 'boolean') return task.model.metadata.watermarkPolicy;
  return false;
}

function attachTaskWatermark(task: any): any {
  if (!task) return task;
  if (Array.isArray(task)) return task.map(attachTaskWatermark);
  const wm = taskWatermarkOf(task);
  const output =
    task.output && typeof task.output === 'object'
      ? {
          ...task.output,
          watermark: task.output.watermark ?? wm,
          watermarkPolicy: task.output.watermarkPolicy ?? wm,
          watermarked: task.output.watermarked ?? wm,
          hasWatermark: task.output.hasWatermark ?? wm,
        }
      : task.output;
  return {
    ...task,
    watermark: wm,
    watermarkPolicy: wm,
    watermarked: wm,
    hasWatermark: wm,
    output,
  };
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private prisma: PrismaService,
    private credits: CreditsService,
    @Optional() private gateway?: TasksGateway,
  ) {}

  private workerUrl() {
    return (process.env.WORKER_URL || process.env.WORKER_HTTP_URL || 'http://localhost:8000').replace(/\/$/, '');
  }

  private workerToken() {
    return process.env.API_INTERNAL_TOKEN || process.env.WORKER_API_TOKEN || '';
  }

  private async enqueueWorker(task: any, model: any, input: any, priority?: string) {
    const resolution = this.parseResolution(input?.resolution);
    const payload = {
      task_id: task.id,
      user_id: task.userId,
      prompt: input?.prompt ?? input?.negativePrompt ?? '',
      negative_prompt: input?.negativePrompt ?? input?.negative_prompt ?? '',
      duration_seconds: Number(input?.durationSeconds ?? input?.duration_seconds ?? 5) || 5,
      width: resolution.width,
      height: resolution.height,
      fps: 24,
      seed: input?.seed ?? null,
      extra: input?.extra ?? {},
      priority: priority ?? input?.priority ?? 'normal',
      model: model.slug,
    };

    const controller = new AbortController();
    const timeout = Number(process.env.WORKER_TIMEOUT_MS || 10000);
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = this.workerToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${this.workerUrl()}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`worker enqueue failed (${res.status}): ${text}`);
      }

      const data = await res.json().catch(() => ({}));
      return data?.task_id ?? data?.id ?? task.id;
    } catch (err) {
      this.logger.warn(`Failed to enqueue task ${task.id}: ${(err as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseResolution(resolution?: string) {
    if (typeof resolution === 'string') {
      const match = resolution.toLowerCase().match(/(\d+)\s*x\s*(\d+)/);
      if (match) {
        return { width: Number(match[1]), height: Number(match[2]) };
      }
    }
    return { width: 1280, height: 720 };
  }

  private workerTaskId(task: any) {
    const input = task?.input && typeof task.input === 'object' ? task.input : {};
    return (input as any)?._workerTaskId ?? (input as any)?.workerTaskId ?? null;
  }

  private async cancelWorkerTask(task: any) {
    const workerId = this.workerTaskId(task);
    if (!workerId || workerId === task.id) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Number(process.env.WORKER_TIMEOUT_MS || 10000));
    try {
      const headers: Record<string, string> = {};
      const token = this.workerToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      await fetch(`${this.workerUrl()}/tasks/${encodeURIComponent(workerId)}`, {
        method: 'DELETE',
        headers,
        signal: controller.signal,
      });
    } catch (err) {
      this.logger.warn(`Failed to cancel worker task ${workerId}: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
  }

  async create(userId: string, modelIdOrSlug: string, input: any, priority?: string, toolSlug?: string) {
    const tool = resolveTool(toolSlug);

    if (tool.slug !== 'generate') {
      return this.createToolTask(userId, tool, input ?? {});
    }

    const model = await this.prisma.model.findFirst({
      where: { OR: [{ id: modelIdOrSlug }, { slug: modelIdOrSlug }] },
    });
    if (!model) throw new NotFoundException('Model not found');
    if (!model.active) throw new BadRequestException('Model is not active');

    const cost = Number(model.creditsCost);
    const task = await this.prisma.task.create({
      data: {
        userId,
        modelId: model.id,
        tool: tool.slug,
        input: input ?? {},
        status: TaskStatus.QUEUED,
        progress: 0,
        stage: 'queued',
      },
      include: { model: true },
    });

    try {
      await this.credits.spendCredits(userId, cost, `task:${model.slug}`, task.id);
    } catch (err) {
      await this.prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
      throw err;
    }

    const workerTaskId = await this.enqueueWorker(task, model, input ?? {}, priority);

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        input: workerTaskId
          ? { ...( (input ?? {}) as any), _workerTaskId: workerTaskId }
          : (input ?? {}),
      },
      include: { model: true },
    });

    this.gateway?.emitProgress(userId, {
      taskId: task.id,
      userId,
      status: TaskStatus.QUEUED,
      progress: 0,
      stage: 'queued',
    });

    return attachTaskWatermark(updated);
  }

  /**
   * Creates a task for a non-generative tool (edit / watermark removal /
   * voiceover). These have no model row, so the price comes from the tool
   * catalog instead of `Model.creditsCost`.
   */
  private async createToolTask(userId: string, tool: ToolDefinition, input: Record<string, any>) {
    tool.validate?.(input);

    const task = await this.prisma.task.create({
      data: {
        userId,
        modelId: null,
        tool: tool.slug,
        input,
        status: TaskStatus.QUEUED,
        progress: 0,
        stage: 'queued',
      },
    });

    try {
      await this.credits.spendCredits(userId, tool.credits, `tool:${tool.slug}`, task.id);
    } catch (err) {
      await this.prisma.task.delete({ where: { id: task.id } }).catch(() => undefined);
      throw err;
    }

    const workerTaskId = await this.enqueueToolWorker(task, tool, input);

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        input: workerTaskId ? { ...input, _workerTaskId: workerTaskId } : input,
      },
    });

    this.gateway?.emitProgress(userId, {
      taskId: task.id,
      userId,
      status: TaskStatus.QUEUED,
      progress: 0,
      stage: 'queued',
    });

    return attachTaskWatermark(updated);
  }

  private async enqueueToolWorker(task: any, tool: ToolDefinition, input: Record<string, any>) {
    const controller = new AbortController();
    const timeout = Number(process.env.WORKER_TIMEOUT_MS || 10000);
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const token = this.workerToken();
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(`${this.workerUrl()}/tasks`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          task_id: task.id,
          user_id: task.userId,
          tool: tool.slug,
          input,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`worker enqueue failed (${res.status}): ${text}`);
      }

      const data = await res.json().catch(() => ({}));
      return data?.task_id ?? data?.id ?? task.id;
    } catch (err) {
      this.logger.warn(`Failed to enqueue tool task ${task.id}: ${(err as Error).message}`);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  async findAll(userId: string) {
    const rows = await this.prisma.task.findMany({
      where: { userId },
      include: { model: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(attachTaskWatermark);
  }

  async findOne(userId: string, id: string) {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: { model: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return attachTaskWatermark(task);
  }

  async findOneUnsafe(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { model: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return attachTaskWatermark(task);
  }

  async cancel(userId: string, id: string) {
    const task = await this.findOne(userId, id);
    if (!canTransition(task.status as TaskStatus, TaskStatus.CANCELLED)) {
      throw new BadRequestException(`Cannot cancel task in status ${task.status}`);
    }
    await this.cancelWorkerTask(task);

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { status: TaskStatus.CANCELLED, stage: 'cancelled', completedAt: new Date() },
      include: { model: true },
    });
    this.gateway?.emitProgress(userId, {
      taskId: id,
      userId,
      status: TaskStatus.CANCELLED,
      progress: (task as any).progress ?? 0,
      stage: 'cancelled',
    });
    return attachTaskWatermark(updated);
  }

  async retry(userId: string, id: string, priority?: string) {
    const task = await this.findOne(userId, id);
    if (task.status !== TaskStatus.FAILED && task.status !== TaskStatus.CANCELLED) {
      throw new BadRequestException(`Cannot retry task in status ${task.status}`);
    }

    const tool = resolveTool((task as any).tool);
    const model = task.model;
    const cost = model ? Number(model.creditsCost) : tool.credits;
    const reason = model ? `task:${model.slug}:retry` : `tool:${tool.slug}:retry`;
    await this.credits.spendCredits(userId, cost, reason, task.id);

    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: {
        status: TaskStatus.QUEUED,
        progress: 0,
        stage: 'queued',
        error: null,
        startedAt: null,
        completedAt: null,
        output: null as any,
      },
      include: { model: true },
    });

    const workerTaskId = model
      ? await this.enqueueWorker(updated, model, task.input ?? {}, priority)
      : await this.enqueueToolWorker(updated, tool, (task.input ?? {}) as Record<string, any>);
    if (workerTaskId) {
      await this.prisma.task.update({
        where: { id: task.id },
        data: { input: { ...((task.input ?? {}) as any), _workerTaskId: workerTaskId } },
      });
    }

    this.gateway?.emitProgress(userId, {
      taskId: id,
      userId,
      status: TaskStatus.QUEUED,
      progress: 0,
      stage: 'queued',
    });

    return this.findOne(userId, id);
  }

  async updateStatus(
    id: string,
    status: string,
    progress?: number,
    output?: any,
    error?: string,
    stage?: string,
  ) {
    const task = await this.findOneUnsafe(id);
    const nextStatus = status as TaskStatus;
    if (!Object.values(TaskStatus).includes(nextStatus)) {
      throw new BadRequestException(`Invalid status ${status}`);
    }
    if (task.status !== nextStatus && !canTransition(task.status as TaskStatus, nextStatus)) {
      if (task.status !== nextStatus) {
        throw new BadRequestException(`Invalid transition ${task.status} -> ${nextStatus}`);
      }
    }

    const data: any = { status: nextStatus };
    if (typeof progress === 'number') data.progress = progress;
    if (output !== undefined) {
      const wm = taskWatermarkOf(task);
      data.output =
        output && typeof output === 'object'
          ? {
              ...output,
              watermark: (output as any).watermark ?? wm,
              watermarkPolicy: (output as any).watermarkPolicy ?? wm,
              watermarked: (output as any).watermarked ?? wm,
              hasWatermark: (output as any).hasWatermark ?? wm,
            }
          : output;
    }
    if (error !== undefined) data.error = error;
    if (stage !== undefined) data.stage = stage;
    else data.stage = nextStatus;

    if (nextStatus === TaskStatus.RUNNING && !task.startedAt) {
      data.startedAt = new Date();
    }
    if (nextStatus === TaskStatus.DONE || nextStatus === TaskStatus.FAILED || nextStatus === TaskStatus.CANCELLED) {
      data.completedAt = new Date();
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data,
      include: { model: true },
    });

    this.gateway?.emitProgress(updated.userId, {
      taskId: id,
      userId: updated.userId,
      status: nextStatus,
      progress: updated.progress,
      stage: updated.stage,
      output: updated.output,
      error: updated.error,
    });

    // Auto-refund credits on task failure
    if (nextStatus === TaskStatus.FAILED) {
      try {
        const catalogEntry = resolveTool((updated as any)?.tool ?? (task as any)?.tool);
        const modelCost = Number(updated?.model?.creditsCost ?? task?.model?.creditsCost ?? 0);
        const cost = (updated as any)?.modelId ? modelCost : catalogEntry.credits;
        if (Number.isFinite(cost) && cost > 0) {
          await this.credits.refundCredits(updated.userId, cost, 'task_failed_refund', updated.id, `taskfail:${updated.id}`);
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-refund task ${id}: ${(err as Error).message}`);
      }
    }

    return attachTaskWatermark(updated);
  }

  async updateProgress(id: string, progress: number, stage?: string, status?: string) {
    const task = await this.findOneUnsafe(id);
    const nextStatus = (status as TaskStatus) || (task.status as TaskStatus);
    return this.updateStatus(id, nextStatus, progress, undefined, undefined, stage);
  }

  async transition(id: string, toStatus: string, data?: { progress?: number; output?: any; error?: string; stage?: string }) {
    return this.updateStatus(id, toStatus, data?.progress, data?.output, data?.error, data?.stage);
  }

  async markQueued(id: string, progress = 0) {
    return this.updateStatus(id, TaskStatus.QUEUED, progress, undefined, undefined, 'queued');
  }

  async markRunning(id: string, progress = 0) {
    return this.updateStatus(id, TaskStatus.RUNNING, progress, undefined, undefined, 'running');
  }

  async markPostProcessing(id: string, progress = 60) {
    return this.updateStatus(id, TaskStatus.POST_PROCESSING, progress, undefined, undefined, 'post_processing');
  }

  async markDone(id: string, output?: any, progress = 100) {
    return this.updateStatus(id, TaskStatus.DONE, progress, output, undefined, 'done');
  }

  async markFailed(id: string, error: string, progress?: number) {
    return this.updateStatus(id, TaskStatus.FAILED, progress, undefined, error, 'failed');
  }

  getAllowedTransitions(status: string) {
    return TASK_TRANSITIONS[status as TaskStatus] ?? [];
  }

  async updateTaskStatus(id: string, status: string, progress?: number, output?: any, error?: string, stage?: string) {
    return this.updateStatus(id, status, progress, output, error, stage);
  }

  async setStatus(id: string, status: string, progress?: number, output?: any, error?: string, stage?: string) {
    return this.updateStatus(id, status, progress, output, error, stage);
  }

  async setProgress(id: string, progress: number, stage?: string, status?: string) {
    return this.updateProgress(id, progress, stage, status);
  }

  async reportProgress(id: string, progress: number, stage?: string, status?: string) {
    return this.updateProgress(id, progress, stage, status);
  }

  // Aliases
  async createTask(...args: any[]) {
    return this.create(args[0], args[1], args[2], args[3]);
  }

  async retryTask(userId: string, id: string, priority?: string) {
    return this.retry(userId, id, priority);
  }

  async retryById(id: string, userId?: string, priority?: string) {
    if (userId) return this.retry(userId, id, priority);
    const task = await this.findOneUnsafe(id);
    return this.retry(task.userId, id, priority);
  }
}
