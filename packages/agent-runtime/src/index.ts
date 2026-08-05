import type { TenantContext } from '@platform/contracts';
import type { EmbeddingProvider, ModelProvider } from '@platform/model-providers';

export interface AgentTurnOutput {
  answer: string;
  citations: Array<{ documentId: string; chunkId: string; position: number }>;
  tokensUsed: number;
  latencyMs: number;
}

export interface ExecuteAgentTurnInput {
  tenantContext: TenantContext;
  conversationId: string;
  agentVersionId: string;
  inboundMessageId: string;
  correlationId?: string;
  userMessage: string;
  history: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
  agentVersion: {
    id: string;
    systemPrompt: string;
    welcomeMessage: string | null;
    forbiddenRules: string[];
    allowedRules: string[];
    modelProfile: string;
    modelParameters: Record<string, unknown>;
  };
}

export interface ExecuteTestTurnInput {
  tenantContext: TenantContext;
  agentVersionId: string;
  userMessage: string;
  agentVersion: ExecuteAgentTurnInput['agentVersion'];
  history?: ExecuteAgentTurnInput['history'];
}

export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  position: number;
  score: number;
}

export interface AgentRuntime {
  executeTurn(input: ExecuteAgentTurnInput): Promise<AgentTurnOutput>;
  executeTestTurn(input: ExecuteTestTurnInput): Promise<AgentTurnOutput>;
  retrieveRelevantChunks(input: {
    clientId: string;
    knowledgeBaseIds: string[];
    query: string;
    topK: number;
  }): Promise<RetrievedChunk[]>;
}

export interface AgentRuntimeDeps {
  modelProvider: ModelProvider;
  embeddingProvider: EmbeddingProvider;
  retriever: Retriever;
}

export interface Retriever {
  retrieveByEmbedding(input: {
    clientId: string;
    knowledgeBaseIds: string[];
    embedding: number[];
    topK: number;
  }): Promise<RetrievedChunk[]>;
}

const DEFAULT_TOP_K = 4;
const MIN_RELEVANCE = 0.05;

const buildContextBlock = (chunks: RetrievedChunk[]): string => {
  if (chunks.length === 0) return 'Sin contexto relevante en la knowledge base.';
  return chunks
    .map((c, i) => `[#${i + 1} doc=${c.documentId.slice(0, 8)} pos=${c.position} score=${c.score.toFixed(3)}]\n${c.content}`)
    .join('\n\n');
};

export const createAgentRuntime = (deps: AgentRuntimeDeps): AgentRuntime => {
  const { modelProvider, embeddingProvider, retriever } = deps;

  const retrieveRelevantChunks: AgentRuntime['retrieveRelevantChunks'] = async (input) => {
    const emb = await embeddingProvider.generateEmbedding({ text: input.query });
    const retrieved = await retriever.retrieveByEmbedding({
      clientId: input.clientId,
      knowledgeBaseIds: input.knowledgeBaseIds,
      embedding: emb.embedding,
      topK: input.topK,
    });
    return retrieved.filter((c) => c.score >= MIN_RELEVANCE);
  };

  const buildPrompt = (args: {
    agentVersion: ExecuteAgentTurnInput['agentVersion'];
    userMessage: string;
    history: ExecuteAgentTurnInput['history'];
    context: string;
  }): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> => {
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: [
          args.agentVersion.systemPrompt,
          '',
          'Reglas prohibidas:',
          ...args.agentVersion.forbiddenRules.map((r) => `- ${r}`),
          '',
          'Contexto de la knowledge base (usa solo lo relevante):',
          args.context,
        ]
          .filter(Boolean)
          .join('\n'),
      },
    ];
    for (const h of args.history.slice(-10)) {
      if (h.role === 'system') continue;
      messages.push({ role: h.role, content: h.content });
    }
    messages.push({ role: 'user', content: args.userMessage });
    return messages;
  };

  const runOnce = async (args: {
    tenantContext: TenantContext;
    agentVersion: ExecuteAgentTurnInput['agentVersion'];
    userMessage: string;
    history: ExecuteAgentTurnInput['history'];
  }): Promise<AgentTurnOutput> => {
    const start = Date.now();
    const ctx = args.tenantContext;
    if (ctx.clientId === null || ctx.clientId === undefined) {
      throw new Error('AgentRuntime requiere un TenantContext con clientId');
    }
    const kbIds = args.agentVersion.modelParameters['knowledgeBaseIds'];
    const topK =
      typeof args.agentVersion.modelParameters['topK'] === 'number'
        ? (args.agentVersion.modelParameters['topK'] as number)
        : DEFAULT_TOP_K;

    let context = 'Sin contexto relevante en la knowledge base.';
    let retrieved: RetrievedChunk[] = [];
    if (Array.isArray(kbIds) && kbIds.length > 0) {
      retrieved = await retrieveRelevantChunks({
        clientId: ctx.clientId,
        knowledgeBaseIds: kbIds as string[],
        query: args.userMessage,
        topK,
      });
      context = buildContextBlock(retrieved);
    }

    const messages = buildPrompt({
      agentVersion: args.agentVersion,
      userMessage: args.userMessage,
      history: args.history,
      context,
    });

    const res = await modelProvider.summarizeConversation({
      conversationId: 'inline',
      messages,
      maxOutputTokens: 600,
    });

    return {
      answer: res.summary,
      citations: retrieved.map((c) => ({ documentId: c.documentId, chunkId: c.id, position: c.position })),
      tokensUsed: res.tokensUsed,
      latencyMs: Date.now() - start,
    };
  };

  return {
    executeTurn: (input) => runOnce(input),
    executeTestTurn: (input) => runOnce({ ...input, history: input.history ?? [] }),
    retrieveRelevantChunks,
  };
};

export const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    dot += av * bv;
    na += av * av;
    nb += bv * bv;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
};
