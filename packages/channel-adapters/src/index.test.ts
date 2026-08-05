import { describe, it, expect } from 'vitest';
import { MockWhatsappAdapter, InMemoryMockWhatsappStorage, buildDefaultRegistry, ChannelAdapterRegistry } from './index.js';

const makeInbound = (payload: unknown, providerEventId = 'evt_1'): { providerEventId: string; payload: unknown; channelConnectionId: string; channel: 'WHATSAPP'; rawPayloadReference: string } => ({
  providerEventId,
  payload,
  channelConnectionId: 'cc_1',
  channel: 'WHATSAPP',
  rawPayloadReference: 'raw_1',
});

describe('MockWhatsappAdapter', () => {
  it('verifyConnection CONNECTED con credenciales válidas', async () => {
    const a = new MockWhatsappAdapter();
    const s = await a.verifyConnection({
      channelConnectionId: 'cc_1',
      credentials: { api_key: 'k'.repeat(16), phone_number_id: 'pn_1' },
    });
    expect(s.state).toBe('CONNECTED');
  });

  it('verifyConnection ERROR con api_key corta', async () => {
    const a = new MockWhatsappAdapter();
    const s = await a.verifyConnection({
      channelConnectionId: 'cc_1',
      credentials: { api_key: 'short', phone_number_id: 'pn_1' },
    });
    expect(s.state).toBe('ERROR');
  });

  it('parseInboundEvent extrae mensajes de texto', async () => {
    const a = new MockWhatsappAdapter();
    const out = await a.parseInboundEvent(
      makeInbound({
        entry: [
          {
            changes: [
              {
                value: {
                  contacts: [{ wa_id: '+15555550100', profile: { name: 'Alice' } }],
                  messages: [{ id: 'wamid_1', from: '+15555550100', timestamp: '1700000000', type: 'text', text: { body: 'hola' } }],
                },
              },
            ],
          },
        ],
      }),
    );
    expect(out.length).toBe(1);
    expect(out[0]?.direction).toBe('INBOUND');
    expect(out[0]?.text).toBe('hola');
    expect(out[0]?.sender.displayName).toBe('Alice');
    expect(out[0]?.externalConversationId).toBe('+15555550100');
  });

  it('parseInboundEvent con payload vacío retorna []', async () => {
    const a = new MockWhatsappAdapter();
    const out = await a.parseInboundEvent(makeInbound({}));
    expect(out).toEqual([]);
  });

  it('sendMessage devuelve providerMessageId wamid_... y status CONNECTED', async () => {
    const a = new MockWhatsappAdapter();
    const r = await a.sendMessage({
      channelConnectionId: 'cc_1',
      conversationExternalId: '+15555550100',
      recipient: { externalId: '+15555550100', displayName: null, phone: '+15555550100', email: null },
      text: 'hola',
    });
    expect(r.providerMessageId).toMatch(/^wamid_[0-9a-f]{24}$/);
    expect(r.status).toBe('CONNECTED');
  });

  it('sendMessage con failNextSend lanza error', async () => {
    const store = new InMemoryMockWhatsappStorage();
    const a = new MockWhatsappAdapter(store);
    store.failNextSend('RATE_LIMIT', 'too fast');
    await expect(
      a.sendMessage({
        channelConnectionId: 'cc_1',
        conversationExternalId: 'x',
        recipient: { externalId: 'x', displayName: null, phone: 'x', email: null },
        text: 'hi',
      }),
    ).rejects.toThrow(/RATE_LIMIT/);
  });

  it('getDeliveryStatus refleja transiciones de estado', async () => {
    const store = new InMemoryMockWhatsappStorage();
    const a = new MockWhatsappAdapter(store);
    const sent = await a.sendMessage({
      channelConnectionId: 'cc_1',
      conversationExternalId: 'x',
      recipient: { externalId: 'x', displayName: null, phone: 'x', email: null },
      text: 'hi',
    });
    const before = await a.getDeliveryStatus({ channelConnectionId: 'cc_1', providerMessageId: sent.providerMessageId });
    expect(before.status).toBe('SENT');
    store.setStatus(sent.providerMessageId, { status: 'DELIVERED' });
    const after = await a.getDeliveryStatus({ channelConnectionId: 'cc_1', providerMessageId: sent.providerMessageId });
    expect(after.status).toBe('DELIVERED');
    store.setStatus(sent.providerMessageId, { status: 'READ' });
    const final = await a.getDeliveryStatus({ channelConnectionId: 'cc_1', providerMessageId: sent.providerMessageId });
    expect(final.status).toBe('READ');
  });

  it('downloadMedia devuelve placeholder', async () => {
    const a = new MockWhatsappAdapter();
    const m = await a.downloadMedia({ providerMediaId: 'mid', channelConnectionId: 'cc_1' });
    expect(m.sizeBytes).toBe(0);
  });
});

describe('ChannelAdapterRegistry', () => {
  it('buildDefaultRegistry incluye WHATSAPP', () => {
    const r = buildDefaultRegistry();
    expect(r.has('WHATSAPP')).toBe(true);
    expect(r.get('WHATSAPP').channel).toBe('WHATSAPP');
  });

  it('get lanza para canal no registrado', () => {
    const r = new ChannelAdapterRegistry();
    expect(() => r.get('TELEGRAM')).toThrow();
  });

  it('list devuelve canales registrados', () => {
    const r = buildDefaultRegistry();
    expect(r.list()).toEqual(['WHATSAPP']);
  });
});
