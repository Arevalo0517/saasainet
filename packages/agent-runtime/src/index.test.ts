import { describe, it, expect } from 'vitest';
import { cosineSimilarity, createAgentRuntime, type RetrievedChunk } from './index.js';

const buildContextBlock = (chunks: RetrievedChunk[]): string => {
  if (chunks.length === 0) return 'Sin contexto relevante en la knowledge base.';
  return chunks
    .map((c, i) => `[#${i + 1} doc=${c.documentId.slice(0, 8)} pos=${c.position} score=${c.score.toFixed(3)}]\n${c.content}`)
    .join('\n\n');
};
import type { Retriever } from './index.js';
import type { MockModelProvider } from '@platform/model-providers';

const stubAgentVersion = {
  id: 'a0000002-0000-4000-8000-000000000a1',
  systemPrompt: 'Eres un agente de soporte amable.',
  welcomeMessage: 'Hola, ¿en qué te ayudo?',
  forbiddenRules: ['no des datos personales', 'no respondas fuera de tema'],
  allowedRules: ['puedes consultar la KB'],
  modelProfile: 'openai:gpt-4o-mini',
  modelParameters: { topK: 3, knowledgeBaseIds: ['kb1'] },
};

const stubRetriever = (chunks: Array<{ id: string; score: number; content: string }>): Retriever => ({
  retrieveByEmbedding: async () =>
    chunks.map((c) => ({
      id: c.id,
      documentId: 'doc1',
      position: 0,
      content: c.content,
      score: c.score,
    })),
});

describe('AgentRuntime', () => {
  const provider = {} as unknown as MockModelProvider;
  const embeddingProvider = {
    generateEmbedding: async () => ({ embedding: [1, 0, 0], dimensions: 3, modelProfile: 'mock' }),
  } as never;

  it('executeTurn returns answer with latency and citations', async () => {
    const rt = createAgentRuntime({
      modelProvider: {
        resolveModel: async () => ({ provider: 'mock', model: 'x', maxTokens: 100 }),
        summarizeConversation: async () => ({ summary: 'hola, en qué ayudo', tokensUsed: 3 }),
      } as never,
      embeddingProvider,
      retriever: stubRetriever([
        { id: 'c1', score: 0.9, content: 'horario 9-18' },
        { id: 'c2', score: 0.2, content: 'direccion madrid' },
      ]),
    });
    const r = await rt.executeTurn({
      tenantContext: {
        platformId: 'p1',
        distributorId: 'd1',
        clientId: 'c1',
        userId: 'u1',
        roles: ['client_admin'],
        permissions: [],
        isPlatformSuperAdmin: false,
      },
      conversationId: '00000000-0000-4000-8000-000000000020',
      agentVersionId: stubAgentVersion.id,
      inboundMessageId: '00000000-0000-4000-8000-000000000030',
      userMessage: 'horario?',
      history: [],
      agentVersion: stubAgentVersion,
    });
    expect(r.answer).toBe('hola, en qué ayudo');
    expect(r.latencyMs).toBeGreaterThanOrEqual(0);
    expect(r.tokensUsed).toBe(3);
    expect(r.citations.length).toBe(2);
  });

  it('executeTurn throws if tenantContext has no clientId', async () => {
    const rt = createAgentRuntime({
      modelProvider: {} as never,
      embeddingProvider,
      retriever: stubRetriever([]),
    });
    await expect(
      rt.executeTurn({
        tenantContext: {
          platformId: 'p1',
          distributorId: null,
          clientId: null,
          userId: 'u1',
          roles: ['platform_super_admin'],
          permissions: [],
          isPlatformSuperAdmin: true,
        },
        conversationId: 'c1',
        agentVersionId: 'a1',
        inboundMessageId: 'm1',
        userMessage: 'hola',
        history: [],
        agentVersion: stubAgentVersion,
      }),
    ).rejects.toThrow(/requiere un TenantContext con clientId/i);
  });

  it('retrieveRelevantChunks filters below MIN_RELEVANCE', async () => {
    const rt = createAgentRuntime({
      modelProvider: provider,
      embeddingProvider,
      retriever: stubRetriever([
        { id: 'a', score: 0.9, content: 'foo' },
        { id: 'b', score: 0.01, content: 'bar' },
        { id: 'c', score: 0.5, content: 'baz' },
      ]),
    });
    const r = await rt.retrieveRelevantChunks({
      clientId: 'c1',
      knowledgeBaseIds: ['kb1'],
      query: 'q',
      topK: 5,
    });
    expect(r.map((x) => x.id)).toEqual(['a', 'c']);
  });
});

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1, 6);
  });

  it('returns 0 for orthogonal', () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 6);
  });

  it('returns 0 for empty', () => {
    expect(cosineSimilarity([], [])).toBe(0);
  });

  it('returns 0 for different lengths', () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(0);
  });
});

describe('buildContextBlock', () => {
  it('returns fallback when no chunks', () => {
    expect(buildContextBlock([])).toMatch(/Sin contexto/);
  });

  it('numbers and labels chunks', () => {
    const out = buildContextBlock([
      { id: '1', documentId: '00000000-0000-4000-8000-aaaaaaaaaaaa', position: 0, content: 'uno', score: 0.9 },
      { id: '2', documentId: '00000000-0000-4000-8000-bbbbbbbbbbbb', position: 1, content: 'dos', score: 0.7 },
    ]);
    expect(out).toMatch(/\[#1/);
    expect(out).toMatch(/\[#2/);
    expect(out).toMatch(/uno/);
    expect(out).toMatch(/dos/);
  });
});
