import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from '../auth/auth.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { extractIp } from '../phone/phone.util.js';
import { ResendRiskChallengeDto, VerifyRiskChallengeDto } from './dto/risk.dto.js';
import { RiskService } from './risk.service.js';
import { RequestMeta } from './risk.types.js';

/**
 * Registered by `AuthModule` (which imports `RiskModule`): completing a
 * challenge must mint tokens, so it depends on `AuthService`.
 */
@ApiTags('risk')
@Controller('auth/risk')
export class RiskController {
  constructor(
    private auth: AuthService,
    private risk: RiskService,
  ) {}

  private meta(req: any): RequestMeta {
    return {
      ip: extractIp(req),
      userAgent: req?.headers?.['user-agent'] ?? null,
      deviceId: req?.headers?.['x-device-id'] ?? null,
    };
  }

  @Post('challenge/verify')
  @ApiOperation({ summary: 'Verify a suspicious-login challenge and receive tokens' })
  verify(@Body() dto: VerifyRiskChallengeDto, @Req() req: any) {
    return this.auth.completeRiskChallenge(dto.challengeToken, dto.code, {
      ...this.meta(req),
      deviceId: dto.deviceId ?? this.meta(req).deviceId ?? null,
    });
  }

  @Post('challenge/resend')
  @ApiOperation({ summary: 'Resend the SMS code for a pending login challenge' })
  resend(@Body() dto: ResendRiskChallengeDto) {
    return this.risk.resendChallenge(dto.challengeToken);
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List recent risk events for the current user' })
  events(@CurrentUser() user: { id: string }) {
    return this.risk.listEvents(user.id);
  }

  @Get('login-audit')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List recent login audit entries for the current user' })
  loginAudit(@CurrentUser() user: { id: string }) {
    return this.risk.listLoginAudit(user.id);
  }
}
