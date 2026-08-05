import { Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller.js';
import { HealthModule } from './health/health.module.js';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { AuthModule, TenantContextMiddleware } from './auth/auth.module.js';
import { DistributorsModule } from './distributors/distributors.module.js';
import { BillingModule } from './billing/billing.module.js';
import { AgentModule } from './agent/agent.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { ChannelsModule } from './channels/channels.module.js';
import { AuditModule } from './audit/audit.module.js';
import { UsageModule } from './usage/usage.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DatabaseModule,
    AuthModule,
    HealthModule,
    DistributorsModule,
    BillingModule,
    AgentModule,
    WebhooksModule,
    ChannelsModule,
    AuditModule,
    UsageModule,
  ],
  controllers: [HealthController],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(CorrelationIdMiddleware, TenantContextMiddleware).forRoutes('*');
  }
}
