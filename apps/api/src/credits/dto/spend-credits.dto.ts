import { IsNumber, IsOptional, IsString, IsPositive } from 'class-validator';

export class SpendCreditsDto {
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
