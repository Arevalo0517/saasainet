import { pgTable, uuid, varchar, text, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { mfaMethodTypeEnum, mfaMethodStatusEnum } from './enums.js';
import { users } from './users.js';

export const mfaMethods = pgTable(
  'mfa_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: mfaMethodTypeEnum('type').notNull(),
    status: mfaMethodStatusEnum('status').notNull().default('PENDING_VERIFICATION'),
    secretEncrypted: text('secret_encrypted'),
    destination: varchar('destination', { length: 254 }),
    isPrimary: boolean('is_primary').notNull().default(false),
    verifiedAt: timestamp('verified_at', { withTimezone: true, mode: 'date' }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('mfa_methods_user_idx').on(t.userId),
    userPrimaryIdx: index('mfa_methods_user_primary_idx').on(t.userId, t.isPrimary),
  }),
);

export type MfaMethod = typeof mfaMethods.$inferSelect;
export type NewMfaMethod = typeof mfaMethods.$inferInsert;
