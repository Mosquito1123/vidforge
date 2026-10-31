export type ModelProvider = "openai" | "runway" | "kling" | "pika" | "luma" | "local" | "custom";

export type ModelKind = "text-to-video" | "image-to-video" | "video-to-video" | "upscale" | "audio" | "image";

export interface ModelPricing {
  creditsPerSecond?: number;
  creditsPerRun?: number;
  creditsPerMegapixel?: number;
}

export interface ModelParameter {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  default?: unknown;
  options?: string[];
  min?: number;
  max?: number;
  description?: string;
}

export interface Model {
  id: string;
  name: string;
  slug: string;
  provider: ModelProvider;
  kind: ModelKind;
  description: string | null;
  version: string;
  isActive: boolean;
  parameters: ModelParameter[];
  pricing: ModelPricing;
  maxDurationSeconds: number;
  maxResolution: string;
  createdAt: string;
  updatedAt: string;
  // Watermark policy flag for free outputs
  watermark?: boolean;
  watermarkPolicy?: boolean;
  watermarked?: boolean;
  hasWatermark?: boolean;
}