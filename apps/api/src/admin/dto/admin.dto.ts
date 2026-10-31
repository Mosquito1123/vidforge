import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, IsUUID } from 'class-validator';

export class BanUserDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustCreditsDto {
  @IsNumber()
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class RefundApprovalDto {
  @IsString()
  paymentId!: string;

  @IsOptional()
  @IsNumber()
  amountCents?: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdminPaginationDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}

export class CreateModelAdminDto {
  @IsString()
  slug!: string;

  @IsString()
  name!: string;

  @IsString()
  provider!: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsNumber()
  creditsCost!: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  watermark?: boolean;
}

export class UpdateModelAdminDto {
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
}