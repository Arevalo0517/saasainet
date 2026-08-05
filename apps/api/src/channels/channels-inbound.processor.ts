import { Inject, Injectable, Optional } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { ChannelAdapterRegistry } from '@platform/channel-adapters';
import type { NormalizedMessage } from '@platform/channel-adapters';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleChannelConnectionsRepository,
  type ChannelConnectionRecord,
} from '../infrastructure/persistence/drizzle/channels.repository.js';
import type {
  DrizzleConversationRepository,
  DrizzleMessageRepository,
  ConversationRecord,
} from '../infrastructure/persistence/drizzle/conversations.repository.js';
import type { ChannelConnectionsService } from './channel-connections.service.js';
import { CHANNEL_ADAPTER_REGISTRY } from './channels.tokens.js';

@Injectable()
export class ChannelsInboundProcessor {
  constructor(
    private readonly connections: DrizzleChannelConnectionsRepository,
    private readonly conversations: DrizzleConversationRepository,
    private readonly messages: DrizzleMessageRepository,
    private readonly connectionsService: ChannelConnectionsService,
    @Optional() @Inject(CHANNEL_ADAPTER_REGISTRY) private readonly registry?: ChannelAdapterRegistry,
  ) {}

  async processInbound(
    connectionId: string,
    agentId: string,
    channel: string,
    body: unknown,
    providerEventId: string,
    rawPayloadReference: string,
  ): Promise<{ received: number; deduplicated: number; conversationId?: string; messageId?: string }> {
    const conn = await this.connections.getByIdAny(connectionId);
    if (conn === null || conn.status !== 'CONNECTED' || conn.archivedAt !== null) {
      return { received: 0, deduplicated: 0 };
    }
    if (this.registry === undefined) return { received: 0, deduplicated: 0 };
    const normalized = await this.connectionsService.parseInboundEvent(conn, body, providerEventId, rawPayloadReference);
    let firstConversationId: string | undefined;
    let firstMessageId: string | undefined;
    let count = 0;
    let deduplicated = 0;
    for (const n of normalized) {
      if (n.channel !== channel) continue;
      const result = await this.upsertInbound(conn, agentId, n);
      if (firstConversationId === undefined) firstConversationId = result.conversationId;
      if (firstMessageId === undefined) firstMessageId = result.messageId;
      if (result.deduplicated) {
        deduplicated += 1;
        continue;
      }
      count += 1;
    }
    return { received: count, deduplicated, conversationId: firstConversationId, messageId: firstMessageId };
  }

  private async upsertInbound(
    conn: ChannelConnectionRecord,
    agentId: string,
    n: NormalizedMessage,
  ): Promise<{ conversationId: string; messageId: string; deduplicated: boolean }> {
    let conv: ConversationRecord | null = await this.conversations.findByExternalId(
      conn.clientId,
      conn.channel,
      n.externalConversationId,
    );
    if (conv === null) {
      conv = await this.conversations.create({
        platformId: conn.platformId,
        distributorId: conn.distributorId,
        clientId: conn.clientId,
        agentId,
        agentVersionId: null,
        channel: conn.channel,
        externalConversationId: n.externalConversationId,
        state: 'NEW',
        customerDisplayName: n.sender.displayName ?? null,
        customerExternalId: n.sender.externalId,
        lastMessageAt: null,
        messageCount: 0,
        metadata: { source: 'channel_webhook', providerEventId: n.providerEventId },
      });
    } else {
      conv = await this.conversations.update(conv.id, { state: 'AI_ACTIVE' });
    }
    const existing = await this.messages.findByExternalId(conv.id, n.externalMessageId);
    if (existing !== null) {
      return { conversationId: conv.id, messageId: existing.id, deduplicated: true };
    }
    const msg = await this.messages.create({
      platformId: conn.platformId,
      distributorId: conn.distributorId,
      clientId: conn.clientId,
      conversationId: conv.id,
      direction: 'INBOUND',
      role: 'USER',
      content: n.text ?? '',
      tokenCount: Math.ceil((n.text ?? '').length / 4),
      externalMessageId: n.externalMessageId,
      providerEventId: n.providerEventId,
      citations: [],
      metadata: {
        channel: conn.channel,
        providerMessageId: n.externalMessageId,
        senderPhone: n.sender.phone,
      },
    });
    const newCount = await this.messages.countByConversation(conv.id);
    await this.conversations.touch(conv.id, msg.createdAt, newCount);
    return { conversationId: conv.id, messageId: msg.id, deduplicated: false };
  }
}
