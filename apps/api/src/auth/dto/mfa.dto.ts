import { IsString } from 'class-validator';

export class MfaCodeDto {
  @IsString()
  code!: string;
}

export class MfaVerifyDto {
  @IsString()
  mfaToken!: string;

  @IsString()
  code!: string;
}
