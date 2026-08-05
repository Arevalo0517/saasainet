import { pgTable, uuid, varchar, timestamp, boolean, integer, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { userStatusEnum } from './enums.js';
import { platforms } from './platforms.js';

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    email: varchar('email', { length: 254 }).notNull(),
    emailNormalized: varchar('email_normalized', { length: 254 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 200 }),
    locale: varchar('locale', { length: 8 }).notNull().default('es'),
    status: userStatusEnum('status').notNull().default('PENDING_VERIFICATION'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
    failedLoginAttempts: integer('failed_login_attempts').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true, mode: 'date' }),
    passwordChangedAt: timestamp('password_changed_at', { withTimezone: true, mode: 'date' }).defaultNow(),
    mfaEnabled: boolean('mfa_enabled').notNull().default(false),
    isPlatformSuperAdmin: boolean('is_platform_super_admin').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    platformEmailIdx: uniqueIndex('users_platform_email_idx').on(t.platformId, t.emailNormalized),
    platformIdx: index('users_platform_idx').on(t.platformId),
    statusIdx: index('users_status_idx').on(t.status),
  }),
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
