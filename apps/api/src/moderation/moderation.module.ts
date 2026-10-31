import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service.js';
import { ModerationController } from './moderation.controller.js';

@Module({
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
