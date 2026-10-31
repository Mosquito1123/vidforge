import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation } from '@nestjs/swagger';
import { TasksService } from './tasks.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { InternalTokenGuard } from '../common/guards/internal-token.guard.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { CreateTaskDto } from './dto/create-task.dto.js';
import { UpdateTaskStatusDto, UpdateTaskProgressDto } from './dto/update-task-status.dto.js';

@ApiTags('tasks')
@ApiBearerAuth()
@Controller('tasks')
export class TasksController {
  constructor(private tasks: TasksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a generation task' })
  create(@CurrentUser() user: { id: string }, @Body() body: CreateTaskDto) {
    return this.tasks.create(
      user.id,
      body.modelId ?? body.model ?? '',
      body.input,
      body.priority,
      body.tool,
    );
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List tasks for current user' })
  findAll(@CurrentUser() user: { id: string }) {
    return this.tasks.findAll(user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get task by id' })
  findOne(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.tasks.findOne(user.id, id);
  }

  @Patch(':id/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Cancel a task' })
  cancel(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.tasks.cancel(user.id, id);
  }

  @Patch(':id/retry')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Retry a failed task' })
  retry(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.tasks.retry(user.id, id);
  }

  @Patch(':id/status')
  @UseGuards(InternalTokenGuard)
  @ApiOperation({ summary: 'Update task status (worker/webhook)' })
  updateStatus(@Param('id') id: string, @Body() body: UpdateTaskStatusDto) {
    return this.tasks.updateStatus(id, body.status, body.progress, body.output, body.error, body.stage);
  }

  @Patch(':id/progress')
  @UseGuards(InternalTokenGuard)
  @ApiOperation({ summary: 'Report task progress (worker)' })
  progress(@Param('id') id: string, @Body() body: UpdateTaskProgressDto) {
    return this.tasks.updateProgress(id, body.progress ?? 0, body.stage, body.status);
  }
}