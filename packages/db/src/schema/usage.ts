import { pgTable, uuid, varchar, integer, bigint, timestamp, index } from 'drizzle-orm/pg-core';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';

export const usageEvents = pgTable(
  'usage_events',
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
    agentId: uuid('agent_id'),
    conversationId: uuid('conversation_id'),
    metric: varchar('metric', { length: 40 }).notNull(),
    quantity: integer('quantity').notNull().default(1),
    costCents: bigint('cost_cents', { mode: 'number' }).notNull().default(0),
    modelProfile: varchar('model_profile', { length: 40 }),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientMetricIdx: index('usage_events_client_metric_idx').on(t.clientId, t.metric, t.occurredAt),
    agentIdx: index('usage_events_agent_idx').on(t.agentId, t.occurredAt),
    occurredIdx: index('usage_events_occurred_idx').on(t.occurredAt),
  }),
);

export type UsageEvent = typeof usageEvents.$inferSelect;
export type NewUsageEvent = typeof usageEvents.$inferInsert;
export type UsageEventRecord = UsageEvent;
