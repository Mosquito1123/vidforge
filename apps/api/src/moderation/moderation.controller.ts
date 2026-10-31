import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ModerationService } from './moderation.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';

@ApiTags('moderation')
@Controller('moderation')
export class ModerationController {
  constructor(private moderation: ModerationService) {}

  @Post('check')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Run content moderation check' })
  check(@CurrentUser() user: { id: string }, @Body() body: any, @Req() req: any) {
    return this.moderation.check(user?.id ?? null, body, req);
  }

  @Get('tasks/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get moderation status for a task' })
  taskStatus(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.moderation.taskStatus(id, user?.id ?? null, req);
  }

  @Post('appeal')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Submit a moderation appeal' })
  appeal(@CurrentUser() user: { id: string }, @Body() body: any, @Req() req: any) {
    return this.moderation.appeal(user?.id ?? null, body, req);
  }

  @Get('appeal-link')
  @ApiOperation({ summary: 'Get moderation appeal link' })
  appealLink() {
    return { appealUrl: process.env.APPEAL_URL || process.env.MODERATION_APPEAL_URL || '/report-abuse' };
  }
}
