import { Module, type FactoryProvider, type Provider } from '@nestjs/common';
import { createDatabase } from '@platform/db';
import { DrizzleAuditEventsRepository } from '../infrastructure/persistence/drizzle/audit.repository.js';
import { AuditService } from './audit.service.js';
import { AuditController } from './audit.controller.js';
import { AUDIT_REPO_TOKEN } from './audit.tokens.js';

export const auditRepoProvider: FactoryProvider<DrizzleAuditEventsRepository> = {
  provide: AUDIT_REPO_TOKEN,
  useFactory: (): DrizzleAuditEventsRepository => new DrizzleAuditEventsRepository(createDatabase()),
};

const auditServiceProvider: Provider = {
  provide: AuditService,
  useFactory: (repo: DrizzleAuditEventsRepository) => new AuditService(repo),
  inject: [AUDIT_REPO_TOKEN],
};

@Module({
  providers: [auditRepoProvider, auditServiceProvider],
  controllers: [AuditController],
  exports: [AuditService, AUDIT_REPO_TOKEN],
})
export class AuditModule {}
