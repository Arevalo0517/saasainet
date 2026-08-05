import { Module, type Provider } from '@nestjs/common';
import { DrizzleDistributorRepository, DrizzleClientRepository } from '../infrastructure/persistence/drizzle/distributors.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleClientsRepository } from '../infrastructure/persistence/drizzle/clients.repository.js';
import { AuditService } from '../audit/audit.service.js';
import { DatabaseModule } from '../infrastructure/database/database.module.js';
import { DATABASE } from '../infrastructure/database/database.module.js';
import type { Database } from '@platform/db';
import { ClientService, DistributorService } from './distributors.service.js';
import { ClientsController, DistributorsController } from './distributors.controller.js';
import { WebhooksModule } from '../webhooks/webhooks.module.js';
import { AuditModule } from '../audit/audit.module.js';
import { CLIENTS_REPO_TOKEN } from '../webhooks/webhooks.tokens.js';

const distributorRepoProvider: Provider = {
  provide: DrizzleDistributorRepository,
  inject: [DATABASE],
  useFactory: (db: Database) => new DrizzleDistributorRepository(db),
};

const clientRepoProvider: Provider = {
  provide: DrizzleClientRepository,
  inject: [DATABASE],
  useFactory: (db: Database) => new DrizzleClientRepository(db),
};

const distributorServiceProvider: Provider = {
  provide: DistributorService,
  inject: [DrizzleDistributorRepository, AuditService],
  useFactory: (repo: DrizzleDistributorRepository, audit: AuditService) => new DistributorService(repo, audit),
};

const clientServiceProvider: Provider = {
  provide: ClientService,
  inject: [DrizzleClientRepository, CLIENTS_REPO_TOKEN, AuditService],
  useFactory: (repo: DrizzleClientRepository, clientsRepo: DrizzleClientsRepository, audit: AuditService) =>
    new ClientService(repo, clientsRepo, audit),
};

@Module({
  imports: [DatabaseModule, WebhooksModule, AuditModule],
  providers: [distributorRepoProvider, clientRepoProvider, distributorServiceProvider, clientServiceProvider],
  controllers: [DistributorsController, ClientsController],
  exports: [DistributorService, ClientService],
})
export class DistributorsModule {}
