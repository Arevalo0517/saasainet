import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WebhookDispatcherService } from './webhook-dispatcher.service.js';

const toCtx = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

const toDeliveryDto = (d: {
  id: string;
  endpointId: string;
  eventId: string;
  status: string;
  attemptCount: string;
  maxAttempts: string;
  lastStatusCode: string | null;
  lastError: string | null;
  responseBody: string | null;
  nextRetryAt: Date | null;
  lastAttemptedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): Record<string, unknown> => ({
  id: d.id,
  endpointId: d.endpointId,
  eventId: d.eventId,
  status: d.status,
  attemptCount: Number(d.attemptCount),
  maxAttempts: Number(d.maxAttempts),
  lastStatusCode: d.lastStatusCode === null ? null : Number(d.lastStatusCode),
  lastError: d.lastError,
  responseBody: d.responseBody,
  nextRetryAt: d.nextRetryAt?.toISOString() ?? null,
  lastAttemptedAt: d.lastAttemptedAt?.toISOString() ?? null,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

@ApiTags('webhook-deliveries')
@Controller('webhook-deliveries')
@UseGuards(JwtGuard)
export class WebhookDeliveriesController {
  constructor(private readonly dispatcher: WebhookDispatcherService) {}

  @Get()
  @ApiOperation({ summary: 'Lista deliveries de un endpoint (?endpointId=...)' })
  async list(
    @Req() req: Request,
    @Query('endpointId') endpointId: string,
    @Query('limit') limitStr: string,
  ): Promise<{ items: Array<Record<string, unknown>> }> {
    void toCtx(req);
    const limit = Math.min(Math.max(Number(limitStr ?? 50) || 50, 1), 200);
    if (endpointId === undefined || endpointId === '') {
      return { items: [] };
    }
    const items = await this.dispatcher.listDeliveries(endpointId, limit);
    return { items: items.map(toDeliveryDto) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una delivery' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toDeliveryDto(await this.dispatcher.getDelivery(ctx, id));
  }

  @Post(':id/replay')
  @ApiOperation({ summary: 'Reintenta una delivery en estado PENDING/FAILED/DLQ' })
  async replay(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toDeliveryDto(await this.dispatcher.replay(ctx, id));
  }
}
