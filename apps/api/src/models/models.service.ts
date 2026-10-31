import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

function watermarkOf(model: any): boolean {
  if (typeof model?.watermark === 'boolean') return model.watermark;
  if (typeof model?.metadata?.watermark === 'boolean') return model.metadata.watermark;
  if (typeof model?.metadata?.watermarkPolicy === 'boolean') return model.metadata.watermarkPolicy;
  if (typeof model?.metadata?.watermarked === 'boolean') return model.metadata.watermarked;
  if (typeof model?.metadata?.hasWatermark === 'boolean') return model.metadata.hasWatermark;
  return false;
}

function attachWatermark(model: any) {
  if (!model) return model;
  const wm = watermarkOf(model);
  return {
    ...model,
    watermark: wm,
    watermarkPolicy: wm,
    watermarked: wm,
    hasWatermark: wm,
  };
}

@Injectable()
export class ModelsService {
  constructor(private prisma: PrismaService) {}

  async findAll(activeOnly = true) {
    const rows = await this.prisma.model.findMany({
      where: activeOnly ? { active: true } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(attachWatermark);
  }

  async findOne(idOrSlug: string) {
    const model = await this.prisma.model.findFirst({
      where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    });
    if (!model) throw new NotFoundException('Model not found');
    return attachWatermark(model);
  }

  async create(data: any) {
    const { watermark, watermarkPolicy, watermarked, hasWatermark, ...rest } = data ?? {};
    const wm = watermark ?? watermarkPolicy ?? watermarked ?? hasWatermark;
    const metadata = { ...(rest.metadata || {}), ...(wm === undefined ? {} : { watermark: !!wm, watermarkPolicy: !!wm, watermarked: !!wm, hasWatermark: !!wm }) };
    const created = await this.prisma.model.create({ data: { ...rest, metadata } });
    return attachWatermark(created);
  }

  async update(id: string, data: any) {
    await this.findOne(id);
    const { watermark, watermarkPolicy, watermarked, hasWatermark, ...rest } = data ?? {};
    const wm = watermark ?? watermarkPolicy ?? watermarked ?? hasWatermark;
    const patch: any = { ...rest };
    if (wm !== undefined) {
      const existing = await this.prisma.model.findUnique({ where: { id } });
      const baseMeta = (existing?.metadata as any) || {};
      patch.metadata = { ...baseMeta, ...(rest.metadata || {}), watermark: !!wm, watermarkPolicy: !!wm, watermarked: !!wm, hasWatermark: !!wm };
    } else if (rest.metadata) {
      patch.metadata = rest.metadata;
    }
    const updated = await this.prisma.model.update({ where: { id }, data: patch });
    return attachWatermark(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.model.delete({ where: { id } });
  }
}