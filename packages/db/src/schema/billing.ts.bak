import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex, integer, jsonb } from 'drizzle-orm/pg-core';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';

export const paymentCustomers = pgTable(
  'payment_customers',
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
    provider: varchar('provider', { length: 32 }).notNull(),
    providerCustomerId: varchar('provider_customer_id', { length: 200 }).notNull(),
    defaultPaymentMethodId: varchar('default_payment_method_id', { length: 200 }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index('payment_customers_client_idx').on(t.clientId),
    providerCustomerIdx: uniqueIndex('payment_customers_provider_idx').on(t.provider, t.providerCustomerId),
  }),
);

export const payments = pgTable(
  'payments',
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
    paymentCustomerId: uuid('payment_customer_id')
      .notNull()
      .references(() => paymentCustomers.id, { onDelete: 'restrict' }),
    provider: varchar('provider', { length: 32 }).notNull(),
    providerPaymentId: varchar('provider_payment_id', { length: 200 }).notNull(),
    kind: varchar('kind', { length: 24 }).notNull().default('SUBSCRIPTION'),
    amountCents: integer('amount_cents').notNull(),
    currency: varchar('currency', { length: 8 }).notNull().default('mxn'),
    status: varchar('status', { length: 24 }).notNull().default('PENDING'),
    description: text('description'),
    idempotencyKey: varchar('idempotency_key', { length: 200 }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    failedAt: timestamp('failed_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    clientIdx: index('payments_client_idx').on(t.clientId),
    statusIdx: index('payments_status_idx').on(t.status),
    providerPaymentIdx: uniqueIndex('payments_provider_payment_idx').on(t.provider, t.providerPaymentId),
    idempotencyIdx: uniqueIndex('payments_idempotency_idx').on(t.idempotencyKey),
  }),
);

export const commissionEntries = pgTable(
  'commission_entries',
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
    paymentId: uuid('payment_id')
      .notNull()
      .references(() => payments.id, { onDelete: 'restrict' }),
    currency: varchar('currency', { length: 8 }).notNull().default('mxn'),
    eligibleAmountCents: integer('eligible_amount_cents').notNull(),
    commissionRate: varchar('commission_rate', { length: 8 }).notNull().default('0.20'),
    commissionAmountCents: integer('commission_amount_cents').notNull(),
    status: varchar('status', { length: 24 }).notNull().default('PENDING_AVAILABLE'),
    availableAt: timestamp('available_at', { withTimezone: true, mode: 'date' }),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    payoutId: uuid('payout_id'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    distributorIdx: index('commission_entries_distributor_idx').on(t.distributorId),
    statusIdx: index('commission_entries_status_idx').on(t.status),
    paymentIdx: uniqueIndex('commission_entries_payment_idx').on(t.paymentId),
    distributorStatusIdx: index('commission_entries_distributor_status_idx').on(t.distributorId, t.status),
  }),
);

export const payouts = pgTable(
  'payouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    currency: varchar('currency', { length: 8 }).notNull().default('mxn'),
    totalAmountCents: integer('total_amount_cents').notNull().default(0),
    status: varchar('status', { length: 24 }).notNull().default('PENDING'),
    periodStart: timestamp('period_start', { withTimezone: true, mode: 'date' }).notNull(),
    periodEnd: timestamp('period_end', { withTimezone: true, mode: 'date' }).notNull(),
    paidAt: timestamp('paid_at', { withTimezone: true, mode: 'date' }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  },
  (t) => ({
    distributorIdx: index('payouts_distributor_idx').on(t.distributorId),
    statusIdx: index('payouts_status_idx').on(t.status),
    distributorPeriodIdx: uniqueIndex('payouts_distributor_period_idx').on(
      t.distributorId,
      t.periodStart,
      t.periodEnd,
    ),
  }),
);

export type PaymentCustomer = typeof paymentCustomers.$inferSelect;
export type NewPaymentCustomer = typeof paymentCustomers.$inferInsert;
export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;
export type CommissionEntry = typeof commissionEntries.$inferSelect;
export type NewCommissionEntry = typeof commissionEntries.$inferInsert;
export type Payout = typeof payouts.$inferSelect;
export type NewPayout = typeof payouts.$inferInsert;
