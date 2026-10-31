import { IsOptional, IsString, Length } from 'class-validator';

export class VerifyRiskChallengeDto {
  @IsString()
  @Length(16, 256)
  challengeToken!: string;

  @IsString()
  @Length(4, 10)
  code!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class ResendRiskChallengeDto {
  @IsString()
  @Length(16, 256)
  challengeToken!: string;
}
