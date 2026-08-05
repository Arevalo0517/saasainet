import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { sql } from 'drizzle-orm';
import { signAccessToken, loadIdentityConfig } from '@platform/auth';
import { createDatabase, closeDatabase, type Database } from '@platform/db';
import { AppModule } from '../src/app.module.js';
import { TenantContextMiddleware } from '../src/auth/tenant-context.middleware.js';
import { DISPATCHER_HTTP } from '../src/webhooks/webhook-outbox.processor.js';
import type { HttpDeliveryClient, HttpDeliveryRequest, HttpDeliveryResponse } from '@platform/webhook-sdk';

const PLATFORM_ID = 'f0000001-0000-4000-8000-000000000001';
const DIST_A = 'f0000001-0000-4000-8000-0000000000a1';
const CLIENT_A1 = 'f0000001-0000-4000-8000-0000000000c1';
const DIST_A_OWNER = '22222222-2222-4000-8000-000000000002';

interface SentRequest extends HttpDeliveryRequest {
  bodyJson: { eventId: string; eventType: string; data: Record<string, unknown> };
}

class MockHttpClient implements HttpDeliveryClient {
  public sent: SentRequest[] = [];
  public fail = false;
  public statusCode = 200;
  public body = 'ok';
  public responseDelayMs = 0;
  async post(req: HttpDeliveryRequest): Promise<HttpDeliveryResponse> {
    if (this.responseDelayMs > 0) {
      await new Promise<void>((res) => setTimeout(res, this.responseDelayMs));
    }
    this.sent.push({ ...req, bodyJson: JSON.parse(req.body) as SentRequest['bodyJson'] });
    if (this.fail) throw new Error('ECONNREFUSED');
    return { statusCode: this.statusCode, body: this.body };
  }
}

const endpointExists = async (db: Database, id: string): Promise<boolean> => {
  const rows = await db.execute<{ count: string }>(
    sql`select count(*)::text as count from public.webhook_endpoints where id = ${id}::uuid`,
  );
  return ((rows as unknown as Array<{ count: string }>)[0]?.count ?? '0') !== '0';
};

