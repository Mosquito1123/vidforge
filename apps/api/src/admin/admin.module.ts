import { Module } from '@nestjs/common';
import { AdminService } from './admin.service.js';
import { AdminController } from './admin.controller.js';
import { AdminGuard, AdminRoleGuard } from './guards/admin.guard.js';
import { CreditsModule } from '../credits/credits.module.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { ModelsModule } from '../models/models.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [CreditsModule, TasksModule, ModelsModule, PaymentsModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, AdminRoleGuard],
  exports: [AdminService, AdminGuard, AdminRoleGuard],
})
export class AdminModule {}