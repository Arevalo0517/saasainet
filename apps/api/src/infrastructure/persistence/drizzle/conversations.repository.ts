import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { Database } from '@platform/db';
import {
  conversations,
  messages,
  type Conversation,
  type Message,
  type NewConversation,
  type NewMessage,
} from '@platform/db';

export type ConversationRecord = Conversation;
export type MessageRecord = Message;

export class DrizzleConversationRepository {
  constructor(private readonly db: Database) {}

  async listByClient(clientId: string, limit: number): Promise<ConversationRecord[]> {
    return this.db
      .select()
      .from(conversations)
      .where(eq(conversations.clientId, clientId))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(limit);
  }

  async findById(id: string): Promise<ConversationRecord | null> {
    const rows = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByExternalId(clientId: string, channel: string, externalId: string): Promise<ConversationRecord | null> {
    const rows = await this.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.clientId, clientId),
          eq(conversations.channel, channel),
          eq(conversations.externalConversationId, externalId),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewConversation): Promise<ConversationRecord> {
    const rows = await this.db.insert(conversations).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('conversation create returned no rows');
    return r;
  }

  async update(id: string, patch: Partial<ConversationRecord>): Promise<ConversationRecord> {
    const rows = await this.db
      .update(conversations)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(conversations.id, id))
      .returning();
    const r = rows[0];
    if (!r) throw new Error('conversation update returned no rows');
    return r;
  }

  async touch(id: string, lastMessageAt: Date, messageCount: number): Promise<void> {
    await this.db
      .update(conversations)
      .set({ lastMessageAt, messageCount, updatedAt: new Date() })
      .where(eq(conversations.id, id));
  }
}

export class DrizzleMessageRepository {
  constructor(private readonly db: Database) {}

  async listByConversation(conversationId: string): Promise<MessageRecord[]> {
    return this.db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
  }

  async findById(id: string): Promise<MessageRecord | null> {
    const rows = await this.db.select().from(messages).where(eq(messages.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByExternalId(conversationId: string, externalMessageId: string): Promise<MessageRecord | null> {
    if (externalMessageId.length === 0) return null;
    const rows = await this.db
      .select()
      .from(messages)
      .where(and(eq(messages.conversationId, conversationId), eq(messages.externalMessageId, externalMessageId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async create(input: NewMessage): Promise<MessageRecord> {
    const rows = await this.db.insert(messages).values(input).returning();
    const r = rows[0];
    if (!r) throw new Error('message create returned no rows');
    return r;
  }

  async countByConversation(conversationId: string): Promise<number> {
    const rows = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(messages)
      .where(eq(messages.conversationId, conversationId));
    return rows[0]?.count ?? 0;
  }
}
