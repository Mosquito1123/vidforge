import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { extractIp } from './phone.util.js';
import { RequestMeta } from '../risk/risk.types.js';
import {
  PhoneBindDto,
  PhoneLoginDto,
  PhoneRegisterDto,
  PhoneUnbindDto,
  SendPhoneCodeDto,
} from './dto/phone.dto.js';
import { PhoneService } from './phone.service.js';

@ApiTags('phone-auth')
@Controller('auth/phone')
export class PhoneController {
  constructor(private phone: PhoneService) {}

  private meta(req: any): RequestMeta {
    return {
      ip: extractIp(req),
      userAgent: req?.headers?.['user-agent'] ?? null,
      deviceId: req?.headers?.['x-device-id'] ?? null,
    };
  }

  @Post('sms/send')
  @ApiOperation({ summary: 'Send an SMS verification code' })
  sendCode(@Body() dto: SendPhoneCodeDto, @Req() req: any) {
    return this.phone.sendCode(dto.phone, dto.purpose, dto.channel, this.meta(req));
  }

  @Post('sms/unbind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send the unbind code to the currently bound number' })
  sendUnbindCode(@CurrentUser() user: { id: string }, @Req() req: any) {
    return this.phone.sendUnbindCode(user.id, this.meta(req));
  }

  @Post('login')
  @ApiOperation({ summary: 'Log in with a phone number and SMS code' })
  login(@Body() dto: PhoneLoginDto, @Req() req: any) {
    return this.phone.login(dto.phone, dto.code, {
      ...this.meta(req),
      deviceId: dto.deviceId ?? this.meta(req).deviceId ?? null,
    });
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new account with a phone number and SMS code' })
  register(@Body() dto: PhoneRegisterDto, @Req() req: any) {
    return this.phone.register(dto.phone, dto.code, dto.name, {
      ...this.meta(req),
      deviceId: dto.deviceId ?? this.meta(req).deviceId ?? null,
    });
  }

  @Post('bind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Bind a verified phone number to the current account' })
  bind(@CurrentUser() user: { id: string }, @Body() dto: PhoneBindDto, @Req() req: any) {
    return this.phone.bind(user.id, dto.phone, dto.code, this.meta(req));
  }

  @Post('unbind')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unbind the phone number from the current account' })
  unbind(@CurrentUser() user: { id: string }, @Body() dto: PhoneUnbindDto, @Req() req: any) {
    return this.phone.unbind(user.id, dto.code, this.meta(req));
  }

  @Get('status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Phone binding status for the current account' })
  status(@CurrentUser() user: { id: string }) {
    return this.phone.status(user.id);
  }
}
