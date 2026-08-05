import { Injectable, NotFoundException } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleAgentRepository } from '../infrastructure/persistence/drizzle/agents.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleChunkRepository,
} from '../infrastructure/persistence/drizzle/knowledge.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleConversationRepository,
  DrizzleMessageRepository,
  type ConversationRecord,
  type MessageRecord,
} from '../infrastructure/persistence/drizzle/conversations.repository.js';
import type { EmbeddingProvider, ModelProvider } from '@platform/model-providers';
import { createAgentRuntime, type AgentRuntime, type Retriever } from '@platform/agent-runtime';
import { EMBEDDING_PROVIDER, MODEL_PROVIDER } from './agent.tokens.js';
import { Inject } from '@nestjs/common';

export const WIDGET_NOT_FOUND = 'WIDGET_NOT_FOUND';
export const WIDGET_AGENT_NOT_PUBLISHED = 'WIDGET_AGENT_NOT_PUBLISHED';

export interface WidgetConfig {
  publicWidgetId: string;
  agentId: string;
  agentName: string;
  welcomeMessage: string;
  primaryColor: string;
  position: 'bottom-right' | 'bottom-left';
  title: string;
}

export interface WidgetChatResult {
  conversationExternalId: string;
  inbound: MessageRecord;
  outbound: MessageRecord;
  tokensUsed: number;
  latencyMs: number;
}

const DEFAULT_TOP_K = 4;
const FALLBACK_ANSWER = (m: string): string =>
  `Recibí tu mensaje: "${m.slice(0, 80)}". (Respuesta en modo demo.)`;

@Injectable()
export class WidgetService {
  private readonly runtime: AgentRuntime;

  constructor(
    private readonly agents: DrizzleAgentRepository,
    private readonly conversations: DrizzleConversationRepository,
    private readonly messages: DrizzleMessageRepository,
    private readonly chunks: DrizzleChunkRepository,
    @Inject(MODEL_PROVIDER) modelProvider: ModelProvider,
    @Inject(EMBEDDING_PROVIDER) embeddingProvider: EmbeddingProvider,
  ) {
    const retriever: Retriever = {
      retrieveByEmbedding: async (input) => {
        const rows = await this.chunks.retrieveByEmbedding({
          clientId: input.clientId,
          knowledgeBaseIds: input.knowledgeBaseIds,
          embedding: input.embedding,
          topK: input.topK,
        });
        return rows.map((r) => ({
          id: r.id,
          documentId: r.documentId,
          position: r.position,
          content: r.content,
          score: r.score,
        }));
      },
    };
    this.runtime = createAgentRuntime({ modelProvider, embeddingProvider, retriever });
  }

  async getConfig(publicWidgetId: string): Promise<WidgetConfig> {
    const agent = await this.agents.findByPublicWidgetId(publicWidgetId);
    if (agent === null) {
      throw new NotFoundException({ code: WIDGET_NOT_FOUND, message: 'Widget no encontrado o archivado' });
    }
    const version = await this.agents.findLatestPublishedVersion(agent.id);
    if (version === null) {
      throw new NotFoundException({ code: WIDGET_AGENT_NOT_PUBLISHED, message: 'Agent sin versión publicada' });
    }
    return {
      publicWidgetId: agent.publicWidgetId as string,
      agentId: agent.id,
      agentName: agent.name,
      welcomeMessage: version.welcomeMessage ?? 'Hola, ¿en qué te ayudo?',
      primaryColor: '#22D3EE',
      position: 'bottom-right',
      title: agent.name,
    };
  }

  async chat(
    publicWidgetId: string,
    input: { conversationExternalId: string; message: string; customerDisplayName: string | null },
  ): Promise<WidgetChatResult> {
    const agent = await this.agents.findByPublicWidgetId(publicWidgetId);
    if (agent === null) {
      throw new NotFoundException({ code: WIDGET_NOT_FOUND, message: 'Widget no encontrado o archivado' });
    }
    const version = await this.agents.findLatestPublishedVersion(agent.id);
    if (version === null) {
      throw new NotFoundException({ code: WIDGET_AGENT_NOT_PUBLISHED, message: 'Agent sin versión publicada' });
    }

    let conversation: ConversationRecord | null = await this.conversations.findByExternalId(
      agent.clientId,
      'WIDGET',
      input.conversationExternalId,
    );
    if (conversation === null) {
      conversation = await this.conversations.create({
        platformId: agent.platformId,
        distributorId: agent.distributorId,
        clientId: agent.clientId,
        agentId: agent.id,
        agentVersionId: version.id,
        channel: 'WIDGET',
        externalConversationId: input.conversationExternalId,
        state: 'AI_ACTIVE',
        customerDisplayName: input.customerDisplayName,
        customerExternalId: input.conversationExternalId,
        lastMessageAt: null,
        messageCount: 0,
        metadata: { source: 'widget' },
      });
    }

    const inbound = await this.messages.create({
      platformId: agent.platformId,
      distributorId: agent.distributorId,
      clientId: agent.clientId,
      conversationId: conversation.id,
      direction: 'INBOUND',
      role: 'USER',
      content: input.message,
      tokenCount: Math.ceil(input.message.length / 4),
      citations: [],
      metadata: { source: 'widget' },
    });

    const history = (await this.messages.listByConversation(conversation.id))
      .filter((m) => m.id !== inbound.id)
      .map((m) => ({
        role: m.direction === 'INBOUND' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      }));

    const params = version.modelParameters;
    const knowledgeBaseIds = Array.isArray(params['knowledgeBaseIds']) ? (params['knowledgeBaseIds'] as string[]) : [];
    const topK = typeof params['topK'] === 'number' ? (params['topK'] as number) : DEFAULT_TOP_K;

    const turn = await this.runtime.executeTurn({
      tenantContext: {
        platformId: agent.platformId,
        distributorId: agent.distributorId,
        clientId: agent.clientId,
        userId: agent.id,
        roles: ['widget_anonymous'],
        permissions: ['chat:write'],
        isSupportSession: false,
      },
      conversationId: conversation.id,
      agentVersionId: version.id,
      inboundMessageId: inbound.id,
      userMessage: input.message,
      history,
      agentVersion: {
        id: version.id,
        systemPrompt: version.systemPrompt,
        welcomeMessage: version.welcomeMessage,
        forbiddenRules: version.forbiddenRules,
        allowedRules: version.allowedRules,
        modelProfile: version.modelProfile,
        modelParameters: { ...version.modelParameters, knowledgeBaseIds, topK },
      },
    });

    const answer = turn.answer.trim().length > 0 ? turn.answer : FALLBACK_ANSWER(input.message);
    const outbound = await this.messages.create({
      platformId: agent.platformId,
      distributorId: agent.distributorId,
      clientId: agent.clientId,
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      role: 'ASSISTANT',
      content: answer,
      tokenCount: Math.ceil(answer.length / 4),
      citations: turn.citations,
      metadata: { source: 'widget', latencyMs: turn.latencyMs, tokensUsed: turn.tokensUsed, modelProfile: version.modelProfile },
    });

    const newCount = await this.messages.countByConversation(conversation.id);
    await this.conversations.touch(conversation.id, outbound.createdAt, newCount);

    return {
      conversationExternalId: input.conversationExternalId,
      inbound,
      outbound,
      tokensUsed: turn.tokensUsed,
      latencyMs: turn.latencyMs,
    };
  }
}
