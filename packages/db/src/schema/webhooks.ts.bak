import { pgTable, uuid, varchar, text, jsonb, timestamp, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';

export const webhookEndpointStatusEnum = pgEnum('webhook_endpoint_status', [
  'ACTIVE',
  'PAUSED',
  'ARCHIVED',
]);

export const webhookDeliveryStatusEnum = pgEnum('webhook_delivery_status', [
  'PENDING',
  'IN_FLIGHT',
  'SUCCEEDED',
  'FAILED',
  'DLQ',
]);

export const webhookEndpoints = pgTable(
  'webhook_endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 120 }).notNull(),
    url: varchar('url', { length: 2048 }).notNull(),
    secretCiphertext: text('secret_ciphertext').notNull(),
    events: jsonb('events').$type<string[]>().notNull(),
    status: webhookEndpointStatusEnum('status').notNull().default('ACTIVE'),
    description: text('description'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index('webhook_endpoints_client_idx').on(t.clientId),
    statusIdx: index('webhook_endpoints_status_idx').on(t.clientId, t.status),
  }),
);

export const webhookEvents = pgTable(
  'webhook_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    type: varchar('type', { length: 80 }).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 128 }).notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientTypeIdx: index('webhook_events_client_type_idx').on(t.clientId, t.type, t.occurredAt),
    idemUq: uniqueIndex('webhook_events_idem_uq').on(t.clientId, t.idempotencyKey),
  }),
);

export const webhookDeliveries = pgTable(
  'webhook_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
    eventId: uuid('event_id')
      .notNull()
      .references(() => webhookEvents.id, { onDelete: 'cascade' }),
    status: webhookDeliveryStatusEnum('status').notNull().default('PENDING'),
    attemptCount: text('attempt_count').notNull().default('0'),
    maxAttempts: text('max_attempts').notNull().default('6'),
    lastStatusCode: text('last_status_code'),
    lastError: text('last_error'),
    requestBody: text('request_body').notNull(),
    requestSignature: varchar('request_signature', { length: 128 }).notNull(),
    responseBody: text('response_body'),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    endpointIdx: index('webhook_deliveries_endpoint_idx').on(t.endpointId, t.createdAt),
    eventIdx: index('webhook_deliveries_event_idx').on(t.eventId),
    pendingIdx: index('webhook_deliveries_pending_idx').on(t.status, t.nextRetryAt),
  }),
);

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type WebhookEndpointRecord = WebhookEndpoint;

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type WebhookEventRecord = WebhookEvent;

export type WebhookDelivery = typeof webhookDeliveries.$inferSelect;
export type NewWebhookDelivery = typeof webhookDeliveries.$inferInsert;
export type WebhookDeliveryRecord = WebhookDelivery;