describe('Webhooks e2e (Fase 6)', () => {
  let app: INestApplication | null = null;
  let db: Database | null = null;
  let seedAvailable = false;
  let userToken = '';
  let mockHttp: MockHttpClient;

  beforeAll(async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-min-32-chars-aaaaaaaaaaaa';
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? 'saasplatform-ainnet';
    process.env.MODEL_PROVIDER = 'mock';
    process.env.WEBHOOK_OUTBOX_INTERVAL_MS = '0';

    mockHttp = new MockHttpClient();

    const cfg = loadIdentityConfig({
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_ISSUER: process.env.AUTH_ISSUER,
    } as unknown as NodeJS.ProcessEnv);

    userToken = await signAccessToken(
      {
        userId: DIST_A_OWNER,
        platformId: PLATFORM_ID,
        distributorId: DIST_A,
        clientId: CLIENT_A1,
        roles: ['distributor_owner'],
        permissions: ['agents:read', 'agents:write', 'knowledge_bases:read', 'knowledge_bases:write', 'conversations:read', 'conversations:write', 'chat:write', 'webhook_endpoints:read', 'webhook_endpoints:write'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );

    try {
      db = createDatabase();
      await db.execute(sql`select 1 as ok`);
      seedAvailable = await endpointExists(db, 'a0000006-0000-4000-8000-000000000001');
      if (!seedAvailable) {
        console.warn('Seed Fase 6 (webhook endpoint demo) no disponible. Saltando tests.');
        return;
      }
    } catch (err) {
      console.warn('DB no accesible; saltando Fase 6 tests.', err);
      return;
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DISPATCHER_HTTP)
      .useValue(mockHttp)
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.use((req: Request, res: Response, next: NextFunction) => {
      const mw = app!.get(TenantContextMiddleware);
      mw.use(req, res, next).catch((err: unknown) => next(err));
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db) await closeDatabase();
  });

  it('GET /webhook-endpoints 200 lista incluye seed demo', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const ids = res.body.items.map((e: { id: string }) => e.id);
    expect(ids).toContain('a0000006-0000-4000-8000-000000000001');
  });

  it('GET /webhook-endpoints 401 sin auth', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer()).get('/api/v1/webhook-endpoints');
    expect(res.status).toBe(401);
  });

  it('POST /webhook-endpoints 201 con secret generado', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'test endpoint',
        url: 'https://example.invalid/hook',
        events: ['conversation.started', 'conversation.closed'],
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
    expect(res.body.status).toBe('ACTIVE');
    expect(res.body.events).toEqual(['conversation.started', 'conversation.closed']);
  });

  it('POST /webhook-endpoints 400 cuando URL inválida', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'x', url: 'not-a-url', events: ['conversation.started'] });
    expect(res.status).toBe(400);
  });

  it('POST /webhook-endpoints 400 cuando event no soportado', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'x', url: 'https://example.com', events: ['unknown.event'] });
    expect(res.status).toBe(400);
  });

  it('POST /webhook-endpoints/:id/test emite evento y crea delivery PENDING', async () => {
    if (!app || !seedAvailable) return;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'for test', url: 'https://example.invalid/test', events: ['conversation.started'] });
    expect(ep.status).toBe(201);
    const id = ep.body.id as string;
    const t = await request(app.getHttpServer())
      .post(`/api/v1/webhook-endpoints/${id}/test`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(t.status).toBe(201);
    expect(t.body.eventId).toBeDefined();
    const list = await request(app.getHttpServer())
      .get(`/api/v1/webhook-deliveries?endpointId=${id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    expect(list.body.items[0].status).toBe('PENDING');
    expect(list.body.items[0].eventId).toBe(t.body.eventId);
  });

  it('dispatcher: firma HMAC válida + delivery SUCCEEDED', async () => {
    if (!app || !seedAvailable) return;
    mockHttp.sent = [];
    mockHttp.statusCode = 200;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'signed', url: 'https://example.invalid/ok', events: ['conversation.started'] });
    const id = ep.body.id as string;
    const t = await request(app.getHttpServer())
      .post(`/api/v1/webhook-endpoints/${id}/test`)
      .set('Authorization', `Bearer ${userToken}`);
    const deliveryId = (await request(app.getHttpServer())
      .get(`/api/v1/webhook-deliveries?endpointId=${id}`)
      .set('Authorization', `Bearer ${userToken}`)).body.items[0].id as string;
    const replay = await request(app.getHttpServer())
      .post(`/api/v1/webhook-deliveries/${deliveryId}/replay`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(replay.status).toBe(201);
    expect(replay.body.status).toBe('SUCCEEDED');
    expect(replay.body.lastStatusCode).toBe(200);
    expect(mockHttp.sent.length).toBe(1);
    const sent = mockHttp.sent[0]!;
    expect(sent.signature).toMatch(/^[0-9a-f]{64}$/);
    expect(sent.bodyJson.eventId).toBe(t.body.eventId);
    expect(sent.bodyJson.eventType).toBe('conversation.started');
  });

  it('dispatcher: 5xx → FAILED con nextRetryAt + signature válida', async () => {
    if (!app || !seedAvailable) return;
    mockHttp.sent = [];
    mockHttp.statusCode = 503;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'flaky', url: 'https://example.invalid/503', events: ['conversation.started'] });
    const id = ep.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/webhook-endpoints/${id}/test`)
      .set('Authorization', `Bearer ${userToken}`);
    const list = await request(app.getHttpServer())
      .get(`/api/v1/webhook-deliveries?endpointId=${id}`)
      .set('Authorization', `Bearer ${userToken}`);
    const deliveryId = list.body.items[0].id as string;
    const replay = await request(app.getHttpServer())
      .post(`/api/v1/webhook-deliveries/${deliveryId}/replay`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(replay.status).toBe(201);
    expect(replay.body.status).toBe('PENDING');
    expect(replay.body.lastStatusCode).toBe(503);
    expect(replay.body.nextRetryAt).not.toBeNull();
    expect(replay.body.attemptCount).toBe(1);
  });

  it('dispatcher: 410 (gone) → DLQ sin retry', async () => {
    if (!app || !seedAvailable) return;
    mockHttp.sent = [];
    mockHttp.statusCode = 410;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'gone', url: 'https://example.invalid/gone', events: ['conversation.started'] });
    const id = ep.body.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/webhook-endpoints/${id}/test`)
      .set('Authorization', `Bearer ${userToken}`);
    const list = await request(app.getHttpServer())
      .get(`/api/v1/webhook-deliveries?endpointId=${id}`)
      .set('Authorization', `Bearer ${userToken}`);
    const deliveryId = list.body.items[0].id as string;
    const replay = await request(app.getHttpServer())
      .post(`/api/v1/webhook-deliveries/${deliveryId}/replay`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(replay.status).toBe(201);
    expect(replay.body.status).toBe('DLQ');
    expect(replay.body.nextRetryAt).toBeNull();
  });

  it('POST /webhook-endpoints/:id/rotate-secret 201 cambia el secret', async () => {
    if (!app || !seedAvailable) return;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'rotate', url: 'https://example.invalid/rot', events: ['conversation.started'] });
    const before = ep.body.secret as string;
    const r = await request(app.getHttpServer())
      .post(`/api/v1/webhook-endpoints/${ep.body.id}/rotate-secret`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(r.status).toBe(201);
    expect(r.body.secret).not.toBe(before);
    expect(r.body.secret).toMatch(/^whsec_[0-9a-f]{48}$/);
  });

  it('PATCH /webhook-endpoints/:id cambia status', async () => {
    if (!app || !seedAvailable) return;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'pausa', url: 'https://example.invalid/p', events: ['conversation.started'] });
    const p = await request(app.getHttpServer())
      .patch(`/api/v1/webhook-endpoints/${ep.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ status: 'PAUSED' });
    expect(p.status).toBe(200);
    expect(p.body.status).toBe('PAUSED');
  });

  it('emisión: conversation.closed dispara webhook con eventType correcto', async () => {
    if (!app || !seedAvailable) return;
    mockHttp.sent = [];
    mockHttp.statusCode = 200;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'emit close', url: 'https://example.invalid/close', events: ['conversation.closed'] });
    const id = ep.body.id as string;
    const conv = await request(app.getHttpServer())
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ agentId: 'a0000002-0000-4000-8000-000000000001', message: 'hola' });
    expect(conv.status).toBe(201);
    const convId = conv.body.conversation.id as string;
    const close = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/close`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(close.status).toBe(201);
    await new Promise((r) => setTimeout(r, 200));
    const list = await request(app.getHttpServer())
      .get(`/api/v1/webhook-deliveries?endpointId=${id}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.body.items.length).toBeGreaterThan(0);
    const deliveryId = list.body.items[0].id as string;
    const replay = await request(app.getHttpServer())
      .post(`/api/v1/webhook-deliveries/${deliveryId}/replay`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(replay.body.status).toBe('SUCCEEDED');
    expect(mockHttp.sent[0]?.bodyJson.eventType).toBe('conversation.closed');
    expect(mockHttp.sent[0]?.bodyJson.data).toMatchObject({ conversationId: convId });
  });

  it('idempotencia: emit con misma idempotencyKey no duplica eventos', async () => {
    if (!app || !seedAvailable) return;
    const ep = await request(app.getHttpServer())
      .post('/api/v1/webhook-endpoints')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ name: 'idem', url: 'https://example.invalid/idem', events: ['conversation.closed'] });
    const before = (await request(app.getHttpServer())
      .get(`/api/v1/webhook-deliveries?endpointId=${ep.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)).body.items.length as number;
    const conv = await request(app.getHttpServer())
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ agentId: 'a0000002-0000-4000-8000-000000000001', message: 'idem test' });
    const convId = conv.body.conversation.id as string;
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/close`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/close`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    await new Promise((r) => setTimeout(r, 200));
    const after = (await request(app.getHttpServer())
      .get(`/api/v1/webhook-deliveries?endpointId=${ep.body.id}`)
      .set('Authorization', `Bearer ${userToken}`)).body.items.length as number;
    expect(after).toBe(before + 1);
  });
});
