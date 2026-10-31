import { Module } from '@nestjs/common';
import { PhoneStore } from './phone.store.js';

@Module({
  providers: [PhoneStore],
  exports: [PhoneStore],
})
export class PhoneStoreModule {}
