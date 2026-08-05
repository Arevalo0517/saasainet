import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChannelConnectionsService, toConnectionDto, toConnectionWithSecretDto } from './channel-connections.service.js';
import type { CreateChannelConnectionDto, UpdateChannelConnectionDto } from './dto/channel-connection.dto.js';

const toCtx = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

@ApiTags('channel-connections')
@Controller('channel-connections')
@UseGuards(JwtGuard)
export class ChannelConnectionsController {
  constructor(private readonly service: ChannelConnectionsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista conexiones de canal del client' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toCtx(req);
    const items = await this.service.list(ctx, false);
    return { items: items.map(toConnectionDto) };
  }

  @Post()
  @ApiOperation({ summary: 'Crea una conexión (devuelve webhookSecret una vez)' })
  async create(@Req() req: Request, @Body() dto: CreateChannelConnectionDto): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    const { dto: payload, webhookSecret } = await this.service.create(ctx, {
      name: dto.name,
      channel: dto.channel,
      phoneNumber: dto.phoneNumber,
      credentials: dto.credentials ?? {},
    });
    return { ...payload, webhookSecret };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de conexión' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    const { dto: payload, webhookSecret } = toConnectionWithSecretDto(await this.service.get(ctx, id));
    return { ...payload, webhookSecret };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza nombre/phoneNumber/credentials' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateChannelConnectionDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toConnectionDto(
      await this.service.update(ctx, id, {
        name: dto.name,
        phoneNumber: dto.phoneNumber,
        credentials: dto.credentials,
      }),
    );
  }

  @Post(':id/verify')
  @ApiOperation({ summary: 'Verifica credenciales contra el provider' })
  async verify(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toConnectionDto(await this.service.verify(ctx, id));
  }

  @Post(':id/rotate-webhook-secret')
  @ApiOperation({ summary: 'Rota el webhook secret (devuelve el nuevo una vez)' })
  async rotate(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    const { dto: payload, webhookSecret } = await this.service.rotateWebhookSecret(ctx, id);
    return { ...payload, webhookSecret };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Archiva (soft delete) la conexión' })
  async archive(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toCtx(req);
    return toConnectionDto(await this.service.archive(ctx, id));
  }
}
