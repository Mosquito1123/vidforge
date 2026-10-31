import { BadRequestException } from '@nestjs/common';

export type ToolSlug = 'generate' | 'video-edit' | 'watermark-removal' | 'voiceover';

export type ToolDefinition = {
  slug: ToolSlug;
  credits: number;
  /** Accepts the tool input payload and throws BadRequestException when invalid. */
  validate?: (input: Record<string, any>) => void;
};

function price(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function requireField(input: Record<string, any>, field: string, message: string) {
  const value = input?.[field];
  if (value === undefined || value === null || value === '') {
    throw new BadRequestException(message);
  }
}

function validateEdit(input: Record<string, any>) {
  const clips = input.clips;
  if (!Array.isArray(clips) || clips.length === 0) {
    throw new BadRequestException('At least one clip is required');
  }
  if (clips.length > 6) {
    throw new BadRequestException('At most 6 clips can be merged');
  }
  for (const clip of clips) {
    if (typeof clip !== 'string' || !clip.trim()) {
      throw new BadRequestException('Each clip must be a media URL');
    }
  }
}

function validateWatermark(input: Record<string, any>) {
  requireField(input, 'sourceUrl', 'A source video is required');
  const region = input.region ?? {};
  const numeric = ['x', 'y', 'width', 'height'].every(
    (key) => typeof region[key] === 'number' && Number.isFinite(region[key]),
  );
  if (!numeric) {
    throw new BadRequestException('Watermark region requires numeric x, y, width and height');
  }
  if (region.width <= 0 || region.height <= 0) {
    throw new BadRequestException('Watermark region must have a positive size');
  }
}

function validateVoiceover(input: Record<string, any>) {
  requireField(input, 'script', 'A narration script is required');
  const script = String(input.script).trim();
  if (script.length < 2) throw new BadRequestException('Narration script is too short');
  if (script.length > 5000) throw new BadRequestException('Narration script is too long');
}

/**
 * Catalog of non-generative AI video tools. Prices are in credits and can be
 * overridden per deployment with environment variables.
 */
export const TOOL_CATALOG: Record<ToolSlug, ToolDefinition> = {
  generate: { slug: 'generate', credits: 0 },
  'video-edit': {
    slug: 'video-edit',
    credits: price('TOOL_PRICE_VIDEO_EDIT', 12),
    validate: validateEdit,
  },
  'watermark-removal': {
    slug: 'watermark-removal',
    credits: price('TOOL_PRICE_WATERMARK_REMOVAL', 15),
    validate: validateWatermark,
  },
  voiceover: {
    slug: 'voiceover',
    credits: price('TOOL_PRICE_VOICEOVER', 18),
    validate: validateVoiceover,
  },
};

export function resolveTool(value?: string | null): ToolDefinition {
  const slug = (value || 'generate').toLowerCase().trim() as ToolSlug;
  const tool = TOOL_CATALOG[slug];
  if (!tool) {
    throw new BadRequestException(`Unknown tool: ${value}`);
  }
  return tool;
}
