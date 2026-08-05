import { and, asc, desc, eq } from 'drizzle-orm';
import type { Database } from '@platform/db';
import {
  plans,
  planVersions,
  subscriptions,
  type NewPlan,
  type NewPlanVersion,
  type NewSubscription,
  type Plan,
  type PlanVersion,
  type Subscription,
} from '@platform/db';

export type PlanRecord = Plan;
export type PlanVersionRecord = PlanVersion;
export type SubscriptionRecord = Subscription;

export class DrizzlePlanRepository {
  constructor(private readonly db: Database) {}

  async listByPlatform(platformId: string, publicOnly: boolean): Promise<PlanRecord[]> {
    const q = this.db
      .select()
      .from(plans)
      .where(publicOnly ? and(eq(plans.platformId, platformId), eq(plans.isPublic, true), eq(plans.active, true)) : eq(plans.platformId, platformId))
      .orderBy(asc(plans.name));
    return q;
  }

  async findById(id: string): Promise<PlanRecord | null> {
    const rows = await this.db.select().from(plans).where(eq(plans.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByCode(platformId: string, code: string): Promise<PlanRecord | null> {
    const rows = await this.db
      .select()
      .from(plans)
      .where(and(eq(plans.platformId, platformId), eq(plans.code, code)))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewPlan): Promise<PlanRecord> {
    const rows = await this.db.insert(plans).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('plan create returned no rows');
    return r;
  }

  async update(id: string, patch: Partial<PlanRecord>): Promise<PlanRecord> {
    const rows = await this.db
      .update(plans)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('plan update returned no rows');
    return r;
  }

  async listVersions(planId: string, activeOnly: boolean): Promise<PlanVersionRecord[]> {
    const q = this.db
      .select()
      .from(planVersions)
      .where(activeOnly ? and(eq(planVersions.planId, planId), eq(planVersions.active, true)) : eq(planVersions.planId, planId))
      .orderBy(desc(planVersions.version));
    return q;
  }

  async findVersionById(id: string): Promise<PlanVersionRecord | null> {
    const rows = await this.db.select().from(planVersions).where(eq(planVersions.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async createVersion(input: NewPlanVersion): Promise<PlanVersionRecord> {
    const rows = await this.db.insert(planVersions).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('plan_version create returned no rows');
    return r;
  }
}

export class DrizzleSubscriptionRepository {
  constructor(private readonly db: Database) {}

  async listByClient(clientId: string): Promise<SubscriptionRecord[]> {
    return this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.clientId, clientId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async listByDistributor(distributorId: string): Promise<SubscriptionRecord[]> {
    return this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.distributorId, distributorId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async findById(id: string): Promise<SubscriptionRecord | null> {
    const rows = await this.db.select().from(subscriptions).where(eq(subscriptions.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findActiveByClient(clientId: string): Promise<SubscriptionRecord | null> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.clientId, clientId), eq(subscriptions.status, 'ACTIVE')))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewSubscription): Promise<SubscriptionRecord> {
    const rows = await this.db.insert(subscriptions).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('subscription create returned no rows');
    return r;
  }

  async update(id: string, patch: Partial<SubscriptionRecord>): Promise<SubscriptionRecord> {
    const rows = await this.db
      .update(subscriptions)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(subscriptions.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('subscription update returned no rows');
    return r;
  }
}
