import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { extractIp } from '../phone/phone.util.js';
import { RequestMeta } from '../risk/risk.types.js';
import { KycSubmitDto } from './dto/kyc.dto.js';
import { KycService } from './kyc.service.js';

@ApiTags('kyc')
@ApiBearerAuth()
@Controller('kyc')
@UseGuards(JwtAuthGuard)
export class KycController {
  constructor(private kyc: KycService) {}

  private meta(req: any): RequestMeta {
    return {
      ip: extractIp(req),
      userAgent: req?.headers?.['user-agent'] ?? null,
      deviceId: req?.headers?.['x-device-id'] ?? null,
    };
  }

  @Post('submit')
  @ApiOperation({ summary: 'Submit real-name verification (name + resident ID)' })
  submit(@CurrentUser() user: { id: string }, @Body() dto: KycSubmitDto, @Req() req: any) {
    return this.kyc.submit(user.id, dto, this.meta(req));
  }

  @Get('status')
  @ApiOperation({ summary: 'Current real-name verification status' })
  status(@CurrentUser() user: { id: string }) {
    return this.kyc.status(user.id);
  }
}
