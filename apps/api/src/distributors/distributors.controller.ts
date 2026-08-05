import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// DTOs are runtime values so class-validator emits metadata; Records are types used as parameter annotations.
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateClientDto, UpdateClientDto, UpdateWebhookAllowedHostsDto } from './dto/client.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { CreateDistributorDto, UpdateDistributorDto } from './dto/distributor.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ClientService, DistributorService } from './distributors.service.js';
import type { ClientRecord, DistributorRecord } from '../infrastructure/persistence/drizzle/distributors.repository.js';


const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing — JwtGuard debe correr antes');
  return ctx;
};

const toDistributorDto = (d: DistributorRecord): Record<string, unknown> => ({
  id: d.id,
  platformId: d.platformId,
  key: d.key,
  name: d.name,
  legalName: d.legalName,
  supportEmail: d.supportEmail,
  billingEmail: d.billingEmail,
  defaultLocale: d.defaultLocale,
  defaultCurrency: d.defaultCurrency,
  whiteLabelEnabled: d.whiteLabelEnabled,
  logoUrl: d.logoUrl,
  primaryColor: d.primaryColor,
  secondaryColor: d.secondaryColor,
  customDomain: d.customDomain,
  status: d.status,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

const toClientDto = (c: ClientRecord): Record<string, unknown> => ({
  id: c.id,
  platformId: c.platformId,
  distributorId: c.distributorId,
  key: c.key,
  name: c.name,
  legalName: c.legalName,
  supportEmail: c.supportEmail,
  billingEmail: c.billingEmail,
  defaultLocale: c.defaultLocale,
  defaultCurrency: c.defaultCurrency,
  status: c.status,
  webhookAllowedHosts: c.webhookAllowedHosts ?? [],
  deletedAt: c.deletedAt?.toISOString() ?? null,
  createdAt: c.createdAt.toISOString(),
  updatedAt: c.updatedAt.toISOString(),
});

@ApiTags('distributors')
@Controller('distributors')
@UseGuards(JwtGuard)
export class DistributorsController {
  constructor(private readonly service: DistributorService) {}

  @Get()
  @ApiOperation({ summary: 'Lista distribuidores visibles (tenantFilter)' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.list(ctx);
    return { items: items.map(toDistributorDto) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un distribuidor' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const d = await this.service.getById(ctx, id);
    return toDistributorDto(d);
  }

  @Post()
  @ApiOperation({ summary: 'Crea distribuidor (solo platform_super_admin)' })
  async create(@Req() req: Request, @Body() dto: CreateDistributorDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const d = await this.service.create(ctx, {
      id: crypto.randomUUID(),
      platformId: ctx.platformId,
      key: dto.key,
      name: dto.name,
      legalName: dto.legalName,
      supportEmail: dto.supportEmail ?? null,
      billingEmail: dto.billingEmail ?? null,
      defaultLocale: dto.defaultLocale ?? 'es',
      defaultCurrency: dto.defaultCurrency ?? 'mxn',
      whiteLabelEnabled: dto.whiteLabelEnabled ?? false,
      logoUrl: dto.logoUrl ?? null,
      primaryColor: dto.primaryColor ?? null,
      secondaryColor: dto.secondaryColor ?? null,
      customDomain: dto.customDomain ?? null,
      status: 'ACTIVE',
    });
    return toDistributorDto(d);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza distribuidor (platform_admin, distributor_owner)' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateDistributorDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const patch: Partial<DistributorRecord> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.legalName !== undefined) patch.legalName = dto.legalName;
    if (dto.supportEmail !== undefined) patch.supportEmail = dto.supportEmail;
    if (dto.billingEmail !== undefined) patch.billingEmail = dto.billingEmail;
    if (dto.defaultLocale !== undefined) patch.defaultLocale = dto.defaultLocale;
    if (dto.defaultCurrency !== undefined) patch.defaultCurrency = dto.defaultCurrency;
    if (dto.whiteLabelEnabled !== undefined) patch.whiteLabelEnabled = dto.whiteLabelEnabled;
    if (dto.logoUrl !== undefined) patch.logoUrl = dto.logoUrl;
    if (dto.primaryColor !== undefined) patch.primaryColor = dto.primaryColor;
    if (dto.secondaryColor !== undefined) patch.secondaryColor = dto.secondaryColor;
    if (dto.customDomain !== undefined) patch.customDomain = dto.customDomain;
    if (dto.status !== undefined) patch.status = dto.status;
    const d = await this.service.update(ctx, id, patch);
    return toDistributorDto(d);
  }
}

@ApiTags('clients')
@Controller('clients')
@UseGuards(JwtGuard)
export class ClientsController {
  constructor(private readonly service: ClientService) {}

  @Get()
  @ApiOperation({ summary: 'Lista clientes visibles (tenantFilter)' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.list(ctx);
    return { items: items.map(toClientDto) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un cliente' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const c = await this.service.getById(ctx, id);
    return toClientDto(c);
  }

  @Post()
  @ApiOperation({ summary: 'Crea cliente dentro del distribuidor del caller' })
  async create(@Req() req: Request, @Body() dto: CreateClientDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const c = await this.service.create(ctx, {
      id: crypto.randomUUID(),
      platformId: ctx.platformId,
      distributorId: dto.distributorId,
      key: dto.key,
      name: dto.name,
      legalName: dto.legalName,
      supportEmail: dto.supportEmail ?? null,
      billingEmail: dto.billingEmail ?? null,
      defaultLocale: dto.defaultLocale ?? 'es',
      defaultCurrency: dto.defaultCurrency ?? 'mxn',
      webhookAllowedHosts: [],
      status: 'ACTIVE',
    });
    return toClientDto(c);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualiza cliente (distributor_owner/admin)' })
  async update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const patch: Partial<ClientRecord> = {};
    if (dto.name !== undefined) patch.name = dto.name;
    if (dto.legalName !== undefined) patch.legalName = dto.legalName;
    if (dto.supportEmail !== undefined) patch.supportEmail = dto.supportEmail;
    if (dto.billingEmail !== undefined) patch.billingEmail = dto.billingEmail;
    if (dto.defaultLocale !== undefined) patch.defaultLocale = dto.defaultLocale;
    if (dto.defaultCurrency !== undefined) patch.defaultCurrency = dto.defaultCurrency;
    if (dto.status !== undefined) patch.status = dto.status;
    const c = await this.service.update(ctx, id, patch);
    return toClientDto(c);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete cliente (distributor_owner)' })
  async remove(@Req() req: Request, @Param('id') id: string): Promise<{ ok: true; id: string }> {
    const ctx = toTenantContext(req);
    const c = await this.service.softDelete(ctx, id);
    return { ok: true, id: c.id };
  }

  @Get(':id/webhook-allowed-hosts')
  @ApiOperation({ summary: 'Lista de hostnames permitidos para webhooks salientes del cliente' })
  async getWebhookAllowedHosts(
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<{ clientId: string; hosts: string[] }> {
    const ctx = toTenantContext(req);
    const hosts = await this.service.getWebhookAllowedHosts(ctx, id);
    return { clientId: id, hosts };
  }

  @Patch(':id/webhook-allowed-hosts')
  @ApiOperation({ summary: 'Reemplaza la allowlist de hostnames para webhooks (distributor_owner/admin)' })
  async updateWebhookAllowedHosts(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWebhookAllowedHostsDto,
  ): Promise<{ clientId: string; hosts: string[] }> {
    const ctx = toTenantContext(req);
    const hosts = await this.service.updateWebhookAllowedHosts(ctx, id, dto.hosts);
    return { clientId: id, hosts };
  }
}
