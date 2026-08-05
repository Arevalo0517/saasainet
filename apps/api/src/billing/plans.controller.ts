import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
import type { CreatePlanDto, CreatePlanVersionDto } from './dto/plan.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { PlansService } from './plans.service.js';
import type { PlanRecord, PlanVersionRecord } from '../infrastructure/persistence/drizzle/plans.repository.js';

const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing — JwtGuard debe correr antes');
  return ctx;
};

const toPlanDto = (p: PlanRecord): Record<string, unknown> => ({
  id: p.id,
  platformId: p.platformId,
  code: p.code,
  name: p.name,
  description: p.description,
  isPublic: p.isPublic,
  active: p.active,
  createdAt: p.createdAt.toISOString(),
  updatedAt: p.updatedAt.toISOString(),
});

const toPlanVersionDto = (v: PlanVersionRecord): Record<string, unknown> => ({
  id: v.id,
  planId: v.planId,
  version: v.version,
  name: v.name,
  description: v.description,
  currency: v.currency,
  monthlyPriceCents: v.monthlyPriceCents,
  annualPriceCents: v.annualPriceCents,
  includedMessageCredits: v.includedMessageCredits,
  overageUnitPriceCents: v.overageUnitPriceCents,
  features: v.features,
  active: v.active,
  createdAt: v.createdAt.toISOString(),
});

@ApiTags('plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly service: PlansService) {}

  @Get()
  @ApiOperation({ summary: 'Lista planes públicos (sin auth)' })
  async listPublic(): Promise<{ items: Array<Record<string, unknown>> }> {
    const items = await this.service.listPublic();
    return { items: items.map((p) => toPlanDto(p)) };
  }

  @Get('me')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Lista todos los planes de la plataforma del usuario autenticado' })
  async listForPlatform(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listForPlatform(ctx);
    return { items: items.map((p) => toPlanDto(p)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un plan con versiones' })
  async getOne(@Param('id') id: string): Promise<{ plan: Record<string, unknown>; versions: Array<Record<string, unknown>> }> {
    const result = await this.service.getByIdWithVersions(id);
    return { plan: toPlanDto(result.plan), versions: result.versions.map(toPlanVersionDto) };
  }

  @Post()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Crea plan (platform_super_admin)' })
  async create(@Req() req: Request, @Body() dto: CreatePlanDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const p = await this.service.create(ctx, {
      id: crypto.randomUUID(),
      platformId: ctx.platformId,
      code: dto.code,
      name: dto.name,
      description: dto.description ?? null,
      isPublic: dto.isPublic ?? true,
      active: dto.active ?? true,
    });
    return toPlanDto(p);
  }

  @Post(':id/versions')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Crea una versión de plan (platform_super_admin)' })
  async addVersion(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreatePlanVersionDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const v = await this.service.addVersion(ctx, id, {
      monthlyPriceCents: dto.monthlyPriceCents,
      annualPriceCents: dto.annualPriceCents ?? null,
      includedMessageCredits: dto.includedMessageCredits,
      overageUnitPriceCents: dto.overageUnitPriceCents,
      features: dto.features ?? [],
      name: dto.name,
      description: dto.description ?? null,
    });
    return toPlanVersionDto(v);
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Actualiza plan (platform_super_admin)' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: Partial<CreatePlanDto>,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const p = await this.service.update(ctx, id, dto);
    return toPlanDto(p);
  }
}
