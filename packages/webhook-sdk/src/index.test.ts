import { describe, it, expect } from 'vitest';
import {
  signBody,
  verifySignature,
  computeNextRetry,
  HttpWebhookDispatcher,
  type HttpDeliveryClient,
  type HttpDeliveryRequest,
  type HttpDeliveryResponse,
} from './index.js';

const makePayload = (overrides: Partial<{ eventId: string; eventType: 'agent.published'; clientId: string }> = {}) => ({
  eventId: overrides.eventId ?? 'evt_1',
  eventType: overrides.eventType ?? 'agent.published',
  occurredAt: '2026-01-01T00:00:00.000Z',
  platformId: 'p_1',
  clientId: overrides.clientId ?? 'c_1',
  apiVersion: 'v1',
  data: { agentId: 'a_1' },
});

describe('webhook-sdk', () => {
  it('signBody produce HMAC determinista', () => {
    const a = signBody('{"hello":"world"}', 'secret-1234567890ab', '1700000000');
    const b = signBody('{"hello":"world"}', 'secret-1234567890ab', '1700000000');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('verifySignature acepta firma correcta', () => {
    const body = '{"event":1}';
    const ts = '1700000001';
    const sig = signBody(body, 'topsecret-1234567890a', ts);
    expect(verifySignature(body, 'topsecret-1234567890a', ts, sig)).toBe(true);
  });

  it('verifySignature rechaza firma manipulada', () => {
    expect(verifySignature('{}', 'topsecret-1234567890a', '1700000001', signBody('{}', 'OTHER-SECRET-1234567890a', '1700000001'))).toBe(false);
    expect(verifySignature('{}', 'topsecret-1234567890a', '1700000001', 'a'.repeat(64))).toBe(false);
  });

  it('computeNextRetry escala exponencialmente y termina en DLQ', () => {
    const a = computeNextRetry(0);
    expect(a.status).toBe('PENDING');
    expect(a.delayMs).toBe(0);
    const b = computeNextRetry(1);
    expect(b.status).toBe('PENDING');
    expect(b.delayMs).toBe(60_000);
    const c = computeNextRetry(5);
    expect(c.status).toBe('PENDING');
    expect(c.delayMs).toBe(12 * 60 * 60_000);
    const d = computeNextRetry(6);
    expect(d.status).toBe('DLQ');
    expect(d.delayMs).toBeNull();
  });

  it('dispatcher DELIVERED con 2xx', async () => {
    const seen: HttpDeliveryRequest[] = [];
    const client: HttpDeliveryClient = {
      post: async (req): Promise<HttpDeliveryResponse> => {
        seen.push(req);
        return { statusCode: 200, body: 'ok' };
      },
    };
    const d = new HttpWebhookDispatcher(client);
    const r = await d.dispatch({
      endpointId: 'ep_1',
      url: 'https://n8n.example/hook',
      secret: 's'.repeat(32),
      payload: makePayload(),
      attempt: 1,
    });
    expect(r.status).toBe('DELIVERED');
    expect(r.httpStatus).toBe(200);
    expect(seen[0]?.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(seen[0]?.eventId).toBe('evt_1');
  });

  it('dispatcher RETRY con 5xx', async () => {
    const client: HttpDeliveryClient = { post: async () => ({ statusCode: 502, body: 'bad gw' }) };
    const d = new HttpWebhookDispatcher(client);
    const r = await d.dispatch({
      endpointId: 'ep_1', url: 'x', secret: 's'.repeat(32), payload: makePayload(), attempt: 1,
    });
    expect(r.status).toBe('RETRY');
    expect(r.httpStatus).toBe(502);
  });

  it('dispatcher DLQ con 410 (gone)', async () => {
    const client: HttpDeliveryClient = { post: async () => ({ statusCode: 410, body: 'gone' }) };
    const d = new HttpWebhookDispatcher(client);
    const r = await d.dispatch({
      endpointId: 'ep_1', url: 'x', secret: 's'.repeat(32), payload: makePayload(), attempt: 1,
    });
    expect(r.status).toBe('DLQ');
  });

  it('dispatcher RETRY cuando fetch lanza (red)', async () => {
    const client: HttpDeliveryClient = { post: async () => { throw new Error('ECONNREFUSED'); } };
    const d = new HttpWebhookDispatcher(client);
    const r = await d.dispatch({
      endpointId: 'ep_1', url: 'x', secret: 's'.repeat(32), payload: makePayload(), attempt: 1,
    });
    expect(r.status).toBe('RETRY');
    expect(r.error).toBe('ECONNREFUSED');
  });
});
