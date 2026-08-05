import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Currency, TenantContext } from '@platform/contracts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { MockPaymentProvider } from '@platform/payment-providers';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzlePlanRepository,
  DrizzleSubscriptionRepository,
} from '../infrastructure/persistence/drizzle/plans.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleClientRepository } from '../infrastructure/persistence/drizzle/distributors.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzlePaymentRepository,
  type CommissionEntryRecord,
  type PaymentRecord,
} from '../infrastructure/persistence/drizzle/payments.repository.js';
import { DEFAULT_COMMISSION_RATE } from '@platform/db';

export const PAYMENT_NOT_FOUND = 'PAYMENT_NOT_FOUND';
export const CHECKOUT_INVALID = 'CHECKOUT_INVALID';
export const WEBHOOK_INVALID_SIGNATURE = 'WEBHOOK_INVALID_SIGNATURE';
export const CROSS_TENANT_PAYMENT = 'CROSS_TENANT_PAYMENT';

const COMMISSION_AVAILABLE_DELAY_MS = 1000 * 60 * 60 * 24 * 7;

@Injectable()
export class PaymentsService {
  constructor(
    private readonly plans: DrizzlePlanRepository,
    private readonly subs: DrizzleSubscriptionRepository,
    private readonly clients: DrizzleClientRepository,
    private readonly payments: DrizzlePaymentRepository,
    private readonly provider: MockPaymentProvider,
  ) {}

  async createCheckout(
    ctx: TenantContext,
    input: {
      clientId: string;
      planVersionId: string;
      billingInterval: 'MONTHLY' | 'ANNUAL';
      successUrl: string;
      cancelUrl: string;
    },
  ): Promise<{ checkoutUrl: string; providerReference: string; paymentId: string }> {
    const client = await this.clients.findById(input.clientId);
    if (client === null) {
      throw new NotFoundException({ code: CHECKOUT_INVALID, message: 'Cliente no encontrado' });
    }
    if (client.platformId !== ctx.platformId) {
      throw new ForbiddenException({ code: CROSS_TENANT_PAYMENT, message: 'Cliente de otra plataforma' });
    }
    if (ctx.distributorId !== null && ctx.distributorId !== undefined && client.distributorId !== ctx.distributorId) {
      throw new ForbiddenException({ code: CROSS_TENANT_PAYMENT, message: 'Cliente de otro distribuidor' });
    }
    const version = await this.plans.findVersionById(input.planVersionId);
    if (version === null) {
      throw new NotFoundException({ code: CHECKOUT_INVALID, message: 'Versión de plan no encontrada' });
    }
    const plan = await this.plans.findById(version.planId);
    if (plan === null || plan.platformId !== ctx.platformId) {
      throw new ForbiddenException({ code: CROSS_TENANT_PAYMENT, message: 'Plan no pertenece a tu plataforma' });
    }
    const amountCents = input.billingInterval === 'ANNUAL' ? version.annualPriceCents ?? version.monthlyPriceCents * 12 : version.monthlyPriceCents;
    const currency: Currency = version.currency as Currency;
    const idempotencyKey = `checkout:${client.id}:${version.id}:${input.billingInterval}:${randomUUID()}`;

    const checkout = await this.provider.createCheckout({
      clientId: client.id,
      distributorId: client.distributorId,
      kind: 'SUBSCRIPTION',
      amountCents,
      currency,
      description: `Suscripción ${plan.name} ${version.name} (${input.billingInterval})`,
      successUrl: input.successUrl,
      cancelUrl: input.cancelUrl,
      metadata: { planId: plan.id, planVersionId: version.id, billingInterval: input.billingInterval, clientId: client.id },
      idempotencyKey,
    });

    let customer = await this.payments.findCustomerByClient(client.id, this.provider.name);
    if (customer === null) {
      customer = await this.payments.createCustomer({
        id: randomUUID(),
        platformId: ctx.platformId,
        distributorId: client.distributorId,
        clientId: client.id,
        provider: this.provider.name,
        providerCustomerId: `mock_cus_${randomUUID().replace(/-/g, '').slice(0, 16)}`,
      });
    }

    const existing = await this.payments.findPaymentByIdempotency(idempotencyKey);
    const payment =
      existing ??
      (await this.payments.createPayment({
        id: randomUUID(),
        platformId: ctx.platformId,
        distributorId: client.distributorId,
        clientId: client.id,
        paymentCustomerId: customer.id,
        provider: this.provider.name,
        providerPaymentId: checkout.providerReference,
        kind: 'SUBSCRIPTION',
        amountCents,
        currency,
        status: 'PENDING',
        description: `Suscripción ${plan.name} ${version.name}`,
        idempotencyKey,
        metadata: { planId: plan.id, planVersionId: version.id, billingInterval: input.billingInterval, checkoutUrl: checkout.checkoutUrl },
      }));

    return { checkoutUrl: checkout.checkoutUrl, providerReference: checkout.providerReference, paymentId: payment.id };
  }

