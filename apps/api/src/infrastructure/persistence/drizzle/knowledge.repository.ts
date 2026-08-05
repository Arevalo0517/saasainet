import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Database } from '@platform/db';
import {
  chunks,
  documents,
  knowledgeBases,
  type Chunk,
  type Document,
  type KnowledgeBase,
  type NewChunk,
  type NewDocument,
  type NewKnowledgeBase,
} from '@platform/db';

export type KnowledgeBaseRecord = KnowledgeBase;
export type DocumentRecord = Document;
export type ChunkRecord = Chunk;

export class DrizzleKnowledgeBaseRepository {
  constructor(private readonly db: Database) {}

  async listByClient(clientId: string, includeArchived: boolean): Promise<KnowledgeBaseRecord[]> {
    const q = this.db
      .select()
      .from(knowledgeBases)
      .where(
        includeArchived
          ? eq(knowledgeBases.clientId, clientId)
          : and(eq(knowledgeBases.clientId, clientId), sql`${knowledgeBases.archivedAt} IS NULL`),
      )
      .orderBy(asc(knowledgeBases.name));
    return q;
  }

  async findById(id: string): Promise<KnowledgeBaseRecord | null> {
    const rows = await this.db.select().from(knowledgeBases).where(eq(knowledgeBases.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewKnowledgeBase): Promise<KnowledgeBaseRecord> {
    const rows = await this.db.insert(knowledgeBases).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('knowledge_base create returned no rows');
    return r;
  }

  async update(id: string, patch: Partial<KnowledgeBaseRecord>): Promise<KnowledgeBaseRecord> {
    const rows = await this.db
      .update(knowledgeBases)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(knowledgeBases.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('knowledge_base update returned no rows');
    return r;
  }

  async archive(id: string): Promise<void> {
    await this.db
      .update(knowledgeBases)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(knowledgeBases.id, id));
  }
}

export class DrizzleDocumentRepository {
  constructor(private readonly db: Database) {}

  async listByKnowledgeBase(knowledgeBaseId: string): Promise<DocumentRecord[]> {
    return this.db.select().from(documents).where(eq(documents.knowledgeBaseId, knowledgeBaseId)).orderBy(desc(documents.createdAt));
  }

  async findById(id: string): Promise<DocumentRecord | null> {
    const rows = await this.db.select().from(documents).where(eq(documents.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewDocument): Promise<DocumentRecord> {
    const rows = await this.db.insert(documents).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('document create returned no rows');
    return r;
  }

  async update(id: string, patch: Partial<DocumentRecord>): Promise<DocumentRecord> {
    const rows = await this.db
      .update(documents)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('document update returned no rows');
    return r;
  }

  async deleteChunks(documentId: string): Promise<void> {
    await this.db.delete(chunks).where(eq(chunks.documentId, documentId));
  }
}

export class DrizzleChunkRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewChunk): Promise<ChunkRecord> {
    const rows = await this.db.insert(chunks).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('chunk create returned no rows');
    return r;
  }

  async createBatch(inputs: NewChunk[]): Promise<ChunkRecord[]> {
    if (inputs.length === 0) return [];
    const rows = await this.db.insert(chunks).values(inputs).returning();
    return rows;
  }

  async listByDocument(documentId: string): Promise<ChunkRecord[]> {
    return this.db.select().from(chunks).where(eq(chunks.documentId, documentId)).orderBy(asc(chunks.position));
  }

  async countByDocument(documentId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(chunks)
      .where(eq(chunks.documentId, documentId));
    return rows[0]?.count ?? 0;
  }

  async retrieveByEmbedding(input: {
    clientId: string;
    knowledgeBaseIds: string[];
    embedding: number[];
    topK: number;
  }): Promise<Array<{ id: string; documentId: string; knowledgeBaseId: string; position: number; content: string; score: number }>> {
    if (input.knowledgeBaseIds.length === 0) return [];
    const vectorStr = `[${input.embedding.join(',')}]`;
    const rows = await this.db.execute<{
      id: string;
      document_id: string;
      knowledge_base_id: string;
      position: number;
      content: string;
      score: number;
    }>(
      sql`SELECT id, document_id, knowledge_base_id, position, content,
            1 - (embedding <=> ${vectorStr}::vector) AS score
          FROM ${chunks}
          WHERE client_id = ${input.clientId}
            AND knowledge_base_id = ANY(${inArray(chunks.knowledgeBaseId, input.knowledgeBaseIds)})
          ORDER BY embedding <=> ${vectorStr}::vector
          LIMIT ${input.topK}`,
    );
    const result = (rows as unknown as { rows?: Array<{
      id: string;
      document_id: string;
      knowledge_base_id: string;
      position: number;
      content: string;
      score: number;
    }> }).rows ?? (rows as unknown as Array<{
      id: string;
      document_id: string;
      knowledge_base_id: string;
      position: number;
      content: string;
      score: number;
    }>);
    return result.map((r) => ({
      id: r.id,
      documentId: r.document_id,
      knowledgeBaseId: r.knowledge_base_id,
      position: r.position,
      content: r.content,
      score: Number(r.score),
    }));
  }
}
