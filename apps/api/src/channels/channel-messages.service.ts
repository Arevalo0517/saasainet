import { Inject, Injectable } from '@nestjs/common';
import { createHmac } from 'node:crypto';
import type { TenantContext } from '@platform/contracts';
import type { ChannelAdapter, ChannelAdapterRegistry, NormalizedMessage } from '@platform/channel-adapters';
import type { MessageDeliveryRecord } from '@platform/db';
import type {
  ConversationRecord,
  MessageRecord,
} from '../infrastructure/persistence/drizzle/conversations.repository.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import {
  DrizzleChannelConnectionsRepository,
  DrizzleMessageDeliveriesRepository,
} from '../infrastructure/persistence/drizzle/channels.repository.js';
import { CHANNEL_ADAPTER_REGISTRY } from './channels.tokens.js';
import { CHANNEL_CONNECTION_NOT_FOUND, DELIVERY_NOT_FOUND, DELIVERY_NOT_FOR_CONNECTION } from './channels.errors.js';

const adapterFor = (registry: ChannelAdapterRegistry, channel: string): ChannelAdapter => {
  return registry.get(channel as 'WHATSAPP' | 'TELEGRAM' | 'MESSENGER' | 'INSTAGRAM');
};

export const buildExternalSignature = (body: string, secret: string): string => {
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${digest}`;
};

export const toDeliveryDto = (d: MessageDeliveryRecord): Record<string, unknown> => ({
  id: d.id,
  conversationId: d.conversationId,
  messageId: d.messageId,
  channel: d.channel,
  channelConnectionId: d.channelConnectionId,
  providerMessageId: d.providerMessageId,
  status: d.status,
  errorCode: d.errorCode,
  errorMessage: d.errorMessage,
  attemptedAt: d.attemptedAt.toISOString(),
  deliveredAt: d.deliveredAt?.toISOString() ?? null,
  readAt: d.readAt?.toISOString() ?? null,
  createdAt: d.createdAt.toISOString(),
  updatedAt: d.updatedAt.toISOString(),
});

@Injectable()
export class ChannelMessagesService {
  constructor(
    private readonly connections: DrizzleChannelConnectionsRepository,
    private readonly deliveries: DrizzleMessageDeliveriesRepository,
    @Inject(CHANNEL_ADAPTER_REGISTRY) private readonly registry: ChannelAdapterRegistry,
  ) {}

  async sendOutbound(
    ctx: Pick<TenantContext, 'platformId' | 'distributorId' | 'clientId'>,
    conversation: ConversationRecord,
    message: MessageRecord,
  ): Promise<MessageDeliveryRecord | null> {
    if (conversation.channel === 'WIDGET' || conversation.channel === null) return null;
    const conn = await this.connections.getActiveByChannel(ctx.clientId as string, conversation.channel);
    if (conn === null) return null;
    const adapter = adapterFor(this.registry, conn.channel);
    const delivery = await this.deliveries.create({
      platformId: ctx.platformId,
      distributorId: ctx.distributorId as string,
      clientId: ctx.clientId as string,
      conversationId: conversation.id,
      messageId: message.id,
      channel: conn.channel,
      channelConnectionId: conn.id,
      status: 'QUEUED',
    });
    try {
      const res = await adapter.sendMessage({
        channelConnectionId: conn.id,
        conversationExternalId: conversation.externalConversationId ?? '',
        recipient: {
          externalId: conversation.customerExternalId ?? 'unknown',
          displayName: conversation.customerDisplayName,
          phone: null,
          email: null,
        },
        text: message.content,
      });
      return this.deliveries.markSent(delivery.id, res.providerMessageId);
    } catch (err) {
      const e = err as Error;
      const m = /^.*? ([A-Z_]+): (.*)$/i.exec(e.message);
      const code = m?.[1] ?? 'SEND_FAILED';
      const msg = m?.[2] ?? e.message;
      return this.deliveries.markFailed(delivery.id, code, msg);
    }
  }

  async listDeliveriesForConnection(
    ctx: TenantContext,
    connectionId: string,
    limit: number,
  ): Promise<MessageDeliveryRecord[]> {
    const conn = await this.connections.getById(ctx.clientId as string, connectionId);
    if (conn === null) throw CHANNEL_CONNECTION_NOT_FOUND(connectionId);
    return this.deliveries.listByConnectionId(connectionId, limit);
  }

  async refreshDeliveryStatus(
    ctx: TenantContext,
    deliveryId: string,
  ): Promise<MessageDeliveryRecord> {
    const d = await this.deliveries.getById(ctx.clientId as string, deliveryId);
    if (d === null) throw DELIVERY_NOT_FOUND(deliveryId);
    if (d.channelConnectionId === null) throw DELIVERY_NOT_FOR_CONNECTION();
    const conn = await this.connections.getById(ctx.clientId as string, d.channelConnectionId);
    if (conn === null) throw DELIVERY_NOT_FOR_CONNECTION();
    const adapter = adapterFor(this.registry, conn.channel);
    if (d.providerMessageId === null) return d;
    const status = await adapter.getDeliveryStatus({
      channelConnectionId: conn.id,
      providerMessageId: d.providerMessageId,
    });
    if (status.status === 'DELIVERED' && d.status === 'SENT') {
      return this.deliveries.markDelivered(d.id);
    }
    if (status.status === 'READ' && (d.status === 'SENT' || d.status === 'DELIVERED')) {
      return this.deliveries.markDelivered(d.id).then((r) => this.deliveries.markRead(r.id));
    }
    return d;
  }
}

export const parseInboundToMessage = (n: NormalizedMessage): {
  externalConversationId: string;
  externalMessageId: string;
  text: string | null;
  senderName: string | null;
  senderPhone: string | null;
} => ({
  externalConversationId: n.externalConversationId,
  externalMessageId: n.externalMessageId,
  text: n.text ?? null,
  senderName: n.sender.displayName ?? null,
  senderPhone: n.sender.phone ?? null,
});

