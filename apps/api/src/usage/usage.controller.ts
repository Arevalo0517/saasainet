import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UsageEventsService } from './usage.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';

interface AggregateQuery {
  metric?: string;
  from?: string;
  to?: string;
  groupBy?: 'agent' | 'channel' | 'client' | 'distributor' | 'day' | 'metric';
}

const toCtx = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

const parseDate = (s: string | undefined): Date | undefined => {
  if (s === undefined || s.length === 0) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  return d;
};

const defaultTo = new Date();
defaultTo.setDate(defaultTo.getDate() + 1);
const defaultFrom = new Date();
defaultFrom.setDate(defaultFrom.getDate() - 30);

@ApiTags('usage')
@Controller('usage-events')
@UseGuards(JwtGuard)
export class UsageController {
  constructor(private readonly service: UsageEventsService) {}

  @Get('aggregate')
  @ApiOperation({ summary: 'Agrega eventos de uso por dimensión (tenant-scoped)' })
  async aggregate(
    @Req() req: Request,
    @Query() q: AggregateQuery,
  ): Promise<{
    rows: Array<{ key: string; totalQuantity: number; totalCostCents: number; eventCount: number }>;
    totals: { key: string; totalQuantity: number; totalCostCents: number; eventCount: number };
    from: string;
    to: string;
    groupBy: string;
  }> {
    const ctx = toCtx(req);
    const allowed = ctx.roles.includes('platform_super_admin') || ctx.roles.includes('distributor_owner') || ctx.roles.includes('distributor_admin') || ctx.roles.includes('client_owner') || ctx.isSupportSession === true;
    if (!allowed) {
      return { rows: [], totals: { key: '__all__', totalQuantity: 0, totalCostCents: 0, eventCount: 0 }, from: '', to: '', groupBy: 'day' };
    }
    const from = parseDate(q.from) ?? defaultFrom;
    const to = parseDate(q.to) ?? defaultTo;
    const groupBy = q.groupBy ?? 'day';
    const result = await this.service.aggregate({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId,
      clientId: ctx.clientId,
      ...(q.metric !== undefined ? { metric: q.metric } : {}),
      from,
      to,
      groupBy,
    });
    return { rows: result.rows, totals: result.totals, from: from.toISOString(), to: to.toISOString(), groupBy };
  }
}
