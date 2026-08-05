import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { KnowledgeBasesService } from './knowledge-bases.service.js';
import type { KnowledgeBaseRecord } from '../infrastructure/persistence/drizzle/knowledge.repository.js';
import type { CreateKnowledgeBaseDto, UpdateKnowledgeBaseDto } from './dto/agent.dto.js';

const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

const toKbDto = (k: KnowledgeBaseRecord): Record<string, unknown> => ({
  id: k.id,
  clientId: k.clientId,
  agentId: k.agentId,
  name: k.name,
  description: k.description,
  embeddingModel: k.embeddingModel,
  embeddingDimensions: k.embeddingDimensions,
  status: k.status,
  archivedAt: k.archivedAt?.toISOString() ?? null,
  createdAt: k.createdAt.toISOString(),
  updatedAt: k.updatedAt.toISOString(),
});

@ApiTags('knowledge-bases')
@Controller('knowledge-bases')
export class KnowledgeBasesController {
  constructor(private readonly service: KnowledgeBasesService) {}

  @Get()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Lista KBs del client' })
  async list(@Req() req: Request): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.list(ctx, false);
    return { items: items.map(toKbDto) };
  }

  @Post()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Crea KB' })
  async create(@Req() req: Request, @Body() dto: CreateKnowledgeBaseDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const k = await this.service.create(ctx, {
      name: dto.name,
      description: dto.description ?? null,
      agentId: dto.agentId ?? null,
      embeddingModel: dto.embeddingModel ?? 'openai:text-embedding-3-small',
      embeddingDimensions: dto.embeddingDimensions ?? 1536,
    });
    return toKbDto(k);
  }

  @Get(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Detalle KB' })
  async getOne(@Req() req: Request, @Param('id') id: string): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toKbDto(await this.service.getById(ctx, id));
  }

  @Patch(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Actualiza KB' })
  async update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateKnowledgeBaseDto): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toKbDto(await this.service.update(ctx, id, dto));
  }

  @Delete(':id')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Archiva KB' })
  async archive(@Req() req: Request, @Param('id') id: string): Promise<{ ok: true }> {
    const ctx = toTenantContext(req);
    await this.service.archive(ctx, id);
    return { ok: true };
  }
}
