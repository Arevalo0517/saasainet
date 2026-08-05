import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import type { TenantContext } from '@platform/contracts';
import { JwtGuard } from '../auth/jwt.guard.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DocumentsService } from './documents.service.js';
import type { DocumentRecord } from '../infrastructure/persistence/drizzle/knowledge.repository.js';
import type { CreateDocumentDto } from './dto/agent.dto.js';

const toTenantContext = (req: Request): TenantContext => {
  const ctx = req.tenantContext;
  if (!ctx) throw new Error('TenantContext missing');
  return ctx;
};

const toDocDto = (d: DocumentRecord): Record<string, unknown> => ({
  id: d.id,
  knowledgeBaseId: d.knowledgeBaseId,
  clientId: d.clientId,
  title: d.title,
  sourceType: d.sourceType,
  sourceUrl: d.sourceUrl,
  mimeType: d.mimeType,
  sizeBytes: d.sizeBytes,
  status: d.status,
  errorMessage: d.errorMessage,
  chunkCount: d.chunkCount,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

@ApiTags('documents')
@Controller('knowledge-bases/:kbId/documents')
export class DocumentsController {
  constructor(private readonly service: DocumentsService) {}

  @Get()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Lista documentos de una KB' })
  async list(@Req() req: Request, @Param('kbId') kbId: string): Promise<{ items: Array<Record<string, unknown>> }> {
    const ctx = toTenantContext(req);
    const items = await this.service.listByKb(ctx, kbId);
    return { items: items.map(toDocDto) };
  }

  @Post()
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Crea documento (y opcionalmente lo ingesta in-place)' })
  async create(
    @Req() req: Request,
    @Param('kbId') kbId: string,
    @Body() dto: CreateDocumentDto,
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    const { text, ...rest } = dto;
    const d = await this.service.create(ctx, kbId, {
      title: rest.title,
      sourceType: rest.sourceType ?? 'TEXT',
      sourceUrl: rest.sourceUrl ?? null,
      mimeType: rest.mimeType ?? null,
      sizeBytes: rest.sizeBytes ?? null,
    }, { text });
    return toDocDto(d);
  }

  @Post(':id/ingest')
  @UseGuards(JwtGuard)
  @ApiOperation({ summary: 'Ingiere texto en un documento existente' })
  async ingest(
    @Req() req: Request,
    @Param('kbId') _kbId: string,
    @Param('id') id: string,
    @Body() body: { text: string },
  ): Promise<Record<string, unknown>> {
    const ctx = toTenantContext(req);
    return toDocDto(await this.service.ingestById(ctx, id, body.text));
  }
}
