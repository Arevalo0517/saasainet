import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { AgentsService } from './agents.service.js';
import type { AgentRecord, AgentVersionRecord } from '../infrastructure/persistence/drizzle/agents.repository.js';
import type { CreateAgentDto, CreateAgentVersionDto, UpdateAgentDto } from './dto/agent.dto.js';

const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

const toAgentDto = (a: AgentRecord): Record<string, unknown> => ({
  id: a.id,
  clientId: a.clientId,
  key: a.key,
  name: a.name,
  description: a.description,
  defaultLocale: a.defaultLocale,
  defaultTimezone: a.defaultTimezone,
  publicWidgetId: a.publicWidgetId,
  archivedAt: a.archivedAt?.toISOString() ?? null,
  createdAt: a.createdAt.toISOString(),
  updatedAt: a.updatedAt.toISOString(),
});

const toVersionDto = (v: AgentVersionRecord): Record<string, unknown> => ({
  id: v.id,
  agentId: v.agentId,
  version: v.version,
  state: v.state,
  name: v.name,
  description: v.description,
  language: v.language,
  timezone: v.timezone,
  objective: v.objective,
  personality: v.personality,
  tone: v.tone,
  systemPrompt: v.systemPrompt,
  welcomeMessage: v.welcomeMessage,
  outOfHoursMessage: v.outOfHoursMessage,
  allowedRules: v.allowedRules,
  forbiddenRules: v.forbiddenRules,
  dataToRequest: v.dataToRequest,
  sensitiveDataForbidden: v.sensitiveDataForbidden,
  modelProfile: v.modelProfile,
  modelParameters: v.modelParameters,
  publishedAt: v.publishedAt?.toISOString() ?? null,
  createdAt: v.createdAt.toISOString(),
  updatedAt: v.updatedAt.toISOString(),
});

@ApiTags('agents')
@Controller('agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Get()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Lista agents del client actual' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.list(ctx, false);
    return { items: items.map(toAgentDto) };
  }

  @Post()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Crea agent' })
  async create(@Req() req: Request, @Body() dto: CreateAgentDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const a = await this.service.create(ctx, {
      key: dto.key,
      name: dto.name,
      description: dto.description ?? null,
      defaultLocale: dto.defaultLocale ?? 'es',
      defaultTimezone: dto.defaultTimezone ?? 'UTC',
    });
    return toAgentDto(a);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Detalle agent' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toAgentDto(await this.service.getById(ctx, id));
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Actualiza agent' })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateAgentDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toAgentDto(await this.service.update(ctx, id, dto));
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Archiva agent' })
  async archive(@Req() req: Request, @Param('id') id: string): Promise<{ ok: true }> {
    const ctx = toTenantContext(req);
    await this.service.archive(ctx, id);
    return { ok: true };
  }

  @Get(':id/versions')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Lista versiones' })
  async listVersions(@Req() req: Request, @Param('id') id: string): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listVersions(ctx, id);
    return { items: items.map(toVersionDto) };
  }

  @Post(':id/versions')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Crea nueva versión' })
  async createVersion(@Req() req: Request, @Param('id') id: string, @Body() dto: CreateAgentVersionDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const v = await this.service.createVersion(ctx, id, {
      name: dto.name,
      description: dto.description ?? null,
      language: dto.language ?? 'es',
      timezone: dto.timezone ?? 'UTC',
      objective: dto.objective ?? null,
      personality: dto.personality ?? null,
      tone: dto.tone ?? null,
      systemPrompt: dto.systemPrompt,
      welcomeMessage: dto.welcomeMessage ?? null,
      outOfHoursMessage: dto.outOfHoursMessage ?? null,
      allowedRules: dto.allowedRules ?? [],
      forbiddenRules: dto.forbiddenRules ?? [],
      dataToRequest: dto.dataToRequest ?? [],
      sensitiveDataForbidden: dto.sensitiveDataForbidden ?? [],
      modelProfile: dto.modelProfile ?? 'openai:gpt-4o-mini',
      modelParameters: dto.modelParameters ?? {},
    });
    return toVersionDto(v);
  }

  @Post(':id/versions/:versionId/publish')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Publica una versión' })
  async publishVersion(
    @Req() req: Request,
    @Param('id') id: string,
    @Param('versionId') versionId: string,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toVersionDto(await this.service.publishVersion(ctx, versionId, ctx.userId ?? null));
  }
}
