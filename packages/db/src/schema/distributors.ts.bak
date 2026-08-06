import { pgTable, uuid, varchar, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { distributorStatusEnum } from './enums.js';
import { platforms } from './platforms.js';

export const distributors = pgTable(
  'distributors',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    legalName: varchar('legal_name', { length: 250 }).notNull(),
    supportEmail: varchar('support_email', { length: 254 }),
    billingEmail: varchar('billing_email', { length: 254 }),
    defaultLocale: varchar('default_locale', { length: 8 }).notNull().default('es'),
    defaultCurrency: varchar('default_currency', { length: 8 }).notNull().default('mxn'),
    whiteLabelEnabled: boolean('white_label_enabled').notNull().default(false),
    logoUrl: varchar('logo_url', { length: 500 }),
    primaryColor: varchar('primary_color', { length: 16 }),
    secondaryColor: varchar('secondary_color', { length: 16 }),
    customDomain: varchar('custom_domain', { length: 253 }),
    status: distributorStatusEnum('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    platformKeyIdx: uniqueIndex('distributors_platform_key_idx').on(t.platformId, t.key),
    platformIdx: index('distributors_platform_idx').on(t.platformId),
    statusIdx: index('distributors_status_idx').on(t.status),
    customDomainIdx: index('distributors_custom_domain_idx').on(t.customDomain),
  }),
);

export type Distributor = typeof distributors.$inferSelect;
export type NewDistributor = typeof distributors.$inferInsert;
