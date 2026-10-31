import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OssStorageService } from './oss-storage.service.js';

@Module({
  imports: [ConfigModule],
  providers: [OssStorageService],
  exports: [OssStorageService],
})
export class StorageModule {}
