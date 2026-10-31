import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export class SendPhoneCodeDto {
  @IsString()
  @Length(5, 24)
  phone!: string;

  @IsIn(['login', 'register', 'bind'])
  purpose!: 'login' | 'register' | 'bind';

  @IsOptional()
  @IsIn(['aliyun', 'tencent'])
  channel?: 'aliyun' | 'tencent';
}

export class PhoneLoginDto {
  @IsString()
  @Length(5, 24)
  phone!: string;

  @IsString()
  @Length(4, 10)
  code!: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class PhoneRegisterDto {
  @IsString()
  @Length(5, 24)
  phone!: string;

  @IsString()
  @Length(4, 10)
  code!: string;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  name?: string;

  @IsOptional()
  @IsString()
  deviceId?: string;
}

export class PhoneBindDto {
  @IsString()
  @Length(5, 24)
  phone!: string;

  @IsString()
  @Length(4, 10)
  code!: string;
}

export class PhoneUnbindDto {
  @IsString()
  @Length(4, 10)
  code!: string;
}
