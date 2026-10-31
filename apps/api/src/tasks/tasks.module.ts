import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service.js';
import { TasksController } from './tasks.controller.js';
import { ToolsController } from './tools.controller.js';
import { TasksGateway } from './tasks.gateway.js';
import { ModelsModule } from '../models/models.module.js';
import { CreditsModule } from '../credits/credits.module.js';

@Module({
  imports: [ModelsModule, CreditsModule],
  controllers: [TasksController, ToolsController],
  providers: [TasksService, TasksGateway],
  exports: [TasksService, TasksGateway],
})
export class TasksModule {}
