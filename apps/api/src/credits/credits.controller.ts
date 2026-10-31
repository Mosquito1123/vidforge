import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreditsService } from './credits.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { GrantCreditsDto, TopupCreditsDto } from './dto/grant-credits.dto.js';
import { SpendCreditsDto } from './dto/spend-credits.dto.js';
import { UpdateAutoRefillDto } from './dto/auto-refill.dto.js';

@ApiTags('credits')
@ApiBearerAuth()
@Controller('credits')
@UseGuards(JwtAuthGuard)
export class CreditsController {
  constructor(private credits: CreditsService) {}

  @Get('balance')
  @ApiOperation({ summary: 'Get credit balance and recent transactions' })
  balance(@CurrentUser() user: { id: string }) {
    return this.credits.getAccount(user.id);
  }

  @Get('transactions')
  @ApiOperation({ summary: 'List credit transactions' })
  transactions(@CurrentUser() user: { id: string }) {
    return this.credits.listTransactions(user.id);
  }

  @Post('topup')
  @ApiOperation({ summary: 'Add credits (demo/topup)' })
  topup(@CurrentUser() user: { id: string }, @Body() body: TopupCreditsDto) {
    return this.credits.grantCredits(user.id, body.amount, body.reason || 'topup', undefined, body.idempotencyKey);
  }

  @Post('spend')
  @ApiOperation({ summary: 'Spend credits' })
  spend(@CurrentUser() user: { id: string }, @Body() body: SpendCreditsDto) {
    return this.credits.spendCredits(user.id, body.amount, body.reason || 'spend', body.taskId, body.idempotencyKey);
  }

  @Get('auto-refill')
  @ApiOperation({ summary: 'Get auto-refill settings' })
  getAutoRefill(@CurrentUser() user: { id: string }) {
    return this.credits.getAutoRefillSettings(user.id);
  }

  @Patch('auto-refill')
  @ApiOperation({ summary: 'Update auto-refill settings' })
  updateAutoRefill(@CurrentUser() user: { id: string }, @Body() body: UpdateAutoRefillDto) {
    return this.credits.updateAutoRefillSettings(user.id, body);
  }

  @Post('auto-refill')
  @ApiOperation({ summary: 'Run auto-refill now' })
  runAutoRefill(@CurrentUser() user: { id: string }) {
    return this.credits.tryAutoRefill(user.id);
  }
}
