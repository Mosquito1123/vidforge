import { IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';

export class KycSubmitDto {
  @IsString()
  @Length(2, 50)
  realName!: string;

  @IsString()
  @Matches(/^\d{17}[\dXx]$/, { message: 'idNumber must be an 18-digit resident ID number' })
  idNumber!: string;

  @IsOptional()
  @IsIn(['id_card'])
  documentType?: 'id_card';

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  idCardFrontUrl?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 2048)
  idCardBackUrl?: string | null;
}
