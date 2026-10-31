import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { CreditsModule } from './credits/credits.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { TasksModule } from './tasks/tasks.module.js';
import { ModelsModule } from './models/models.module.js';
import { AdminModule } from './admin/admin.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { CouponsModule } from './coupons/coupons.module.js';
import { HealthModule } from './health/health.module.js';
import { ModerationModule } from './moderation/moderation.module.js';
import { PhoneModule } from './phone/phone.module.js';
import { KycModule } from './kyc/kyc.module.js';
import { StorageModule } from './storage/storage.module.js';
import { UploadsModule } from './uploads/uploads.module.js';

@Module({
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60', 10) * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '60', 10),
      },
    ]),
    PrismaModule,
    AuthModule,
    UsersModule,
    CreditsModule,
    PaymentsModule,
    TasksModule,
    ModelsModule,
    AdminModule,
    WebhooksModule,
    CouponsModule,
    HealthModule,
    ModerationModule,
    PhoneModule,
    KycModule,
    StorageModule,
    UploadsModule,
  ],
})
export class AppModule {}
