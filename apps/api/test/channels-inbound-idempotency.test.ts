import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelsInboundProcessor } from '../src/channels/channels-inbound.processor.js';
import type {
  DrizzleChannelConnectionsRepository,
  ChannelConnectionRecord,
} from '../src/infrastructure/persistence/drizzle/channels.repository.js';
import type {
  DrizzleConversationRepository,
  DrizzleMessageRepository,
  ConversationRecord,
  MessageRecord,
} from '../src/infrastructure/persistence/drizzle/conversations.repository.js';
import type { ChannelConnectionsService } from '../src/channels/channel-connections.service.js';
import type { NormalizedMessage } from '@platform/channel-adapters';

const makeConn = (overrides: Partial<ChannelConnectionRecord> = {}): ChannelConnectionRecord => ({
  id: 'conn-1',
  platformId: 'plat-1',
  distributorId: 'dist-1',
  clientId: 'client-1',
  channel: 'WHATSAPP',
  name: 'Test',
  webhookSecretCiphertext: null,
  credentialsCiphertext: null,
  externalAccountId: '5511999999999',
  status: 'CONNECTED',
  state: 'VERIFIED',
  lastError: null,
  archivedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeNormalized = (overrides: Partial<NormalizedMessage> = {}): NormalizedMessage => ({
  channel: 'WHATSAPP',
  externalConversationId: 'ext-conv-1',
  externalMessageId: 'ext-msg-1',
  providerEventId: 'evt-1',
  sender: { externalId: '5511999999999', displayName: 'Test', phone: '+5511999999999' },
  text: 'hello world',
  receivedAt: new Date(),
  ...overrides,
});

class InMemoryConnectionsRepo {
  private store = new Map<string, ChannelConnectionRecord>();
  set(c: ChannelConnectionRecord): void { this.store.set(c.id, c); }
  async getByIdAny(id: string): Promise<ChannelConnectionRecord | null> { return this.store.get(id) ?? null; }
}

class InMemoryConversationsRepo {
  byExt = new Map<string, ConversationRecord>();
  private counter = 0;
  async findByExternalId(clientId: string, channel: string, ext: string): Promise<ConversationRecord | null> {
    return this.byExt.get(`${clientId}:${channel}:${ext}`) ?? null;
  }
  async create(input: Omit<ConversationRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<ConversationRecord> {
    this.counter += 1;
    const rec: ConversationRecord = { id: `conv-${this.counter}`, createdAt: new Date(), updatedAt: new Date(), ...input };
    this.byExt.set(`${input.clientId}:${input.channel}:${input.externalConversationId ?? ''}`, rec);
    return rec;
  }
  async update(id: string, patch: Partial<ConversationRecord>): Promise<ConversationRecord> {
    const existing = [...this.byExt.values()].find((c) => c.id === id);
    if (existing === undefined) throw new Error('not found');
    const updated = { ...existing, ...patch, updatedAt: new Date() };
    this.byExt.set(`${updated.clientId}:${updated.channel}:${updated.externalConversationId ?? ''}`, updated);
    return updated;
  }
  async touch(id: string, at: Date, count: number): Promise<void> {
    const existing = [...this.byExt.values()].find((c) => c.id === id);
    if (existing === undefined) return;
    const updated = { ...existing, lastMessageAt: at, messageCount: count, updatedAt: new Date() };
    this.byExt.set(`${updated.clientId}:${updated.channel}:${updated.externalConversationId ?? ''}`, updated);
  }
}

class InMemoryMessagesRepo {
  messages: MessageRecord[] = [];
  private counter = 0;
  async findByExternalId(conversationId: string, externalMessageId: string): Promise<MessageRecord | null> {
    return this.messages.find((m) => m.conversationId === conversationId && m.externalMessageId === externalMessageId) ?? null;
  }
  async create(input: Omit<MessageRecord, 'id' | 'createdAt'>): Promise<MessageRecord> {
    this.counter += 1;
    const rec: MessageRecord = { id: `msg-${this.counter}`, createdAt: new Date(), ...input };
    this.messages.push(rec);
    return rec;
  }
  async countByConversation(conversationId: string): Promise<number> {
    return this.messages.filter((m) => m.conversationId === conversationId).length;
  }
}

const makeConnectionsService = (norms: NormalizedMessage[]): ChannelConnectionsService =>
  ({ parseInboundEvent: async () => norms }) as unknown as ChannelConnectionsService;

const buildProcessor = (norms: NormalizedMessage[], repo: InMemoryConnectionsRepo): ChannelsInboundProcessor => {
  const connRepo = repo as unknown as DrizzleChannelConnectionsRepository;
  const convRepo = new InMemoryConversationsRepo() as unknown as DrizzleConversationRepository;
  const msgRepo = new InMemoryMessagesRepo() as unknown as DrizzleMessageRepository;
  const connSvc = makeConnectionsService(norms);
  return new ChannelsInboundProcessor(connRepo, convRepo, msgRepo, connSvc, {} as never);
};

describe('ChannelsInboundProcessor — idempotency (Fase 8d)', () => {
  let repo: InMemoryConnectionsRepo;

  beforeEach(() => {
    repo = new InMemoryConnectionsRepo();
    repo.set(makeConn());
  });

  it('primer inbound: received=1, deduplicated=0', async () => {
    const p = buildProcessor([makeNormalized()], repo);
    const r = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-1', 'raw-1');
    expect(r.received).toBe(1);
    expect(r.deduplicated).toBe(0);
    expect(r.conversationId).toBeDefined();
    expect(r.messageId).toBeDefined();
  });

  it('mismo providerEventId + externalMessageId: deduplicated=true, no crea duplicado', async () => {
    const p = buildProcessor([makeNormalized()], repo);
    const r1 = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-1', 'raw-1');
    expect(r1.received).toBe(1);
    const r2 = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-1', 'raw-1');
    expect(r2.received).toBe(0);
    expect(r2.deduplicated).toBe(1);
    expect(r2.conversationId).toBe(r1.conversationId);
    expect(r2.messageId).toBe(r1.messageId);
  });

  it('dos mensajes distintos: ambos received, deduplicated=0', async () => {
    const p = buildProcessor(
      [makeNormalized({ externalMessageId: 'ext-msg-A', providerEventId: 'evt-A' }), makeNormalized({ externalMessageId: 'ext-msg-B', providerEventId: 'evt-B' })],
      repo,
    );
    const r = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-batch', 'raw-batch');
    expect(r.received).toBe(2);
    expect(r.deduplicated).toBe(0);
  });

  it('segundo inbound mismo conv+msg: retorna conversationId+messageId del mensaje dedupeado', async () => {
    const p = buildProcessor([makeNormalized()], repo);
    const r1 = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-1', 'raw-1');
    const r2 = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-1', 'raw-1');
    expect(r2.conversationId).toBe(r1.conversationId);
    expect(r2.messageId).toBe(r1.messageId);
  });

  it('mismo externalConversationId pero externalMessageId nuevo: misma conversation (en el repo)', async () => {
    const p1 = buildProcessor([makeNormalized({ externalMessageId: 'ext-msg-A', providerEventId: 'evt-A' })], repo);
    const r1 = await p1.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-A', 'raw-A');
    const p2 = buildProcessor([makeNormalized({ externalMessageId: 'ext-msg-B', providerEventId: 'evt-B' })], repo);
    const r2 = await p2.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-B', 'raw-B');
    expect(r1.conversationId).toBe(r2.conversationId);
    expect(r1.received).toBe(1);
    expect(r2.received).toBe(1);
    expect(r2.deduplicated).toBe(0);
  });

  it('conexión archivada: retorna received=0, deduplicated=0', async () => {
    const archivedRepo = new InMemoryConnectionsRepo();
    archivedRepo.set(makeConn({ archivedAt: new Date() }));
    const p = buildProcessor([makeNormalized()], archivedRepo);
    const r = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-1', 'raw-1');
    expect(r.received).toBe(0);
    expect(r.deduplicated).toBe(0);
  });

  it('channel mismatch: se ignora el mensaje', async () => {
    const p = buildProcessor([makeNormalized({ channel: 'TELEGRAM' })], repo);
    const r = await p.processInbound('conn-1', 'agent-1', 'WHATSAPP', {}, 'evt-1', 'raw-1');
    expect(r.received).toBe(0);
    expect(r.deduplicated).toBe(0);
  });
});
