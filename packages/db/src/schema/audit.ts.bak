import { pgTable, uuid, varchar, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';

export const auditEvents = pgTable(
  'audit_events',
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
    actorUserId: uuid('actor_user_id'),
    actorRole: varchar('actor_role', { length: 64 }),
    action: varchar('action', { length: 80 }).notNull(),
    resourceType: varchar('resource_type', { length: 64 }).notNull(),
    resourceId: varchar('resource_id', { length: 64 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    clientActionIdx: index('audit_events_client_action_idx').on(t.clientId, t.action, t.createdAt),
    resourceIdx: index('audit_events_resource_idx').on(t.resourceType, t.resourceId),
    actorIdx: index('audit_events_actor_idx').on(t.actorUserId, t.createdAt),
  }),
);

export type AuditEvent = typeof auditEvents.$inferSelect;
export type NewAuditEvent = typeof auditEvents.$inferInsert;
export type AuditEventRecord = AuditEvent;
