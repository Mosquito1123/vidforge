import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateCouponDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  type!: string;

  @IsNumber()
  @Min(0)
  value!: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRedemptions?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class ValidateCouponDto {
  @IsString()
  code!: string;
}

export class RedeemCouponDto {
  @IsString()
  code!: string;

  @IsOptional()
  @IsString()
  paymentId?: string;
}

export class CreateInviteCodeDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUses?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  rewardCredits?: number;

  @IsOptional()
  @IsString()
  expiresAt?: string;
}

export class RedeemInviteCodeDto {
  @IsString()
  code!: string;
}
