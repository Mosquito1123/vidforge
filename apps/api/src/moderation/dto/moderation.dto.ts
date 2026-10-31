import { IsOptional, IsString, IsIn } from 'class-validator';

export class ModerationCheckDto {
  @IsOptional()
  @IsString()
  type?: 'text' | 'image' | 'video' | 'media';

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsString()
  url?: string;
}

export class ModerationAppealDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsString()
  reason: string;
}
