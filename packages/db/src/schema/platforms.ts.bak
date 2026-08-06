import { pgTable, uuid, varchar, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const platforms = pgTable(
  'platforms',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    key: varchar('key', { length: 64 }).notNull(),
    name: varchar('name', { length: 200 }).notNull(),
    legalName: varchar('legal_name', { length: 250 }).notNull(),
    supportEmail: varchar('support_email', { length: 254 }),
    billingEmail: varchar('billing_email', { length: 254 }),
    defaultLocale: varchar('default_locale', { length: 8 }).notNull().default('es'),
    defaultCurrency: varchar('default_currency', { length: 8 }).notNull().default('mxn'),
    whiteLabelEnabled: boolean('white_label_enabled').notNull().default(false),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    keyIdx: uniqueIndex('platforms_key_idx').on(t.key),
    activeIdx: index('platforms_active_idx').on(t.active),
  }),
);

export type Platform = typeof platforms.$inferSelect;
export type NewPlatform = typeof platforms.$inferInsert;
