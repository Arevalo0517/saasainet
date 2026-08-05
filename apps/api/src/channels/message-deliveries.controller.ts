import { Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChannelMessagesService, toDeliveryDto } from './channel-messages.service.js';

const toCtx = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

@ApiTags('message-deliveries')
@Controller('message-deliveries')
@UseGuards(JwtGuard)
export class MessageDeliveriesController {
  constructor(private readonly service: ChannelMessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Lista deliveries de una conexión (?connectionId=...)' })
  async list(
    @Req() req: Request,
    @Query('connectionId') connectionId: string,
    @Query('limit') limitStr: string,
  ): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toCtx(req);
    const limit = Math.min(Math.max(Number(limitStr ?? 50) || 50, 1), 200);
    if (connectionId === undefined || connectionId === '') return { items: [] };
    const items = await this.service.listDeliveriesForConnection(ctx, connectionId, limit);
    return { items: items.map(toDeliveryDto) };
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Consulta el estado actual al provider' })
  async refresh(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toDeliveryDto(await this.service.refreshDeliveryStatus(ctx, id));
  }
}
