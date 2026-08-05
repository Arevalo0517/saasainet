import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
import type { CreateSubscriptionDto, UpdateSubscriptionDto } from './dto/subscription.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { SubscriptionsService } from './subscriptions.service.js';
import type { SubscriptionRecord } from '../infrastructure/persistence/drizzle/plans.repository.js';

const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing — JwtGuard debe correr antes');
  return ctx;
};

const toDto = (s: SubscriptionRecord): Record<string, unknown> => ({
  id: s.id,
  platformId: s.platformId,
  distributorId: s.distributorId,
  clientId: s.clientId,
  planId: s.planId,
  planVersionId: s.planVersionId,
  status: s.status,
  billingInterval: s.billingInterval,
  periodStart: s.periodStart.toISOString(),
  periodEnd: s.periodEnd.toISOString(),
  cancelAtPeriodEnd: s.cancelAtPeriodEnd,
  cancelledAt: s.cancelledAt?.toISOString() ?? null,
  activatedAt: s.activatedAt?.toISOString() ?? null,
  createdAt: s.createdAt.toISOString(),
  updatedAt: s.updatedAt.toISOString(),
});

@ApiTags('subscriptions')
@Controller('subscriptions')
@UseGuards(JwtGuard)
export class SubscriptionsController {
  constructor(private readonly service: SubscriptionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista suscripciones según scope' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listForScope(ctx);
    return { items: items.map(toDto) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una suscripción' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toDto(await this.service.getById(ctx, id));
  }

  @Post()
  @ApiOperation({ summary: 'Crea una suscripción (distributor_owner/admin)' })
  async create(@Req() req: Request, @Body() dto: CreateSubscriptionDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const sub = await this.service.create(ctx, {
      clientId: dto.clientId,
      planVersionId: dto.planVersionId,
      billingInterval: dto.billingInterval ?? 'MONTHLY',
    });
    return toDto(sub);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancela una suscripción' })
  async cancel(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toDto(await this.service.cancel(ctx, id));
  }

  @Patch(':id/activate')
  @ApiOperation({ summary: 'Activa una suscripción (post-pago)' })
  async activate(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toDto(await this.service.activate(ctx, id));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza estado (genérico)' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const current = await this.service.getById(ctx, id);
    if (dto.status === 'ACTIVE' && current.status !== 'ACTIVE') {
      return toDto(await this.service.activate(ctx, id));
    }
    if (dto.status === 'CANCELLED' && current.status !== 'CANCELLED') {
      return toDto(await this.service.cancel(ctx, id));
    }
    return toDto(current);
  }
}
