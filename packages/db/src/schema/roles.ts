import { pgTable, uuid, varchar, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { userRoleScopeEnum } from './enums.js';

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    scope: userRoleScopeEnum('scope').notNull(),
    isSystem: varchar('is_system', { length: 1 }).notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    keyIdx: uniqueIndex('roles_key_idx').on(t.key),
  }),
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
