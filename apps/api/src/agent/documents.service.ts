import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { TenantContext } from '@platform/contracts';
import type { EmbeddingProvider } from '@platform/model-providers';
import { EMBEDDING_PROVIDER } from './agent.tokens.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleChunkRepository,
  DrizzleDocumentRepository,
  type DocumentRecord,
} from '../infrastructure/persistence/drizzle/knowledge.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleKnowledgeBaseRepository } from '../infrastructure/persistence/drizzle/knowledge.repository.js';

export const DOCUMENT_NOT_FOUND = 'DOCUMENT_NOT_FOUND';
export const CROSS_TENANT_DOC = 'CROSS_TENANT_DOC';
export const EMPTY_DOCUMENT = 'EMPTY_DOCUMENT';

const DEFAULT_CHUNK_CHARS = 800;
const DEFAULT_CHUNK_OVERLAP = 100;

const chunkText = (text: string, maxChars: number, overlap: number): string[] => {
  const cleaned = text.replace(/\s+/gu, ' ').trim();
  if (cleaned.length === 0) return [];
  if (cleaned.length <= maxChars) return [cleaned];
  const out: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const end = Math.min(cleaned.length, i + maxChars);
    out.push(cleaned.slice(i, end));
    if (end === cleaned.length) break;
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return out;
};

@Injectable()
export class DocumentsService {
  constructor(
    private readonly docs: DrizzleDocumentRepository,
    private readonly chunks: DrizzleChunkRepository,
    private readonly kbs: DrizzleKnowledgeBaseRepository,
    @Inject(EMBEDDING_PROVIDER) private readonly embeddingProvider: EmbeddingProvider,
  ) {
    void this.chunks;
  }

  async listByKb(ctx: TenantContext, kbId: string): Promise<DocumentRecord[]> {
    const kb = await this.kbs.findById(kbId);
    if (kb === null) throw new NotFoundException({ code: 'KB_NOT_FOUND', message: 'KB no encontrada' });
    if (kb.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_DOC, message: 'KB de otro client' });
    return this.docs.listByKnowledgeBase(kbId);
  }

  async getById(ctx: TenantContext, id: string): Promise<DocumentRecord> {
    const d = await this.docs.findById(id);
    if (d === null) throw new NotFoundException({ code: DOCUMENT_NOT_FOUND, message: 'Documento no encontrado' });
    if (d.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_DOC, message: 'Documento de otro client' });
    return d;
  }

  async create(
    ctx: TenantContext,
    kbId: string,
    input: Omit<DocumentRecord, 'id' | 'platformId' | 'distributorId' | 'clientId' | 'knowledgeBaseId' | 'status' | 'errorMessage' | 'chunkCount' | 'metadata' | 'createdAt' | 'updatedAt'>,
    options: { text?: string },
  ): Promise<DocumentRecord> {
    const kb = await this.kbs.findById(kbId);
    if (kb === null) throw new NotFoundException({ code: 'KB_NOT_FOUND', message: 'KB no encontrada' });
    if (kb.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_DOC, message: 'KB de otro client' });
    const doc = await this.docs.create({
      ...input,
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      knowledgeBaseId: kb.id,
      metadata: {},
    });
    if (options.text !== undefined && options.text.length > 0) {
      await this.ingest(doc, options.text);
    }
    return doc;
  }

  async ingestById(ctx: TenantContext, id: string, text: string): Promise<DocumentRecord> {
    const d = await this.getById(ctx, id);
    return this.ingest(d, text);
  }

  private async ingest(doc: DocumentRecord, text: string): Promise<DocumentRecord> {
    if (text.trim().length === 0) {
      return this.docs.update(doc.id, { status: 'READY', chunkCount: 0 });
    }
    await this.docs.update(doc.id, { status: 'PROCESSING' });
    try {
      const pieces = chunkText(text, DEFAULT_CHUNK_CHARS, DEFAULT_CHUNK_OVERLAP);
      const vectors: number[][] = [];
      for (const p of pieces) {
        const r = await this.embeddingProvider.generateEmbedding({ text: p });
        vectors.push(r.embedding);
      }
      await this.docs.deleteChunks(doc.id);
      await this.chunks.createBatch(
        pieces.map((p, idx) => ({
          documentId: doc.id,
          knowledgeBaseId: doc.knowledgeBaseId,
          platformId: doc.platformId,
          distributorId: doc.distributorId,
          clientId: doc.clientId,
          position: idx,
          content: p,
          tokenCount: Math.ceil(p.length / 4),
          embedding: vectors[idx] ?? [],
          metadata: {},
        })),
      );
      return this.docs.update(doc.id, { status: 'READY', chunkCount: pieces.length });
    } catch (err) {
      return this.docs.update(doc.id, {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : String(err),
      });
    }
  }
}
