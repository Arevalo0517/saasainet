import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { conversationStateEnum, messageDirectionEnum, messageRoleEnum } from './enums.js';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';
import { agents } from './agents.js';
import { agentVersions } from './agents.js';

export const conversations = pgTable(
  'conversations',
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
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'restrict' }),
    agentVersionId: uuid('agent_version_id').references(() => agentVersions.id, { onDelete: 'set null' }),
    channel: varchar('channel', { length: 16 }).notNull().default('WIDGET'),
    externalConversationId: varchar('external_conversation_id', { length: 256 }),
    state: conversationStateEnum('state').notNull().default('NEW'),
    customerDisplayName: varchar('customer_display_name', { length: 200 }),
    customerExternalId: varchar('customer_external_id', { length: 256 }),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
    messageCount: integer('message_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index('conversations_client_idx').on(t.clientId),
    agentIdx: index('conversations_agent_idx').on(t.agentId),
    stateIdx: index('conversations_state_idx').on(t.state),
    lastMsgIdx: index('conversations_last_msg_idx').on(t.lastMessageAt),
  }),
);

export const messages = pgTable(
  'messages',
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
    direction: messageDirectionEnum('direction').notNull(),
    role: messageRoleEnum('role').notNull().default('USER'),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    externalMessageId: varchar('external_message_id', { length: 256 }),
    providerEventId: varchar('provider_event_id', { length: 256 }),
    citations: jsonb('citations').$type<Array<{ documentId: string; chunkId: string; position: number }>>()
      .notNull()
      .default([]),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    convIdx: index('messages_conv_idx').on(t.conversationId),
    clientIdx: index('messages_client_idx').on(t.clientId),
    externalUq: uniqueIndex('messages_conversation_external_uq').on(t.conversationId, t.externalMessageId),
    providerIdx: index('messages_provider_event_idx').on(t.clientId, t.providerEventId),
  }),
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type ConversationRecord = Conversation;
export type MessageRecord = Message;
