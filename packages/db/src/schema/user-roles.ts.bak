import { pgTable, uuid, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { roles } from './roles.js';

export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'restrict' }),
    platformId: uuid('platform_id').notNull(),
    distributorId: uuid('distributor_id'),
    clientId: uuid('client_id'),
    isActive: boolean('is_active').notNull().default(true),
    grantedAt: timestamp('granted_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    grantedBy: uuid('granted_by'),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    revokedBy: uuid('revoked_by'),
  },
  (t) => ({
    userIdx: index('user_roles_user_idx').on(t.userId),
    platformIdx: index('user_roles_platform_idx').on(t.platformId),
    distributorIdx: index('user_roles_distributor_idx').on(t.distributorId),
    clientIdx: index('user_roles_client_idx').on(t.clientId),
    roleScopeUnique: uniqueIndex('user_roles_scope_unique').on(
      t.userId,
      t.roleId,
      t.platformId,
      t.distributorId,
      t.clientId,
    ),
  }),
);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;
