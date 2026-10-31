import { IsObject, IsOptional, IsString } from 'class-validator';

export class WebhookDto {
  @IsOptional()
  @IsString()
  event?: string;

  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}
