import { pgTable, uuid, varchar, text, timestamp, index, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';
import { conversations } from './conversations.js';
import { messages } from './conversations.js';

export const channelConnectionStateEnum = pgEnum('channel_connection_state', [
  'NOT_CONFIGURED',
  'PENDING',
  'CONNECTED',
  'DEGRADED',
  'DISCONNECTED',
  'ERROR',
]);

export const messageDeliveryStatusEnum = pgEnum('message_delivery_status', [
  'QUEUED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
]);

export const channelConnections = pgTable(
  'channel_connections',
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
    channel: varchar('channel', { length: 32 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    status: channelConnectionStateEnum('status').notNull().default('NOT_CONFIGURED'),
    credentialsCiphertext: text('credentials_ciphertext').notNull().default(''),
    phoneNumber: varchar('phone_number', { length: 32 }),
    webhookSecretCiphertext: text('webhook_secret_ciphertext').notNull(),
    lastVerifiedAt: timestamp('last_verified_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdBy: uuid('created_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    clientChannelIdx: index('channel_connections_client_channel_idx').on(t.clientId, t.channel),
    statusIdx: index('channel_connections_status_idx').on(t.clientId, t.status),
  }),
);

export const messageDeliveries = pgTable(
  'message_deliveries',
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
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 32 }).notNull(),
    channelConnectionId: uuid('channel_connection_id').references(() => channelConnections.id, {
      onDelete: 'set null',
    }),
    providerMessageId: varchar('provider_message_id', { length: 128 }),
    status: messageDeliveryStatusEnum('status').notNull().default('QUEUED'),
    errorCode: varchar('error_code', { length: 64 }),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    messageUq: uniqueIndex('message_deliveries_message_uq').on(t.messageId),
    conversationIdx: index('message_deliveries_conversation_idx').on(t.conversationId, t.createdAt),
    statusIdx: index('message_deliveries_status_idx').on(t.status, t.attemptedAt),
    providerIdx: index('message_deliveries_provider_idx').on(t.channelConnectionId, t.providerMessageId),
  }),
);

export type ChannelConnection = typeof channelConnections.$inferSelect;
export type NewChannelConnection = typeof channelConnections.$inferInsert;
export type ChannelConnectionRecord = ChannelConnection;

export type MessageDelivery = typeof messageDeliveries.$inferSelect;
export type NewMessageDelivery = typeof messageDeliveries.$inferInsert;
export type MessageDeliveryRecord = MessageDelivery;
