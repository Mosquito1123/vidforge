export type TaskStatus =
  | "queued"
  | "running"
  | "post_processing"
  | "done"
  | "failed"
  | "cancelled";

export type TaskPriority = "low" | "normal" | "high" | "urgent";

export interface TaskInput {
  prompt?: string;
  imageUrl?: string;
  videoUrl?: string;
  durationSeconds?: number;
  resolution?: string;
  aspectRatio?: string;
  seed?: number;
  extra?: Record<string, unknown>;
}

export interface TaskOutput {
  url?: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
  resolution?: string;
  metadata?: Record<string, unknown>;
  // Watermark policy flag for free outputs
  watermark?: boolean;
  watermarked?: boolean;
  watermarkPolicy?: boolean;
  hasWatermark?: boolean;
}

export interface Task {
  id: string;
  userId: string;
  modelId: string;
  status: TaskStatus;
  priority: TaskPriority;
  input: TaskInput;
  output: TaskOutput | null;
  errorMessage: string | null;
  creditsCost: number;
  progress: number;
  stage: string | null;
  retryCount: number;
  maxRetries: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  // Watermark policy flag for free outputs
  watermark?: boolean;
  watermarkPolicy?: boolean;
  watermarked?: boolean;
  hasWatermark?: boolean;
}

export interface TaskProgressEvent {
  taskId: string;
  userId?: string;
  status: TaskStatus;
  progress: number;
  stage?: string | null;
  message?: string | null;
  output?: TaskOutput | null;
  error?: string | null;
  timestamp?: string;
}

export interface TaskCreateRequest {
  modelId: string;
  input: TaskInput;
  priority?: TaskPriority;
}

export interface TaskListQuery {
  status?: TaskStatus;
  modelId?: string;
  limit?: number;
  cursor?: string;
}