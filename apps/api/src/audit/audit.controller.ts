import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AuditService } from './audit.service.js';
import { JwtGuard } from '../auth/jwt.guard.js';

interface AuditQuery {
  action?: string;
  resourceType?: string;
  resourceId?: string;
  actorUserId?: string;
  from?: string;
  to?: string;
  limit?: string;
  offset?: string;
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

const parseInt10 = (s: string | undefined): number | undefined => {
  if (s === undefined || s.length === 0) return undefined;
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n)) return undefined;
  return n;
};

@ApiTags('audit')
@Controller('audit-events')
@UseGuards(JwtGuard)
export class AuditController {
  constructor(private readonly service: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Lista eventos de auditoría (tenant-scoped)' })
  async list(
    @Req() req: Request,
    @Query() q: AuditQuery,
  ): Promise<{ items: Array<Record<string, unknown>>; total: number; limit: number; offset: number }> {
    const ctx = toCtx(req);
    const allowed =
      ctx.roles.includes('platform_super_admin') ||
      ctx.roles.includes('distributor_owner') ||
      ctx.roles.includes('distributor_admin') ||
      ctx.roles.includes('client_owner') ||
      ctx.isSupportSession === true;
    if (!allowed) {
      return { items: [], total: 0, limit: 0, offset: 0 };
    }
    const limit = Math.min(Math.max(parseInt10(q.limit) ?? 50, 1), 200);
    const offset = Math.max(parseInt10(q.offset) ?? 0, 0);
    const result = await this.service.query({
      ctx,
      ...(q.action !== undefined ? { action: q.action } : {}),
      ...(q.resourceType !== undefined ? { resourceType: q.resourceType } : {}),
      ...(q.resourceId !== undefined ? { resourceId: q.resourceId } : {}),
      ...(q.actorUserId !== undefined ? { actorUserId: q.actorUserId } : {}),
      ...(parseDate(q.from) !== undefined ? { from: parseDate(q.from) as Date } : {}),
      ...(parseDate(q.to) !== undefined ? { to: parseDate(q.to) as Date } : {}),
      limit,
      offset,
    });
    return { items: result.items, total: result.total, limit, offset };
  }
}