  async handleWebhook(rawBody: string, signatureHeader: string): Promise<{ ok: true; paymentId: string; commissionId?: string }> {
    let event;
    try {
      event = await this.provider.verifyWebhook({ rawBody, headers: {}, signatureHeader });
    } catch (e) {
      const err = e as Error;
      throw new BadRequestException({ code: WEBHOOK_INVALID_SIGNATURE, message: err.message });
    }

    const existing = await this.payments.findPaymentByProvider(this.provider.name, event.providerPaymentId);
    if (existing === null) {
      throw new NotFoundException({ code: PAYMENT_NOT_FOUND, message: 'Pago no encontrado para providerPaymentId' });
    }

    if (event.status === 'SUCCEEDED' && existing.status !== 'SUCCEEDED') {
      const paid = await this.payments.updatePayment(existing.id, { status: 'SUCCEEDED', paidAt: new Date() });
      const commission = await this.recordCommission(paid);
      await this.activateSubscriptionFromPayment(paid);
      return { ok: true, paymentId: paid.id, commissionId: commission?.id };
    }
    if (event.status === 'FAILED' && existing.status !== 'FAILED') {
      const failed = await this.payments.updatePayment(existing.id, { status: 'FAILED', failedAt: new Date() });
      return { ok: true, paymentId: failed.id };
    }
    if (event.status === 'REFUNDED' && existing.status !== 'REFUNDED') {
      const refunded = await this.payments.updatePayment(existing.id, { status: 'REFUNDED' });
      return { ok: true, paymentId: refunded.id };
    }
    return { ok: true, paymentId: existing.id };
  }

  async listForScope(ctx: TenantContext): Promise<PaymentRecord[]> {
    if (ctx.roles.includes('platform_super_admin') || ctx.isSupportSession) {
      const all = await this.plans.listByPlatform(ctx.platformId, false);
      if (all.length === 0) return [];
      const targetId = ctx.clientId ?? all[0]?.id;
      if (targetId === undefined) return [];
      return this.payments.listPaymentsByClient(targetId);
    }
    if (ctx.distributorId !== null && ctx.distributorId !== undefined) {
      return this.payments.listPaymentsByClient(ctx.distributorId);
    }
    if (ctx.clientId !== null && ctx.clientId !== undefined) {
      return this.payments.listPaymentsByClient(ctx.clientId);
    }
    return [];
  }

  async listCommissions(ctx: TenantContext, distributorId: string): Promise<CommissionEntryRecord[]> {
    if (ctx.distributorId !== null && ctx.distributorId !== undefined && distributorId !== ctx.distributorId) {
      throw new ForbiddenException({ code: CROSS_TENANT_PAYMENT, message: 'Comisiones de otro distribuidor' });
    }
    return this.payments.listCommissionsByDistributor(distributorId);
  }

  signMockBody(rawBody: string): string {
    return this.provider.signBody(rawBody);
  }

  private async recordCommission(payment: PaymentRecord): Promise<CommissionEntryRecord | null> {
    const existing = await this.payments.findCommissionEntryByPayment(payment.id);
    if (existing !== null) return existing;
    const rate = Number.parseFloat(DEFAULT_COMMISSION_RATE);
    const commissionCents = Math.round(payment.amountCents * rate);
    return this.payments.createCommissionEntry({
      id: randomUUID(),
      platformId: payment.platformId,
      distributorId: payment.distributorId,
      clientId: payment.clientId,
      paymentId: payment.id,
      currency: payment.currency,
      eligibleAmountCents: payment.amountCents,
      commissionRate: DEFAULT_COMMISSION_RATE,
      commissionAmountCents: commissionCents,
      status: 'PENDING_AVAILABLE',
      availableAt: new Date(Date.now() + COMMISSION_AVAILABLE_DELAY_MS),
    });
  }

  private async activateSubscriptionFromPayment(payment: PaymentRecord): Promise<void> {
    const meta = (payment.metadata ?? {}) as { planVersionId?: string; billingInterval?: 'MONTHLY' | 'ANNUAL'; planId?: string };
    if (meta.planVersionId === undefined || meta.billingInterval === undefined) return;
    const interval = meta.billingInterval;
    const planId = meta.planId ?? payment.id;
    const sub = await this.subs.findActiveByClient(payment.clientId);
    if (sub !== null) {
      await this.subs.update(sub.id, { status: 'ACTIVE', activatedAt: new Date(), planVersionId: meta.planVersionId, billingInterval: interval });
      return;
    }
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (interval === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    await this.subs.create({
      id: randomUUID(),
      platformId: payment.platformId,
      distributorId: payment.distributorId,
      clientId: payment.clientId,
      planId,
      planVersionId: meta.planVersionId,
      status: 'ACTIVE',
      billingInterval: interval,
      periodStart,
      periodEnd,
      activatedAt: new Date(),
      metadata: { activatedFromPayment: payment.id },
    });
  }
}
