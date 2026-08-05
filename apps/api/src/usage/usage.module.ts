import { Module, type FactoryProvider } from '@nestjs/common';
import { createDatabase } from '@platform/db';
import { DrizzleUsageEventsRepository } from '../infrastructure/persistence/drizzle/usage.repository.js';
import { UsageEventsService } from './usage.service.js';
import { UsageController } from './usage.controller.js';
import { USAGE_REPO_TOKEN } from './usage.tokens.js';

const usageRepoProvider: FactoryProvider<DrizzleUsageEventsRepository> = {
  provide: USAGE_REPO_TOKEN,
  useFactory: (): DrizzleUsageEventsRepository => new DrizzleUsageEventsRepository(createDatabase()),
};

@Module({
  providers: [usageRepoProvider, UsageEventsService],
  controllers: [UsageController],
  exports: [UsageEventsService, USAGE_REPO_TOKEN],
})
export class UsageModule {}
