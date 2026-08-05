import { Module } from '@nestjs/common';
import { DatabaseModule } from '../infrastructure/database/database.module.js';
import { MockPaymentProvider } from '@platform/payment-providers';
import {
  DrizzlePlanRepository,
  DrizzleSubscriptionRepository,
} from '../infrastructure/persistence/drizzle/plans.repository.js';
import { DrizzlePaymentRepository } from '../infrastructure/persistence/drizzle/payments.repository.js';
import { DrizzleClientRepository } from '../infrastructure/persistence/drizzle/distributors.repository.js';
import type { Database as DbType } from '@platform/db';
import { DATABASE } from '../infrastructure/database/database.module.js';
import { PlansService } from './plans.service.js';
import { PlansController } from './plans.controller.js';
import { SubscriptionsService } from './subscriptions.service.js';
import { SubscriptionsController } from './subscriptions.controller.js';
import { PaymentsService } from './payments.service.js';
import { PaymentsController } from './payments.controller.js';
import { WebhooksController } from './webhooks.controller.js';

const mockProviderSecret = process.env.PAYMENT_MOCK_SECRET ?? 'dev-mock-secret-min-16-chars-aaaa';

@Module({
  imports: [DatabaseModule],
  providers: [
    {
      provide: DrizzlePlanRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzlePlanRepository(db),
    },
    {
      provide: DrizzleSubscriptionRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleSubscriptionRepository(db),
    },
    {
      provide: DrizzleClientRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzleClientRepository(db),
    },
    {
      provide: DrizzlePaymentRepository,
      inject: [DATABASE],
      useFactory: (db: DbType) => new DrizzlePaymentRepository(db),
    },
    {
      provide: MockPaymentProvider,
      useFactory: () => new MockPaymentProvider(mockProviderSecret),
    },
    PlansService,
    SubscriptionsService,
    PaymentsService,
  ],
  controllers: [PlansController, SubscriptionsController, PaymentsController, WebhooksController],
  exports: [PlansService, SubscriptionsService, PaymentsService, MockPaymentProvider],
})
export class BillingModule {}
