import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WebhookEndpointsService, toEndpointDto } from './webhook-endpoints.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateWebhookEndpointDto, UpdateWebhookEndpointDto } from './dto/webhook-endpoint.dto.js';

const toCtx = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

@ApiTags('webhook-endpoints')
@Controller('webhook-endpoints')
@UseGuards(JwtGuard)
export class WebhookEndpointsController {
  constructor(private readonly service: WebhookEndpointsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista endpoints de webhook del client' })
  async list(@Req() req: Request, @Body() _?: unknown): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toCtx(req);
    const items = await this.service.list(ctx, false);
    return { items: items.map(toEndpointDto) };
  }

  @Post()
  @ApiOperation({ summary: 'Crea un endpoint de webhook (devuelve secret una sola vez)' })
  async create(@Req() req: Request, @Body() dto: CreateWebhookEndpointDto): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    const { dto: payload, secret, allowlist } = await this.service.create(ctx, {
      name: dto.name,
      url: dto.url,
      events: [...dto.events],
      description: dto.description,
    });
    return { ...payload, secret, allowlist };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un endpoint' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    const { dto: payload, secret, allowlist } = await this.service.getIncludingSecret(ctx, id);
    return { ...payload, secret, allowlist };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza nombre/url/events/status/description' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookEndpointDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toEndpointDto(
      await this.service.update(ctx, id, {
        name: dto.name,
        url: dto.url,
        events: dto.events === undefined ? undefined : [...dto.events],
        status: dto.status,
        description: dto.description,
      }),
    );
  }

  @Post(':id/rotate-secret')
  @ApiOperation({ summary: 'Rota el secret HMAC (devuelve el nuevo una sola vez)' })
  async rotate(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    const { dto: payload, secret, allowlist } = await this.service.rotateSecret(ctx, id);
    return { ...payload, secret, allowlist };
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Emite un evento de prueba (conversation.started) al endpoint' })
  async test(@Req() req: Request, @Param('id') id: string): Promise<{ eventId: string; type: string }> {
    const ctx = toCtx(req);
    const ev = await this.service.test(ctx, id);
    return { eventId: ev.id, type: ev.type };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archiva (soft delete) un endpoint' })
  async archive(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toEndpointDto(await this.service.archive(ctx, id));
  }
}
