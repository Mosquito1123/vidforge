import { IsNumber, IsOptional, IsString, IsPositive } from 'class-validator';

export class GrantCreditsDto {
  @IsString()
  userId!: string;

  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class TopupCreditsDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
