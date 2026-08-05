import { Module, type FactoryProvider } from '@nestjs/common';
import { createDatabase } from '@platform/db';
import type { HttpDeliveryClient, HttpDeliveryRequest, HttpDeliveryResponse } from '@platform/webhook-sdk';
import {
  DrizzleWebhookEndpointsRepository,
  DrizzleWebhookEventsRepository,
  DrizzleWebhookDeliveriesRepository,
  WEBHOOK_REPO_TOKENS,
} from '../infrastructure/persistence/drizzle/webhooks.repository.js';
import { JwtGuard } from '../auth/jwt.guard.js';
import { DrizzleClientsRepository } from '../infrastructure/persistence/drizzle/clients.repository.js';
import { AuditModule } from '../audit/audit.module.js';
import { AuditService } from '../audit/audit.service.js';
import { CLIENTS_REPO_TOKEN } from './webhooks.tokens.js';
import { WebhookEndpointsService } from './webhook-endpoints.service.js';
import { WebhookDispatcherService, defaultUrlSafetyChecker } from './webhook-dispatcher.service.js';
import { WebhookOutboxProcessor, DISPATCHER_HTTP } from './webhook-outbox.processor.js';
import { WebhookEndpointsController } from './webhook-endpoints.controller.js';
import { WebhookDeliveriesController } from './webhook-deliveries.controller.js';

const realHttpClient: HttpDeliveryClient = {
  post: async (req: HttpDeliveryRequest): Promise<HttpDeliveryResponse> => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    try {
      const res = await fetch(req.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Platform-Signature': `t=${req.timestamp},v1=${req.signature}`,
          'X-Platform-Event-Id': req.eventId,
          'X-Platform-Event-Attempt': String(req.attempt),
        },
        body: req.body,
        signal: ctrl.signal,
      });
      const body = await res.text();
      return { statusCode: res.status, body };
    } finally {
      clearTimeout(t);
    }
  },
};

const httpProvider: FactoryProvider<HttpDeliveryClient> = {
  provide: DISPATCHER_HTTP,
  useFactory: (): HttpDeliveryClient => realHttpClient,
};

const endpointsRepoProvider: FactoryProvider<DrizzleWebhookEndpointsRepository> = {
  provide: WEBHOOK_REPO_TOKENS.ENDPOINTS,
  useFactory: (): DrizzleWebhookEndpointsRepository => new DrizzleWebhookEndpointsRepository(createDatabase()),
};

const eventsRepoProvider: FactoryProvider<DrizzleWebhookEventsRepository> = {
  provide: WEBHOOK_REPO_TOKENS.EVENTS,
  useFactory: (): DrizzleWebhookEventsRepository => new DrizzleWebhookEventsRepository(createDatabase()),
};

const deliveriesRepoProvider: FactoryProvider<DrizzleWebhookDeliveriesRepository> = {
  provide: WEBHOOK_REPO_TOKENS.DELIVERIES,
  useFactory: (): DrizzleWebhookDeliveriesRepository => new DrizzleWebhookDeliveriesRepository(createDatabase()),
};

const dispatcherProvider: FactoryProvider<WebhookDispatcherService> = {
  provide: WebhookDispatcherService,
  inject: [
    WEBHOOK_REPO_TOKENS.ENDPOINTS,
    WEBHOOK_REPO_TOKENS.EVENTS,
    WEBHOOK_REPO_TOKENS.DELIVERIES,
    DISPATCHER_HTTP,
    CLIENTS_REPO_TOKEN,
  ],
  useFactory: (
    endpoints: DrizzleWebhookEndpointsRepository,
    events: DrizzleWebhookEventsRepository,
    deliveries: DrizzleWebhookDeliveriesRepository,
    http: HttpDeliveryClient,
    clientsRepo: DrizzleClientsRepository,
  ): WebhookDispatcherService =>
    new WebhookDispatcherService({
      endpoints,
      events,
      deliveries,
      http,
      urlSafety: defaultUrlSafetyChecker,
      getClientAllowlist: (clientId: string) => clientsRepo.getWebhookAllowedHosts(clientId),
    }),
};

const clientsRepoProvider: FactoryProvider<DrizzleClientsRepository> = {
  provide: CLIENTS_REPO_TOKEN,
  useFactory: (): DrizzleClientsRepository => new DrizzleClientsRepository(createDatabase()),
};

const endpointsServiceProvider: FactoryProvider<WebhookEndpointsService> = {
  provide: WebhookEndpointsService,
  inject: [WEBHOOK_REPO_TOKENS.ENDPOINTS, WEBHOOK_REPO_TOKENS.EVENTS, CLIENTS_REPO_TOKEN, AuditService, WebhookDispatcherService],
  useFactory: (
    endpoints: DrizzleWebhookEndpointsRepository,
    events: DrizzleWebhookEventsRepository,
    clientsRepo: DrizzleClientsRepository,
    audit: AuditService,
    dispatcher: WebhookDispatcherService,
  ): WebhookEndpointsService => new WebhookEndpointsService(endpoints, events, clientsRepo, audit, dispatcher),
};

@Module({
  imports: [AuditModule],
  providers: [
    JwtGuard,
    httpProvider,
    endpointsRepoProvider,
    eventsRepoProvider,
    deliveriesRepoProvider,
    clientsRepoProvider,
    dispatcherProvider,
    endpointsServiceProvider,
    WebhookOutboxProcessor,
  ],
  controllers: [WebhookEndpointsController, WebhookDeliveriesController],
  exports: [
    WebhookDispatcherService,
    WEBHOOK_REPO_TOKENS.ENDPOINTS,
    WEBHOOK_REPO_TOKENS.EVENTS,
    WEBHOOK_REPO_TOKENS.DELIVERIES,
    CLIENTS_REPO_TOKEN,
  ],
})
export class WebhooksModule {}
