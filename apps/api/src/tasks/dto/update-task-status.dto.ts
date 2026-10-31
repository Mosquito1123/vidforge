import { IsEnum, IsNumber, IsObject, IsOptional, IsString } from 'class-validator';
import { TaskStatus } from '../task-status.enum.js';

export class UpdateTaskStatusDto {
  @IsEnum(TaskStatus)
  status!: TaskStatus;

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsObject()
  output?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsString()
  stage?: string;
}
export class UpdateTaskProgressDto {
  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsString()
  stage?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
