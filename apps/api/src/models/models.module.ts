import { Module } from '@nestjs/common';
import { ModelsService } from './models.service.js';
import { ModelsController } from './models.controller.js';

@Module({
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
