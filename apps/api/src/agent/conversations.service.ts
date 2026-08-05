import { ForbiddenException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import type { TenantContext } from '@platform/contracts';
import { createAgentRuntime, type AgentRuntime, type Retriever } from '@platform/agent-runtime';
import type { EmbeddingProvider, ModelProvider } from '@platform/model-providers';
import { EMBEDDING_PROVIDER, MODEL_PROVIDER } from './agent.tokens.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleAgentRepository } from '../infrastructure/persistence/drizzle/agents.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { DrizzleChunkRepository } from '../infrastructure/persistence/drizzle/knowledge.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleConversationRepository,
  DrizzleMessageRepository,
  type ConversationRecord,
  type MessageRecord,
} from '../infrastructure/persistence/drizzle/conversations.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { WebhookDispatcherService } from '../webhooks/webhook-dispatcher.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChannelMessagesService } from '../channels/channel-messages.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { UsageEventsService, USAGE_METRICS } from '../usage/usage.service.js';

export const CONVERSATION_NOT_FOUND = 'CONVERSATION_NOT_FOUND';
export const AGENT_NOT_FOUND = 'AGENT_NOT_FOUND';
export const AGENT_HAS_NO_PUBLISHED_VERSION = 'AGENT_HAS_NO_PUBLISHED_VERSION';
export const CROSS_TENANT_CONV = 'CROSS_TENANT_CONV';

const DEFAULT_TOP_K = 4;
const FALLBACK_ANSWER = (m: string): string =>
  `Recibí tu mensaje: "${m.slice(0, 80)}". (Respuesta en modo demo: el modelo de IA no devolvió contenido.)`;

@Injectable()
export class ConversationsService {
  private readonly runtime: AgentRuntime;

  constructor(
    private readonly conversations: DrizzleConversationRepository,
    private readonly messages: DrizzleMessageRepository,
    private readonly agents: DrizzleAgentRepository,
    private readonly chunks: DrizzleChunkRepository,
    @Inject(MODEL_PROVIDER) modelProvider: ModelProvider,
    @Inject(EMBEDDING_PROVIDER) embeddingProvider: EmbeddingProvider,
    @Optional() private readonly webhooks?: WebhookDispatcherService,
    @Optional() private readonly channelMessages?: ChannelMessagesService,
    @Optional() private readonly usage?: UsageEventsService,
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

  async listByClient(ctx: TenantContext, limit: number): Promise<ConversationRecord[]> {
    this.assertClientAccess(ctx);
    return this.conversations.listByClient(ctx.clientId as string, limit);
  }

  async getById(ctx: TenantContext, id: string): Promise<ConversationRecord> {
    this.assertClientAccess(ctx);
    const c = await this.conversations.findById(id);
    if (c === null) throw new NotFoundException({ code: CONVERSATION_NOT_FOUND, message: 'Conversación no encontrada' });
    if (c.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_CONV, message: 'Conversación de otro client' });
    return c;
  }

  async listMessages(ctx: TenantContext, id: string): Promise<MessageRecord[]> {
    await this.getById(ctx, id);
    return this.messages.listByConversation(id);
  }

