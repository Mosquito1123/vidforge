import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service.js';
import { AdminGuard } from './guards/admin.guard.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import {
  AdjustCreditsDto,
  AdminPaginationDto,
  BanUserDto,
  RefundApprovalDto,
  CreateModelAdminDto,
  UpdateModelAdminDto,
} from './dto/admin.dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminController {
  constructor(private admin: AdminService) {}

  // ---- Users ----
  @Get('users')
  @ApiOperation({ summary: 'List/search users (admin)' })
  listUsers(@Query() query: AdminPaginationDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/search')
  @ApiOperation({ summary: 'Search users (admin)' })
  searchUsers(@Query() query: AdminPaginationDto) {
    return this.admin.listUsers(query);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get user (admin)' })
  getUser(@Param('id') id: string) {
    return this.admin.getUser(id);
  }

  @Post('users/:id/ban')
  @ApiOperation({ summary: 'Ban user (admin)' })
  banUser(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: BanUserDto, @Req() req: any) {
    return this.admin.banUser(id, body?.reason, user.id, req);
  }

  @Patch('users/:id/ban')
  @ApiOperation({ summary: 'Ban user (admin)' })
  banUserPatch(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: BanUserDto, @Req() req: any) {
    return this.admin.banUser(id, body?.reason, user.id, req);
  }

  @Post('users/:id/unban')
  @ApiOperation({ summary: 'Unban user (admin)' })
  unbanUser(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.unbanUser(id, user.id, req);
  }

  @Patch('users/:id/unban')
  @ApiOperation({ summary: 'Unban user (admin)' })
  unbanUserPatch(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.unbanUser(id, user.id, req);
  }

  @Post('users/:id/credits')
  @ApiOperation({ summary: 'Adjust user credits (admin)' })
  adjustCredits(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: AdjustCreditsDto,
    @Req() req: any,
  ) {
    return this.admin.adjustCredits(id, body.amount, body.reason, user.id, body.idempotencyKey, req);
  }

  @Patch('users/:id/credits')
  @ApiOperation({ summary: 'Adjust user credits (admin)' })
  adjustCreditsPatch(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: AdjustCreditsDto,
    @Req() req: any,
  ) {
    return this.admin.adjustCredits(id, body.amount, body.reason, user.id, body.idempotencyKey, req);
  }

  @Post('users/:id/adjust-credits')
  @ApiOperation({ summary: 'Adjust user credits (admin)' })
  adjustCreditsAlias(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() body: AdjustCreditsDto,
    @Req() req: any,
  ) {
    return this.admin.adjustCredits(id, body.amount, body.reason, user.id, body.idempotencyKey, req);
  }

  // ---- Tasks ----
  @Get('tasks')
  @ApiOperation({ summary: 'List tasks (admin)' })
  listTasks(@Query() query: AdminPaginationDto) {
    return this.admin.listTasks(query);
  }

  @Post('tasks/:id/retry')
  @ApiOperation({ summary: 'Retry task (admin)' })
  retryTask(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.retryTask(id, user.id, req);
  }

  @Patch('tasks/:id/retry')
  @ApiOperation({ summary: 'Retry task (admin)' })
  retryTaskPatch(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.retryTask(id, user.id, req);
  }

  @Post('tasks/:id/cancel')
  @ApiOperation({ summary: 'Cancel task (admin)' })
  cancelTask(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.cancelTask(id, user.id, req);
  }

  @Patch('tasks/:id/cancel')
  @ApiOperation({ summary: 'Cancel task (admin)' })
  cancelTaskPatch(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.cancelTask(id, user.id, req);
  }

  // ---- Models CRUD ----
  @Get('models')
  @ApiOperation({ summary: 'List models (admin)' })
  listModels(@Query('all') all?: string) {
    return this.admin.listModels(all !== 'false');
  }

  @Get('models/:id')
  @ApiOperation({ summary: 'Get model (admin)' })
  getModel(@Param('id') id: string) {
    return this.admin.getModel(id);
  }

  @Post('models')
  @ApiOperation({ summary: 'Create model (admin)' })
  createModel(@CurrentUser() user: { id: string }, @Body() body: CreateModelAdminDto, @Req() req: any) {
    return this.admin.createModel(body, user.id, req);
  }

  @Patch('models/:id')
  @ApiOperation({ summary: 'Update model (admin)' })
  updateModel(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: UpdateModelAdminDto, @Req() req: any) {
    return this.admin.updateModel(id, body, user.id, req);
  }

  @Delete('models/:id')
  @ApiOperation({ summary: 'Delete model (admin)' })
  deleteModel(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.deleteModel(id, user.id, req);
  }

  // ---- Refunds approval ----
  @Get('refunds')
  @ApiOperation({ summary: 'List refunds (admin)' })
  listRefunds(@Query() query: AdminPaginationDto) {
    return this.admin.listRefunds(query);
  }

  @Get('payments')
  @ApiOperation({ summary: 'List payments (admin)' })
  listPayments(@Query() query: AdminPaginationDto) {
    return this.admin.listPayments(query);
  }

  @Post('refunds')
  @ApiOperation({ summary: 'Process refund (admin)' })
  processRefund(@CurrentUser() user: { id: string }, @Body() body: RefundApprovalDto, @Req() req: any) {
    return this.admin.refundPayment(body, user.id, req);
  }

  @Post('refunds/:id/approve')
  @ApiOperation({ summary: 'Approve refund (admin)' })
  approveRefund(@CurrentUser() user: { id: string }, @Param('id') id: string, @Req() req: any) {
    return this.admin.approveRefund(id, user.id, req);
  }

  @Post('refunds/:id/reject')
  @ApiOperation({ summary: 'Reject refund (admin)' })
  rejectRefund(@CurrentUser() user: { id: string }, @Param('id') id: string, @Body() body: any, @Req() req: any) {
    return this.admin.rejectRefund(id, body?.reason, user.id, req);
  }

  // ---- Audit logs ----
  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs (admin)' })
  listAuditLogs(@Query() query: AdminPaginationDto) {
    return this.admin.listAuditLogs(query);
  }

  @Post('audit-logs')
  @ApiOperation({ summary: 'Create audit log (admin)' })
  createAuditLog(@CurrentUser() user: { id: string }, @Body() body: any, @Req() req: any) {
    return this.admin.createAuditLog(body, user.id, req);
  }
}