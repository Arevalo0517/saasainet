import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import {
  channelConnections,
  messageDeliveries,
  type ChannelConnectionRecord,
  type MessageDeliveryRecord,
  type NewChannelConnection,
  type NewMessageDelivery,
} from '@platform/db';
import type { Database } from '@platform/db';

export class DrizzleChannelConnectionsRepository {
  constructor(private readonly db: Database) {}

  async listByClient(clientId: string, includeArchived: boolean): Promise<ChannelConnectionRecord[]> {
    const where = includeArchived
      ? eq(channelConnections.clientId, clientId)
      : and(eq(channelConnections.clientId, clientId), isNull(channelConnections.archivedAt));
    return this.db.select().from(channelConnections).where(where).orderBy(asc(channelConnections.createdAt));
  }

  async getById(clientId: string, id: string): Promise<ChannelConnectionRecord | null> {
    const rows = await this.db
      .select()
      .from(channelConnections)
      .where(and(eq(channelConnections.id, id), eq(channelConnections.clientId, clientId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async getByIdAny(id: string): Promise<ChannelConnectionRecord | null> {
    const rows = await this.db.select().from(channelConnections).where(eq(channelConnections.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async getActiveByChannel(clientId: string, channel: string): Promise<ChannelConnectionRecord | null> {
    const rows = await this.db
      .select()
      .from(channelConnections)
      .where(
        and(
          eq(channelConnections.clientId, clientId),
          eq(channelConnections.channel, channel),
          eq(channelConnections.status, 'CONNECTED'),
          isNull(channelConnections.archivedAt),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewChannelConnection): Promise<ChannelConnectionRecord> {
    const [row] = await this.db.insert(channelConnections).values(input).returning();
    if (row === undefined) throw new Error('channel_connections insert returned no row');
    return row;
  }

  async update(
    clientId: string,
    id: string,
    patch: Partial<
      Pick<
        ChannelConnectionRecord,
        | 'name'
        | 'phoneNumber'
        | 'credentialsCiphertext'
        | 'status'
        | 'lastError'
        | 'lastVerifiedAt'
        | 'webhookSecretCiphertext'
      >
    >,
  ): Promise<ChannelConnectionRecord> {
    const [row] = await this.db
      .update(channelConnections)
      .set({ ...patch, updatedAt: new Date() })
      .where(and(eq(channelConnections.id, id), eq(channelConnections.clientId, clientId)))
      .returning();
    if (row === undefined) throw new Error('channel_connections update returned no row');
    return row;
  }

  async archive(clientId: string, id: string): Promise<ChannelConnectionRecord> {
    const [row] = await this.db
      .update(channelConnections)
      .set({ status: 'DISCONNECTED', archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(channelConnections.id, id), eq(channelConnections.clientId, clientId)))
      .returning();
    if (row === undefined) throw new Error('channel_connections archive returned no row');
    return row;
  }
}

export class DrizzleMessageDeliveriesRepository {
  constructor(private readonly db: Database) {}

  async create(input: NewMessageDelivery): Promise<MessageDeliveryRecord> {
    const [row] = await this.db.insert(messageDeliveries).values(input).returning();
    if (row === undefined) throw new Error('message_deliveries insert returned no row');
    return row;
  }

  async getByMessageId(messageId: string): Promise<MessageDeliveryRecord | null> {
    const rows = await this.db
      .select()
      .from(messageDeliveries)
      .where(eq(messageDeliveries.messageId, messageId))
      .limit(1);
    return rows[0] ?? null;
  }

  async getById(clientId: string, id: string): Promise<MessageDeliveryRecord | null> {
    const rows = await this.db
      .select()
      .from(messageDeliveries)
      .where(and(eq(messageDeliveries.id, id), eq(messageDeliveries.clientId, clientId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async listByConnectionId(channelConnectionId: string, limit: number): Promise<MessageDeliveryRecord[]> {
    return this.db
      .select()
      .from(messageDeliveries)
      .where(eq(messageDeliveries.channelConnectionId, channelConnectionId))
      .orderBy(desc(messageDeliveries.createdAt))
      .limit(limit);
  }

  async listByConversation(conversationId: string, limit: number): Promise<MessageDeliveryRecord[]> {
    return this.db
      .select()
      .from(messageDeliveries)
      .where(eq(messageDeliveries.conversationId, conversationId))
      .orderBy(desc(messageDeliveries.createdAt))
      .limit(limit);
  }

  async markSent(id: string, providerMessageId: string): Promise<MessageDeliveryRecord> {
    const [row] = await this.db
      .update(messageDeliveries)
      .set({ status: 'SENT', providerMessageId, updatedAt: new Date() })
      .where(eq(messageDeliveries.id, id))
      .returning();
    if (row === undefined) throw new Error('message_deliveries markSent returned no row');
    return row;
  }

  async markDelivered(id: string): Promise<MessageDeliveryRecord> {
    const [row] = await this.db
      .update(messageDeliveries)
      .set({ status: 'DELIVERED', deliveredAt: new Date(), updatedAt: new Date() })
      .where(eq(messageDeliveries.id, id))
      .returning();
    if (row === undefined) throw new Error('message_deliveries markDelivered returned no row');
    return row;
  }

  async markRead(id: string): Promise<MessageDeliveryRecord> {
    const [row] = await this.db
      .update(messageDeliveries)
      .set({ status: 'READ', readAt: new Date(), updatedAt: new Date() })
      .where(eq(messageDeliveries.id, id))
      .returning();
    if (row === undefined) throw new Error('message_deliveries markRead returned no row');
    return row;
  }

  async markFailed(id: string, errorCode: string, errorMessage: string): Promise<MessageDeliveryRecord> {
    const [row] = await this.db
      .update(messageDeliveries)
      .set({ status: 'FAILED', errorCode, errorMessage: errorMessage.slice(0, 1000), updatedAt: new Date() })
      .where(eq(messageDeliveries.id, id))
      .returning();
    if (row === undefined) throw new Error('message_deliveries markFailed returned no row');
    return row;
  }
}

export type { ChannelConnectionRecord, MessageDeliveryRecord };