  async humanReply(
    ctx: TenantContext,
    conversationId: string,
    content: string,
  ): Promise<{ conversation: ConversationRecord; message: MessageRecord }> {
    const conv = await this.getById(ctx, conversationId);
    if (conv.state === 'CLOSED' || conv.state === 'RESOLVED') {
      throw new ForbiddenException({ code: CROSS_TENANT_CONV, message: 'Conversación cerrada' });
    }
    const msg = await this.messages.create({
      platformId: conv.platformId,
      distributorId: conv.distributorId,
      clientId: conv.clientId,
      conversationId: conv.id,
      direction: 'OUTBOUND',
      role: 'ASSISTANT',
      content,
      tokenCount: Math.ceil(content.length / 4),
      citations: [],
      metadata: { source: 'human', authorId: ctx.userId },
    });
    const newCount = await this.messages.countByConversation(conv.id);
    await this.conversations.touch(conv.id, msg.createdAt, newCount);
    const updated = (await this.conversations.findById(conv.id)) ?? conv;

    if (this.webhooks !== undefined) {
      void this.webhooks
        .emit(
          ctx,
          'human.reply.created',
          { conversationId: conv.id, messageId: msg.id, agentId: conv.agentId, channel: conv.channel },
          `human-reply:${msg.id}`,
        )
        .catch(() => undefined);
    }

    if (this.channelMessages !== undefined) {
      void this.channelMessages.sendOutbound(ctx, updated, msg).catch(() => undefined);
    }

    this.usage?.emit({
      platformId: conv.platformId,
      distributorId: conv.distributorId,
      clientId: conv.clientId,
      metric: USAGE_METRICS.MESSAGES_SENT,
      quantity: 1,
      agentId: conv.agentId,
      conversationId: conv.id,
    });

    return { conversation: updated, message: msg };
  }

  async closeConversation(ctx: TenantContext, conversationId: string): Promise<ConversationRecord> {
    const conv = await this.getById(ctx, conversationId);
    const updated = await this.conversations.update(conv.id, {
      state: 'CLOSED',
      closedAt: new Date(),
    });

    if (this.webhooks !== undefined) {
      void this.webhooks
        .emit(
          ctx,
          'conversation.closed',
          { conversationId: updated.id, agentId: updated.agentId, state: updated.state, channel: updated.channel },
          `conv-closed:${updated.id}:${updated.closedAt?.toISOString() ?? Date.now()}`,
        )
        .catch(() => undefined);
    }

    return updated;
  }

  async startChat(
    ctx: TenantContext,
    input: { conversationId: string | null; agentId: string; message: string; channel: string },
  ): Promise<{ conversation: ConversationRecord; inbound: MessageRecord; outbound: MessageRecord; tokensUsed: number; latencyMs: number }> {
    this.assertClientAccess(ctx);
    const agent = await this.agents.findById(input.agentId);
    if (agent === null) throw new NotFoundException({ code: AGENT_NOT_FOUND, message: 'Agent no encontrado' });
    if (agent.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_CONV, message: 'Agent de otro client' });
    const version = await this.agents.findLatestPublishedVersion(agent.id);
    if (version === null) throw new NotFoundException({ code: AGENT_HAS_NO_PUBLISHED_VERSION, message: 'Agent no tiene versión publicada' });

