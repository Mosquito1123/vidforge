import { Module } from '@nestjs/common';
import { WebhooksService } from './webhooks.service.js';
import { WebhooksController } from './webhooks.controller.js';
import { TasksModule } from '../tasks/tasks.module.js';
import { PaymentsModule } from '../payments/payments.module.js';

@Module({
  imports: [TasksModule, PaymentsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}
