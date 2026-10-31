import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service.js';
import { RegisterDto } from './dto/register.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { VerifyEmailDto } from './dto/verify-email.dto.js';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto.js';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto.js';
import { MfaCodeDto, MfaVerifyDto } from './dto/mfa.dto.js';
import { OAuthCallbackDto } from './dto/oauth.dto.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { extractIp } from '../phone/phone.util.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  private meta(req: any) {
    return {
      ip: extractIp(req),
      userAgent: req?.headers?.['user-agent'] ?? null,
      deviceId: req?.headers?.['x-device-id'] ?? null,
    };
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  register(@Body() dto: RegisterDto, @Req() req: any) {
    return this.auth.register(dto.email, dto.password, dto.name, this.meta(req));
  }

  @Post('login')
  @ApiOperation({ summary: 'Login and receive tokens' })
  login(@Body() dto: LoginDto, @Req() req: any) {
    return this.auth.login(dto.email, dto.password, dto.mfaCode, this.meta(req));
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body() dto: RefreshDto, @Req() req: any) {
    return this.auth.refresh(dto.refreshToken, this.meta(req));
  }

  @Post('logout')
  @ApiOperation({ summary: 'Logout current session' })
  logout(@Body() dto: Partial<RefreshDto>, @Req() req: any) {
    const sid = (req.user as any)?.sessionId;
    return this.auth.logout(dto?.refreshToken, sid);
  }

  @Post('logout-all')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout all sessions' })
  logoutAll(@CurrentUser() user: { id: string }) {
    return this.auth.logoutAll(user.id);
  }

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify email with token' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.auth.verifyEmail(dto.token);
  }

  @Post('password-reset/request')
  @ApiOperation({ summary: 'Request password reset' })
  requestReset(@Body() dto: PasswordResetRequestDto) {
    return this.auth.requestPasswordReset(dto.email);
  }

  @Post('password-reset/confirm')
  @ApiOperation({ summary: 'Confirm password reset' })
  confirmReset(@Body() dto: PasswordResetConfirmDto) {
    return this.auth.resetPassword(dto.token, dto.password);
  }

  // MFA
  @Post('mfa/setup')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start MFA setup' })
  mfaSetup(@CurrentUser() user: { id: string; email: string }) {
    return this.auth.setupMfa(user.id, user.email);
  }

  @Post('mfa/enable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable MFA' })
  mfaEnable(@CurrentUser() user: { id: string }, @Body() dto: MfaCodeDto) {
    return this.auth.enableMfa(user.id, dto.code);
  }

  @Post('mfa/disable')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable MFA' })
  mfaDisable(@CurrentUser() user: { id: string }, @Body() dto: MfaCodeDto) {
    return this.auth.disableMfa(user.id, dto.code);
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'MFA status' })
  mfaStatus(@CurrentUser() user: { id: string }) {
    return this.auth.getMfaStatus(user.id);
  }

  @Post('mfa/verify')
  @ApiOperation({ summary: 'Verify MFA during login' })
  mfaVerify(@Body() dto: MfaVerifyDto, @Req() req: any) {
    return this.auth.verifyMfa(dto.mfaToken, dto.code, this.meta(req));
  }

  // Sessions
  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List sessions' })
  sessions(@CurrentUser() user: { id: string; sessionId?: string }) {
    return this.auth.listSessions(user.id, user.sessionId);
  }

  @Delete('sessions/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke session' })
  revokeSession(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.auth.revokeSession(user.id, id);
  }

  // OAuth stubs
  @Get('oauth/:provider')
  @ApiOperation({ summary: 'OAuth authorize redirect (stub)' })
  oauthStart(@Param('provider') provider: string) {
    const url = this.auth.oauthAuthorizationUrl(provider);
    if (!url) return { provider, message: 'OAuth not configured; use callback with email to stub login' };
    return { provider, url };
  }

  @Get('oauth/:provider/callback')
  @ApiOperation({ summary: 'OAuth callback (stub)' })
  oauthCallbackGet(
    @Param('provider') provider: string,
    @Query() query: OAuthCallbackDto,
    @Req() req: any,
  ) {
    return this.auth.oauthLogin(provider, query.email, query.name, this.meta(req));
  }

  @Post('oauth/:provider/callback')
  @ApiOperation({ summary: 'OAuth callback (stub)' })
  oauthCallbackPost(
    @Param('provider') provider: string,
    @Body() dto: OAuthCallbackDto,
    @Req() req: any,
  ) {
    return this.auth.oauthLogin(provider, dto.email, dto.name, this.meta(req));
  }
}
