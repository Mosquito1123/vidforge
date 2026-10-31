import { IsEnum, IsObject, IsOptional, IsString } from 'class-validator';

export enum TaskPriorityDto {
  low = 'low',
  normal = 'normal',
  high = 'high',
  urgent = 'urgent',
}

export class TaskInputDto {
  @IsOptional()
  @IsString()
  prompt?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  videoUrl?: string;

  @IsOptional()
  durationSeconds?: number;

  @IsOptional()
  @IsString()
  resolution?: string;

  @IsOptional()
  @IsString()
  aspectRatio?: string;

  @IsOptional()
  seed?: number;

  @IsOptional()
  @IsObject()
  extra?: Record<string, unknown>;
}

export class CreateTaskDto {
  @IsOptional()
  @IsString()
  modelId?: string;

  @IsOptional()
  @IsString()
  model?: string;

  /** Tool pipeline: generate (default), video-edit, watermark-removal, voiceover. */
  @IsOptional()
  @IsString()
  tool?: string;

  @IsObject()
  input!: TaskInputDto;

  @IsOptional()
  @IsEnum(TaskPriorityDto)
  priority?: TaskPriorityDto;
}