    let conversation: ConversationRecord;
    let isNew = false;
    if (input.conversationId !== null) {
      const c = await this.conversations.findById(input.conversationId);
      if (c === null) throw new NotFoundException({ code: CONVERSATION_NOT_FOUND, message: 'Conversación no encontrada' });
      if (c.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_CONV, message: 'Conversación de otro client' });
      conversation = c;
    } else {
      conversation = await this.conversations.create({
        platformId: ctx.platformId,
        distributorId: ctx.distributorId as string,
        clientId: ctx.clientId as string,
        agentId: agent.id,
        agentVersionId: version.id,
        channel: input.channel,
        externalConversationId: null,
        state: 'AI_ACTIVE',
        customerDisplayName: null,
        customerExternalId: null,
        lastMessageAt: null,
        messageCount: 0,
        metadata: {},
      });
      isNew = true;
    }

    const inbound = await this.messages.create({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      conversationId: conversation.id,
      direction: 'INBOUND',
      role: 'USER',
      content: input.message,
      tokenCount: Math.ceil(input.message.length / 4),
      citations: [],
      metadata: {},
    });

    this.usage?.emit({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      metric: USAGE_METRICS.MESSAGES_RECEIVED,
      quantity: 1,
      agentId: conversation.agentId,
      conversationId: conversation.id,
    });
    if (inbound.tokenCount > 0) {
      this.usage?.emit({
        platformId: ctx.platformId,
        distributorId: ctx.distributorId as string,
        clientId: ctx.clientId as string,
        metric: USAGE_METRICS.TOKENS_INPUT,
        quantity: inbound.tokenCount,
        agentId: conversation.agentId,
        conversationId: conversation.id,
      });
    }

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
      tenantContext: ctx,
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
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      role: 'ASSISTANT',
      content: answer,
      tokenCount: Math.ceil(answer.length / 4),
      citations: turn.citations,
      metadata: { modelProfile: version.modelProfile, latencyMs: turn.latencyMs, tokensUsed: turn.tokensUsed },
    });

    const newCount = await this.messages.countByConversation(conversation.id);
    await this.conversations.touch(conversation.id, outbound.createdAt, newCount);
    const updated = (await this.conversations.findById(conversation.id)) ?? conversation;

    if (isNew && this.webhooks !== undefined) {
      void this.webhooks
        .emit(
          ctx,
          'conversation.started',
          { conversationId: updated.id, agentId: updated.agentId, channel: updated.channel, state: updated.state },
          `conv-started:${updated.id}`,
        )
        .catch(() => undefined);
    }

    if (this.channelMessages !== undefined) {
      void this.channelMessages.sendOutbound(ctx, updated, outbound).catch(() => undefined);
    }

    this.usage?.emit({
      platformId: updated.platformId,
      distributorId: updated.distributorId,
      clientId: updated.clientId,
      metric: USAGE_METRICS.AGENT_RUNS,
      quantity: 1,
      agentId: updated.agentId,
      conversationId: updated.id,
    });
    if (turn.tokensUsed > 0) {
      this.usage?.emit({
        platformId: updated.platformId,
        distributorId: updated.distributorId,
        clientId: updated.clientId,
        metric: USAGE_METRICS.TOKENS_OUTPUT,
        quantity: turn.tokensUsed,
        agentId: updated.agentId,
        conversationId: updated.id,
      });
    }

    return { conversation: updated, inbound, outbound, tokensUsed: turn.tokensUsed, latencyMs: turn.latencyMs };
  }

  async testAgent(
    ctx: TenantContext,
    input: { agentId: string; agentVersionId: string | null; message: string },
  ): Promise<{ answer: string; citations: Array<{ documentId: string; chunkId: string; position: number }>; tokensUsed: number; latencyMs: number }> {
    this.assertClientAccess(ctx);
    const agent = await this.agents.findById(input.agentId);
    if (agent === null) throw new NotFoundException({ code: AGENT_NOT_FOUND, message: 'Agent no encontrado' });
    if (agent.clientId !== ctx.clientId) throw new ForbiddenException({ code: CROSS_TENANT_CONV, message: 'Agent de otro client' });
    const version =
      input.agentVersionId !== null
        ? await this.agents.findVersionById(input.agentVersionId)
        : await this.agents.findLatestPublishedVersion(agent.id);
    if (version === null) throw new NotFoundException({ code: AGENT_HAS_NO_PUBLISHED_VERSION, message: 'Versión no encontrada' });
    const params = version.modelParameters;
    const knowledgeBaseIds = Array.isArray(params['knowledgeBaseIds']) ? (params['knowledgeBaseIds'] as string[]) : [];
    const topK = typeof params['topK'] === 'number' ? (params['topK'] as number) : DEFAULT_TOP_K;
    const turn = await this.runtime.executeTestTurn({
      tenantContext: ctx,
      agentVersionId: version.id,
      userMessage: input.message,
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
    return { answer: turn.answer, citations: turn.citations, tokensUsed: turn.tokensUsed, latencyMs: turn.latencyMs };
  }

  private assertClientAccess(ctx: TenantContext): void {
    if (ctx.clientId === null || ctx.clientId === undefined) {
      throw new ForbiddenException({ code: CROSS_TENANT_CONV, message: 'Se requiere clientId en TenantContext' });
    }
  }
}
