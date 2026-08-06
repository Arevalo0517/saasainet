import { pgTable, uuid, varchar, timestamp, index, uniqueIndex, text } from 'drizzle-orm/pg-core';
import { clientStatusEnum } from './enums.js';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';

export const clients = pgTable(
  'clients',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    legalName: varchar('legal_name', { length: 250 }).notNull(),
    supportEmail: varchar('support_email', { length: 254 }),
    billingEmail: varchar('billing_email', { length: 254 }),
    defaultLocale: varchar('default_locale', { length: 8 }).notNull().default('es'),
    defaultCurrency: varchar('default_currency', { length: 8 }).notNull().default('mxn'),
    webhookAllowedHosts: text('webhook_allowed_hosts').array().notNull().default([]),
    status: clientStatusEnum('status').notNull().default('ACTIVE'),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    distributorKeyIdx: uniqueIndex('clients_distributor_key_idx').on(t.distributorId, t.key),
    platformIdx: index('clients_platform_idx').on(t.platformId),
    distributorIdx: index('clients_distributor_idx').on(t.distributorId),
    statusIdx: index('clients_status_idx').on(t.status),
  }),
);

export type Client = typeof clients.$inferSelect;
export type NewClient = typeof clients.$inferInsert;
