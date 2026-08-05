import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '@platform/contracts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzlePlanRepository, type PlanRecord, type PlanVersionRecord } from '../infrastructure/persistence/drizzle/plans.repository.js';

export const PLAN_NOT_FOUND = 'PLAN_NOT_FOUND';
export const PLAN_VERSION_NOT_FOUND = 'PLAN_VERSION_NOT_FOUND';
export const CROSS_PLATFORM_ACCESS = 'CROSS_PLATFORM_ACCESS';

@Injectable()
export class PlansService {
  constructor(private readonly repo: DrizzlePlanRepository) {}

  async listPublic(): Promise<PlanRecord[]> {
    return this.repo.listByPlatform('f0000001-0000-4000-8000-000000000001', true);
  }

  async listForPlatform(ctx: TenantContext): Promise<PlanRecord[]> {
    this.assertPlatformAdmin(ctx);
    return this.repo.listByPlatform(ctx.platformId, false);
  }

  async getByIdWithVersions(id: string): Promise<{ plan: PlanRecord; versions: PlanVersionRecord[] }> {
    const plan = await this.repo.findById(id);
    if (plan === null) {
      throw new NotFoundException({ code: PLAN_NOT_FOUND, message: 'Plan no encontrado' });
    }
    const versions = await this.repo.listVersions(id, false);
    return { plan, versions };
  }

  async create(ctx: TenantContext, input: Omit<PlanRecord, 'createdAt' | 'updatedAt' | 'metadata'>): Promise<PlanRecord> {
    this.assertPlatformAdmin(ctx);
    return this.repo.create({ ...input, metadata: {} });
  }

  async addVersion(
    ctx: TenantContext,
    planId: string,
    input: Omit<PlanVersionRecord, 'id' | 'planId' | 'version' | 'active' | 'createdAt' | 'currency'>,
  ): Promise<PlanVersionRecord> {
    this.assertPlatformAdmin(ctx);
    const plan = await this.repo.findById(planId);
    if (plan === null) {
      throw new NotFoundException({ code: PLAN_NOT_FOUND, message: 'Plan no encontrado' });
    }
    if (plan.platformId !== ctx.platformId) {
      throw new ForbiddenException({ code: CROSS_PLATFORM_ACCESS, message: 'Plan pertenece a otra plataforma' });
    }
    const existing = await this.repo.listVersions(planId, false);
    const nextVersion = existing.length === 0 ? 1 : Math.max(...existing.map((v) => v.version)) + 1;
    return this.repo.createVersion({
      planId,
      version: nextVersion,
      active: true,
      currency: 'mxn',
      ...input,
    });
  }

  async update(ctx: TenantContext, id: string, patch: Partial<Pick<PlanRecord, 'name' | 'description' | 'isPublic' | 'active'>>): Promise<PlanRecord> {
    this.assertPlatformAdmin(ctx);
    const plan = await this.repo.findById(id);
    if (plan === null) {
      throw new NotFoundException({ code: PLAN_NOT_FOUND, message: 'Plan no encontrado' });
    }
    if (plan.platformId !== ctx.platformId) {
      throw new ForbiddenException({ code: CROSS_PLATFORM_ACCESS, message: 'Plan pertenece a otra plataforma' });
    }
    const filtered: Partial<PlanRecord> = {};
    if (patch.name !== undefined) filtered.name = patch.name;
    if (patch.description !== undefined) filtered.description = patch.description;
    if (patch.isPublic !== undefined) filtered.isPublic = patch.isPublic;
    if (patch.active !== undefined) filtered.active = patch.active;
    return this.repo.update(plan.id, filtered);
  }

  private assertPlatformAdmin(ctx: TenantContext): void {
    if (!ctx.roles.includes('platform_super_admin')) {
      throw new ForbiddenException({ code: CROSS_PLATFORM_ACCESS, message: 'Solo platform_super_admin puede gestionar planes' });
    }
  }
}
