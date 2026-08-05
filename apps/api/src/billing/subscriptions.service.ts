import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '@platform/contracts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzlePlanRepository, DrizzleSubscriptionRepository, type SubscriptionRecord } from '../infrastructure/persistence/drizzle/plans.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleClientRepository } from '../infrastructure/persistence/drizzle/distributors.repository.js';

export const SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND';
export const CLIENT_NOT_FOUND_FOR_SUB = 'CLIENT_NOT_FOUND_FOR_SUB';
export const PLAN_VERSION_NOT_FOUND = 'PLAN_VERSION_NOT_FOUND';
export const CROSS_TENANT_SUB = 'CROSS_TENANT_SUB';

export type SubscriptionCreateInput = {
  clientId: string;
  planVersionId: string;
  billingInterval: 'MONTHLY' | 'ANNUAL';
};

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly plans: DrizzlePlanRepository,
    private readonly subs: DrizzleSubscriptionRepository,
    private readonly clients: DrizzleClientRepository,
  ) {}

  async listForScope(ctx: TenantContext): Promise<SubscriptionRecord[]> {
    if (ctx.roles.includes('platform_super_admin') || ctx.isSupportSession) {
      const all = await this.plans.listByPlatform(ctx.platformId, false);
      const first = all[0];
      if (first === undefined) return [];
      return this.subs.listByDistributor(first.id);
    }
    if (ctx.distributorId !== null && ctx.distributorId !== undefined) {
      return this.subs.listByDistributor(ctx.distributorId);
    }
    if (ctx.clientId !== null && ctx.clientId !== undefined) {
      return this.subs.listByClient(ctx.clientId);
    }
    return [];
  }

  async getById(ctx: TenantContext, id: string): Promise<SubscriptionRecord> {
    const sub = await this.subs.findById(id);
    if (sub === null) {
      throw new NotFoundException({ code: SUBSCRIPTION_NOT_FOUND, message: 'Suscripción no encontrada' });
    }
    this.assertScope(ctx, sub);
    return sub;
  }

  async create(ctx: TenantContext, input: SubscriptionCreateInput): Promise<SubscriptionRecord> {
    if (!ctx.roles.some((r) => r === 'platform_super_admin' || r === 'distributor_admin' || r === 'distributor_owner')) {
      throw new ForbiddenException({ code: CROSS_TENANT_SUB, message: 'Rol no autorizado para crear suscripciones' });
    }
    const client = await this.clients.findById(input.clientId);
    if (client === null) {
      throw new NotFoundException({ code: CLIENT_NOT_FOUND_FOR_SUB, message: 'Cliente no encontrado' });
    }
    this.assertClientInScope(ctx, client);
    const version = await this.plans.findVersionById(input.planVersionId);
    if (version === null) {
      throw new NotFoundException({ code: PLAN_VERSION_NOT_FOUND, message: 'Versión de plan no encontrada' });
    }
    const plan = await this.plans.findById(version.planId);
    if (plan === null || plan.platformId !== ctx.platformId) {
      throw new ForbiddenException({ code: CROSS_TENANT_SUB, message: 'Plan no pertenece a tu plataforma' });
    }
    const interval = input.billingInterval;
    const periodStart = new Date();
    const periodEnd = new Date(periodStart);
    if (interval === 'ANNUAL') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }
    return this.subs.create({
      id: crypto.randomUUID(),
      platformId: ctx.platformId,
      distributorId: client.distributorId,
      clientId: client.id,
      planId: plan.id,
      planVersionId: version.id,
      status: 'PENDING_ACTIVATION',
      billingInterval: interval,
      periodStart,
      periodEnd,
      cancelAtPeriodEnd: false,
      metadata: {},
    });
  }

  async cancel(ctx: TenantContext, id: string): Promise<SubscriptionRecord> {
    const sub = await this.subs.findById(id);
    if (sub === null) {
      throw new NotFoundException({ code: SUBSCRIPTION_NOT_FOUND, message: 'Suscripción no encontrada' });
    }
    this.assertScope(ctx, sub);
    return this.subs.update(id, { cancelAtPeriodEnd: true, cancelledAt: new Date(), status: 'CANCELLED' });
  }

  async activate(ctx: TenantContext, id: string): Promise<SubscriptionRecord> {
    const sub = await this.subs.findById(id);
    if (sub === null) {
      throw new NotFoundException({ code: SUBSCRIPTION_NOT_FOUND, message: 'Suscripción no encontrada' });
    }
    this.assertScope(ctx, sub);
    return this.subs.update(id, { status: 'ACTIVE', activatedAt: new Date() });
  }

  private assertScope(ctx: TenantContext, sub: SubscriptionRecord): void {
    if (ctx.roles.includes('platform_super_admin') || ctx.isSupportSession) return;
    if (sub.distributorId === ctx.distributorId) return;
    if (sub.clientId === ctx.clientId) return;
    throw new ForbiddenException({ code: CROSS_TENANT_SUB, message: 'Suscripción fuera de scope' });
  }

  private assertClientInScope(ctx: TenantContext, client: { distributorId: string; platformId: string }): void {
    if (ctx.roles.includes('platform_super_admin')) return;
    if (client.platformId !== ctx.platformId) {
      throw new ForbiddenException({ code: CROSS_TENANT_SUB, message: 'Cliente de otra plataforma' });
    }
    if (ctx.distributorId !== null && ctx.distributorId !== undefined && client.distributorId !== ctx.distributorId) {
      throw new ForbiddenException({ code: CROSS_TENANT_SUB, message: 'Cliente de otro distribuidor' });
    }
  }
}
