import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { agentStateEnum } from './enums.js';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';

export const agents = pgTable(
  'agents',
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
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    defaultLocale: varchar('default_locale', { length: 8 }).notNull().default('es'),
    defaultTimezone: varchar('default_timezone', { length: 64 }).notNull().default('UTC'),
    publicWidgetId: varchar('public_widget_id', { length: 32 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    platformIdx: index('agents_platform_idx').on(t.platformId),
    clientIdx: index('agents_client_idx').on(t.clientId),
    distributorIdx: index('agents_distributor_idx').on(t.distributorId),
    keyClientUq: uniqueIndex('agents_client_key_uq').on(t.clientId, t.key),
    publicWidgetIdUq: uniqueIndex('agents_public_widget_id_uq').on(t.publicWidgetId),
  }),
);

export const agentVersions = pgTable(
  'agent_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    state: agentStateEnum('state').notNull().default('DRAFT'),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    language: varchar('language', { length: 8 }).notNull().default('es'),
    timezone: varchar('timezone', { length: 64 }).notNull().default('UTC'),
    objective: text('objective'),
    personality: text('personality'),
    tone: varchar('tone', { length: 500 }),
    systemPrompt: text('system_prompt').notNull(),
    welcomeMessage: text('welcome_message'),
    outOfHoursMessage: text('out_of_hours_message'),
    allowedRules: jsonb('allowed_rules').$type<string[]>().notNull().default([]),
    forbiddenRules: jsonb('forbidden_rules').$type<string[]>().notNull().default([]),
    dataToRequest: jsonb('data_to_request').$type<string[]>().notNull().default([]),
    sensitiveDataForbidden: jsonb('sensitive_data_forbidden').$type<string[]>().notNull().default([]),
    modelProfile: varchar('model_profile', { length: 64 }).notNull().default('openai:gpt-4o-mini'),
    modelParameters: jsonb('model_parameters').$type<Record<string, unknown>>().notNull().default({}),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    publishedBy: uuid('published_by'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    agentIdx: index('agent_versions_agent_idx').on(t.agentId),
    versionUq: uniqueIndex('agent_versions_agent_version_uq').on(t.agentId, t.version),
  }),
);

export type Agent = typeof agents.$inferSelect;
export type NewAgent = typeof agents.$inferInsert;
export type AgentVersion = typeof agentVersions.$inferSelect;
export type NewAgentVersion = typeof agentVersions.$inferInsert;

export type AgentRecord = Agent;
export type AgentVersionRecord = AgentVersion;
