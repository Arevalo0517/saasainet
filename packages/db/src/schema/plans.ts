import { pgTable, uuid, varchar, text, timestamp, boolean, index, uniqueIndex, integer, jsonb } from 'drizzle-orm/pg-core';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';

export const plans = pgTable(
  'plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    code: varchar('code', { length: 64 }).notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    isPublic: boolean('is_public').notNull().default(true),
    active: boolean('active').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    platformCodeIdx: uniqueIndex('plans_platform_code_idx').on(t.platformId, t.code),
    platformIdx: index('plans_platform_idx').on(t.platformId),
    activeIdx: index('plans_active_idx').on(t.active),
  }),
);

export const planVersions = pgTable(
  'plan_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    name: varchar('name', { length: 120 }).notNull(),
    description: text('description'),
    currency: varchar('currency', { length: 8 }).notNull().default('mxn'),
    monthlyPriceCents: integer('monthly_price_cents').notNull(),
    annualPriceCents: integer('annual_price_cents'),
    includedMessageCredits: integer('included_message_credits').notNull().default(0),
    overageUnitPriceCents: integer('overage_unit_price_cents').notNull().default(0),
    features: jsonb('features').$type<string[]>().notNull().default([]),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    planVersionIdx: uniqueIndex('plan_versions_plan_version_idx').on(t.planId, t.version),
    planIdx: index('plan_versions_plan_idx').on(t.planId),
  }),
);

export const subscriptions = pgTable(
  'subscriptions',
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
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'restrict' }),
    planVersionId: uuid('plan_version_id')
      .notNull()
      .references(() => planVersions.id, { onDelete: 'restrict' }),
    status: varchar('status', { length: 24 }).notNull().default('PENDING_ACTIVATION'),
    billingInterval: varchar('billing_interval', { length: 16 }).notNull().default('MONTHLY'),
    periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }).notNull(),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' }),
    activatedAt: timestamp('activated_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index('subscriptions_client_idx').on(t.clientId),
    distributorIdx: index('subscriptions_distributor_idx').on(t.distributorId),
    statusIdx: index('subscriptions_status_idx').on(t.status),
    clientPlanIdx: index('subscriptions_client_plan_idx').on(t.clientId, t.status),
  }),
);

export type Plan = typeof plans.$inferSelect;
export type NewPlan = typeof plans.$inferInsert;
export type PlanVersion = typeof planVersions.$inferSelect;
export type NewPlanVersion = typeof planVersions.$inferInsert;
export type Subscription = typeof subscriptions.$inferSelect;
export type NewSubscription = typeof subscriptions.$inferInsert;

export const DEFAULT_COMMISSION_RATE = '0.20';
