import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '@platform/db';
import {
  commissionEntries,
  paymentCustomers,
  payments,
  payouts,
  type CommissionEntry,
  type NewCommissionEntry,
  type NewPayment,
  type NewPaymentCustomer,
  type NewPayout,
  type Payment,
  type PaymentCustomer,
  type Payout,
} from '@platform/db';

export type PaymentRecord = Payment;
export type PaymentCustomerRecord = PaymentCustomer;
export type CommissionEntryRecord = CommissionEntry;
export type PayoutRecord = Payout;

export class DrizzlePaymentRepository {
  constructor(private readonly db: Database) {}

  async findCustomerByProvider(provider: string, providerCustomerId: string): Promise<PaymentCustomerRecord | null> {
    const rows = await this.db
      .select()
      .from(paymentCustomers)
      .where(and(eq(paymentCustomers.provider, provider), eq(paymentCustomers.providerCustomerId, providerCustomerId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findCustomerById(id: string): Promise<PaymentCustomerRecord | null> {
    const rows = await this.db.select().from(paymentCustomers).where(eq(paymentCustomers.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findCustomerByClient(clientId: string, provider: string): Promise<PaymentCustomerRecord | null> {
    const rows = await this.db
      .select()
      .from(paymentCustomers)
      .where(and(eq(paymentCustomers.clientId, clientId), eq(paymentCustomers.provider, provider)))
      .orderBy(desc(paymentCustomers.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async createCustomer(input: NewPaymentCustomer): Promise<PaymentCustomerRecord> {
    const rows = await this.db.insert(paymentCustomers).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('payment_customer create returned no rows');
    return r;
  }

  async findPaymentByProvider(provider: string, providerPaymentId: string): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(and(eq(payments.provider, provider), eq(payments.providerPaymentId, providerPaymentId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPaymentByIdempotency(idempotencyKey: string): Promise<PaymentRecord | null> {
    const rows = await this.db
      .select()
      .from(payments)
      .where(eq(payments.idempotencyKey, idempotencyKey))
      .limit(1);
    return rows[0] ?? null;
  }

  async findPaymentById(id: string): Promise<PaymentRecord | null> {
    const rows = await this.db.select().from(payments).where(eq(payments.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async listPaymentsByClient(clientId: string): Promise<PaymentRecord[]> {
    return this.db
      .select()
      .from(payments)
      .where(eq(payments.clientId, clientId))
      .orderBy(desc(payments.createdAt));
  }

  async createPayment(input: NewPayment): Promise<PaymentRecord> {
    const rows = await this.db.insert(payments).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('payment create returned no rows');
    return r;
  }

  async updatePayment(id: string, patch: Partial<PaymentRecord>): Promise<PaymentRecord> {
    const rows = await this.db.update(payments).set(patch).where(eq(payments.id, id)).returning();
    const r = rows[0];
    if (!r) throw new Error('payment update returned no rows');
    return r;
  }

  async createCommissionEntry(input: NewCommissionEntry): Promise<CommissionEntryRecord> {
    const rows = await this.db.insert(commissionEntries).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('commission_entry create returned no rows');
    return r;
  }

  async findCommissionEntryByPayment(paymentId: string): Promise<CommissionEntryRecord | null> {
    const rows = await this.db
      .select()
      .from(commissionEntries)
      .where(eq(commissionEntries.paymentId, paymentId))
      .limit(1);
    return rows[0] ?? null;
  }

  async listCommissionsByDistributor(distributorId: string): Promise<CommissionEntryRecord[]> {
    return this.db
      .select()
      .from(commissionEntries)
      .where(eq(commissionEntries.distributorId, distributorId))
      .orderBy(desc(commissionEntries.createdAt));
  }

  async listPayoutsByDistributor(distributorId: string): Promise<PayoutRecord[]> {
    return this.db
      .select()
      .from(payouts)
      .where(eq(payouts.distributorId, distributorId))
      .orderBy(desc(payouts.createdAt));
  }

  async findPayoutById(id: string): Promise<PayoutRecord | null> {
    const rows = await this.db.select().from(payouts).where(eq(payouts.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createPayout(input: NewPayout): Promise<PayoutRecord> {
    const rows = await this.db.insert(payouts).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('payout create returned no rows');
    return r;
  }
}
