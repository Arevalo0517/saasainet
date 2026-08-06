import { pgTable, uuid, varchar, timestamp, inet, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { invitationStatusEnum } from './enums.js';
import { users } from './users.js';

export const invitations = pgTable(
  'invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id').notNull(),
    distributorId: uuid('distributor_id'),
    clientId: uuid('client_id'),
    email: varchar('email', { length: 254 }).notNull(),
    emailNormalized: varchar('email_normalized', { length: 254 }).notNull(),
    roleKey: varchar('role_key', { length: 64 }).notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    invitedBy: uuid('invited_by').references(() => users.id, { onDelete: 'set null' }),
    status: invitationStatusEnum('status').notNull().default('PENDING'),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    acceptedBy: uuid('accepted_by').references(() => users.id, { onDelete: 'set null' }),
    ipAccepted: inet('ip_accepted'),
    userAgentAccepted: varchar('user_agent_accepted', { length: 500 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    tokenIdx: uniqueIndex('invitations_token_idx').on(t.tokenHash),
    emailIdx: index('invitations_email_idx').on(t.emailNormalized),
    platformIdx: index('invitations_platform_idx').on(t.platformId),
    statusIdx: index('invitations_status_idx').on(t.status),
  }),
);

export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
