import { pgTable, uuid, varchar, text, integer, jsonb, timestamp, index, customType } from 'drizzle-orm/pg-core';
import { knowledgeBaseStatusEnum, documentStatusEnum } from './enums.js';
import { platforms } from './platforms.js';
import { distributors } from './distributors.js';
import { clients } from './clients.js';
import { agents } from './agents.js';

const vector = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1536)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    const trimmed = value.slice(1, -1).trim();
    if (trimmed.length === 0) return [];
    return trimmed.split(',').map((v) => Number.parseFloat(v));
  },
});

export const knowledgeBases = pgTable(
  'knowledge_bases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    agentId: uuid('agent_id').references(() => agents.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),
    embeddingModel: varchar('embedding_model', { length: 64 }).notNull().default('openai:text-embedding-3-small'),
    embeddingDimensions: integer('embedding_dimensions').notNull().default(1536),
    status: knowledgeBaseStatusEnum('status').notNull().default('ACTIVE'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
  },
  (t) => ({
    clientIdx: index('kb_client_idx').on(t.clientId),
    agentIdx: index('kb_agent_idx').on(t.agentId),
  }),
);

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    knowledgeBaseId: uuid('knowledge_base_id')
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 300 }).notNull(),
    sourceType: varchar('source_type', { length: 32 }).notNull().default('TEXT'),
    sourceUrl: text('source_url'),
    mimeType: varchar('mime_type', { length: 128 }),
    sizeBytes: integer('size_bytes'),
    status: documentStatusEnum('status').notNull().default('PENDING'),
    errorMessage: text('error_message'),
    chunkCount: integer('chunk_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    kbIdx: index('documents_kb_idx').on(t.knowledgeBaseId),
    clientIdx: index('documents_client_idx').on(t.clientId),
    statusIdx: index('documents_status_idx').on(t.status),
  }),
);

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    knowledgeBaseId: uuid('knowledge_base_id')
      .notNull()
      .references(() => knowledgeBases.id, { onDelete: 'cascade' }),
    platformId: uuid('platform_id')
      .notNull()
      .references(() => platforms.id, { onDelete: 'restrict' }),
    distributorId: uuid('distributor_id')
      .notNull()
      .references(() => distributors.id, { onDelete: 'restrict' }),
    clientId: uuid('client_id')
      .notNull()
      .references(() => clients.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    content: text('content').notNull(),
    tokenCount: integer('token_count').notNull().default(0),
    embedding: vector('embedding').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    docIdx: index('chunks_document_idx').on(t.documentId),
    kbIdx: index('chunks_kb_idx').on(t.knowledgeBaseId),
    clientIdx: index('chunks_client_idx').on(t.clientId),
  }),
);

export type KnowledgeBase = typeof knowledgeBases.$inferSelect;
export type NewKnowledgeBase = typeof knowledgeBases.$inferInsert;
export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type Chunk = typeof chunks.$inferSelect;
export type NewChunk = typeof chunks.$inferInsert;

export type KnowledgeBaseRecord = KnowledgeBase;
export type DocumentRecord = Document;
export type ChunkRecord = Chunk;
