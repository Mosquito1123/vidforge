import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class AutoRefillSettingsDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsNumber()
  threshold?: number;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  packageId?: string | null;
}

export class UpdateAutoRefillDto extends AutoRefillSettingsDto {}