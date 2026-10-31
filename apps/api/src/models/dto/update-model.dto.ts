import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateModelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsNumber()
  creditsCost?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  watermark?: boolean;

  @IsOptional()
  @IsBoolean()
  watermarkPolicy?: boolean;

  @IsOptional()
  @IsBoolean()
  watermarked?: boolean;

  @IsOptional()
  @IsBoolean()
  hasWatermark?: boolean;
}
