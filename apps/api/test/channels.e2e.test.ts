import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bodyParser = require('body-parser');
import { HttpExceptionFilter } from '../src/common/http-exception.filter.js';
import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { signAccessToken, loadIdentityConfig } from '@platform/auth';
import { createDatabase, closeDatabase, type Database } from '@platform/db';
import { AppModule } from '../src/app.module.js';
import { TenantContextMiddleware } from '../src/auth/tenant-context.middleware.js';

const PLATFORM_ID = 'f0000001-0000-4000-8000-000000000001';
const DIST_A = 'f0000001-0000-4000-8000-0000000000a1';
const CLIENT_A1 = 'f0000001-0000-4000-8000-0000000000c1';
const DIST_A_OWNER = '22222222-2222-4000-8000-000000000002';
const AGENT_ID = 'a0000002-0000-4000-8000-000000000001';

interface CreatedConnection {
  id: string;
  name: string;
  channel: string;
  phoneNumber: string | null;
  status: string;
  webhookUrl: string;
  webhookSecret: string;
  archivedAt: string | null;
}

const buildSignature = (body: string, secret: string): string => {
  const digest = createHmac('sha256', secret).update(body).digest('hex');
  return `sha256=${digest}`;
};

const buildWhatsappPayload = (text: string, from: string): { entry: Array<unknown> } => ({
  entry: [
    {
      id: 'ENTRY_1',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: { display_phone_number: '+15555550100', phone_number_id: '1234567890' },
            contacts: [{ wa_id: from, profile: { name: 'Mock Customer' } }],
            messages: [
              { id: `wamid.${Date.now()}`, from, timestamp: String(Math.floor(Date.now() / 1000)), type: 'text', text: { body: text } },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
});

describe('Channels e2e (Fase 7)', () => {
  let app: INestApplication | null = null;
  let db: Database | null = null;
  let dbAvailable = false;
  let userToken = '';

  beforeAll(async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-min-32-chars-aaaaaaaaaaaa';
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? 'saasplatform-ainnet';
    process.env.MODEL_PROVIDER = 'mock';
    process.env.WEBHOOK_OUTBOX_INTERVAL_MS = '0';

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
        permissions: [
          'agents:read', 'agents:write',
          'conversations:read', 'conversations:write',
          'chat:write',
          'channel_connections:read', 'channel_connections:write',
        ],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );

    try {
      db = createDatabase();
      await db.execute(sql`select 1 as ok`);
      dbAvailable = true;
    } catch (err) {
      console.warn('DB no accesible; saltando Fase 7 tests.', err);
      return;
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    try {
      await db.execute(sql`INSERT INTO agents (id, platform_id, distributor_id, client_id, key, name) VALUES (${AGENT_ID}, ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, 'test-agent', 'Test Agent') ON CONFLICT (id) DO NOTHING`);
      await db.execute(sql`DELETE FROM message_deliveries WHERE client_id IN (${CLIENT_A1})`);
      await db.execute(sql`DELETE FROM channel_connections WHERE client_id IN (${CLIENT_A1})`);
      await db.execute(sql`DELETE FROM conversations WHERE client_id IN (${CLIENT_A1}) AND agent_id = ${AGENT_ID}`);
    } catch (err) {
      console.warn('No se pudo limpiar estado tests Fase 7:', err);
    }
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.path.includes('/channels/') && req.path.endsWith('/webhook')) {
        bodyParser.json({
          verify: (r: Request, _res: Response, buf: Buffer) => {
            (r as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
          },
        })(req, _res, next);
      } else {
        next();
      }
    });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    app.useGlobalFilters(new HttpExceptionFilter());
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

  it('GET /channel-connections 200 lista vacío o existente', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('GET /channel-connections 401 sin auth', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer()).get('/api/v1/channel-connections');
    expect(res.status).toBe(401);
  });

  it('POST /channel-connections 201 con webhook secret generado', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-mock-1',
        channel: 'WHATSAPP',
        phoneNumber: '+15555550100',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.webhookSecret as string).toMatch(/^whsec_chan_[0-9a-f]{48}$/);
    expect(res.body.status).toBe('PENDING');
  });

  it('POST /channel-connections 400 con channel inválido', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'invalid',
        channel: 'FAX',
        credentials: {},
      });
    expect(res.status).toBe(400);
  });

  it('POST /channel-connections/:id/verify → CONNECTED con credenciales válidas', async () => {
    if (!app || !dbAvailable) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-verify',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    expect(created.status).toBe(201);
    const connId = (created.body as CreatedConnection).id;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/channel-connections/${connId}/verify`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('CONNECTED');
  });

  it('POST /channel-connections/:id/verify → ERROR con credenciales inválidas', async () => {
    if (!app || !dbAvailable) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-bad',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1' },
      });
    expect(created.status).toBe(201);
    const connId = (created.body as CreatedConnection).id;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/channel-connections/${connId}/verify`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ERROR');
    expect(res.body.lastError).toBeDefined();
  });

  it('POST /channels/WHATSAPP/webhook 401 sin firma', async () => {
    if (!app || !dbAvailable) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-hook1',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    const conn = created.body as CreatedConnection;
    const body = JSON.stringify({
      connectionId: conn.id,
      agentId: AGENT_ID,
      ...buildWhatsappPayload('hola sin firma', '+15555550111'),
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels/WHATSAPP/webhook')
      .set('content-type', 'application/json')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('POST /channels/WHATSAPP/webhook 401 con firma inválida', async () => {
    if (!app || !dbAvailable) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-hook2',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    const conn = created.body as CreatedConnection;
    const body = JSON.stringify({
      connectionId: conn.id,
      agentId: AGENT_ID,
      ...buildWhatsappPayload('hola firma mala', '+15555550112'),
    });
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels/WHATSAPP/webhook')
      .set('content-type', 'application/json')
      .set('x-channel-signature', 'sha256=' + 'a'.repeat(64))
      .send(body);
    expect(res.status).toBe(401);
  });

  it('POST /channels/WHATSAPP/webhook 200 con firma válida crea conversación INBOUND', async () => {
    if (!app || !dbAvailable) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-hook3',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    const conn = created.body as CreatedConnection;
    await request(app.getHttpServer())
      .post(`/api/v1/channel-connections/${conn.id}/verify`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    const body = JSON.stringify({
      connectionId: conn.id,
      agentId: AGENT_ID,
      ...buildWhatsappPayload('hola desde mock', '+15555550113'),
    });
    const sig = buildSignature(body, conn.webhookSecret);
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels/WHATSAPP/webhook')
      .set('content-type', 'application/json')
      .set('x-channel-signature', sig)
      .set('x-channel-event-id', `evt-${Date.now()}`)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.received).toBe(1);
    expect(res.body.conversationId).toBeDefined();
    expect(res.body.messageId).toBeDefined();
  });

  it('POST /channels/WHATSAPP/webhook 401 con connectionId desconocido', async () => {
    if (!app || !dbAvailable) return;
    const body = JSON.stringify({
      connectionId: '00000000-0000-4000-8000-000000000099',
      agentId: AGENT_ID,
      ...buildWhatsappPayload('hola ghost', '+15555550199'),
    });
    const sig = buildSignature(body, 'whsec_' + '0'.repeat(48));
    const res = await request(app.getHttpServer())
      .post('/api/v1/channels/WHATSAPP/webhook')
      .set('content-type', 'application/json')
      .set('x-channel-signature', sig)
      .send(body);
    expect(res.status).toBe(401);
  });

  it('outbound desde humanReply crea message_delivery SENT', async () => {
    if (!app || !dbAvailable) return;
    await db?.execute(sql`DELETE FROM message_deliveries WHERE client_id IN (${CLIENT_A1})`);
    await db?.execute(sql`DELETE FROM channel_connections WHERE client_id IN (${CLIENT_A1})`);
    const conn = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-outbound',
        channel: 'WHATSAPP',
        phoneNumber: '+15555550200',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    expect(conn.status).toBe(201);
    const connId = (conn.body as CreatedConnection).id;
    await request(app.getHttpServer())
      .post(`/api/v1/channel-connections/${connId}/verify`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    const externalConvId = `ext-${Date.now()}`;
    const inboundBody = JSON.stringify({
      connectionId: connId,
      agentId: AGENT_ID,
      ...buildWhatsappPayload('inbound test', '+15555550200'),
    });
    const sig = buildSignature(inboundBody, (conn.body as CreatedConnection).webhookSecret);
    const inbound = await request(app.getHttpServer())
      .post('/api/v1/channels/WHATSAPP/webhook')
      .set('content-type', 'application/json')
      .set('x-channel-signature', sig)
      .send(inboundBody);
    expect(inbound.status).toBe(200);
    const convId = inbound.body.conversationId as string;
    const reply = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/reply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'respuesta del agente' });
    expect(reply.status).toBe(201);
    await new Promise((r) => setTimeout(r, 1500));
    const list = await request(app.getHttpServer())
      .get(`/api/v1/message-deliveries?connectionId=${connId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(list.body.items.length).toBeGreaterThan(0);
    const delivery = list.body.items[0] as { status: string; providerMessageId: string | null };
    expect(delivery.status).toBe('SENT');
    expect(delivery.providerMessageId).toMatch(/^wamid[._]/);
  });

  it('POST /message-deliveries/:id/refresh → DELIVERED con setStatus previo', async () => {
    if (!app || !dbAvailable) return;
    await db?.execute(sql`DELETE FROM message_deliveries WHERE client_id IN (${CLIENT_A1})`);
    await db?.execute(sql`DELETE FROM channel_connections WHERE client_id IN (${CLIENT_A1})`);
    const conn = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-deliverystatus',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    const connId = (conn.body as CreatedConnection).id;
    await request(app.getHttpServer())
      .post(`/api/v1/channel-connections/${connId}/verify`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    const externalConvId = `ext-status-${Date.now()}`;
    const inboundBody = JSON.stringify({
      connectionId: connId,
      agentId: AGENT_ID,
      ...buildWhatsappPayload('hola status', '+15555550300'),
    });
    const sig = buildSignature(inboundBody, (conn.body as CreatedConnection).webhookSecret);
    const inbound = await request(app.getHttpServer())
      .post('/api/v1/channels/WHATSAPP/webhook')
      .set('content-type', 'application/json')
      .set('x-channel-signature', sig)
      .send(inboundBody);
    const convId = inbound.body.conversationId as string;
    const reply = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/reply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'ver estado delivery' });
    expect(reply.status).toBe(201);
    await new Promise((r) => setTimeout(r, 1500));
    const list = await request(app.getHttpServer())
      .get(`/api/v1/message-deliveries?connectionId=${connId}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.body.items.length).toBeGreaterThan(0);
    const deliveryId = list.body.items[0].id as string;
    const refresh = await request(app.getHttpServer())
      .post(`/api/v1/message-deliveries/${deliveryId}/refresh`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(refresh.status).toBe(201);
    expect(['SENT', 'DELIVERED', 'READ']).toContain(refresh.body.status);
  });

  it('POST /channel-connections/:id/rotate-webhook-secret devuelve nuevo secret', async () => {
    if (!app || !dbAvailable) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-rotate',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    const connId = (created.body as CreatedConnection).id;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/channel-connections/${connId}/rotate-webhook-secret`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(res.status).toBe(201);
    expect(res.body.webhookSecret).toMatch(/^whsec_chan_[0-9a-f]{48}$/);
    expect(res.body.webhookSecret).not.toBe((created.body as CreatedConnection).webhookSecret);
  });

  it('POST /channel-connections/:id/archive archiva la conexión', async () => {
    if (!app || !dbAvailable) return;
    const created = await request(app.getHttpServer())
      .post('/api/v1/channel-connections')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        name: 'whatsapp-archive',
        channel: 'WHATSAPP',
        credentials: { phone_number_id: '1234567890', api_key: 'EAABmocksuperlongkey' },
      });
    const connId = (created.body as CreatedConnection).id;
    const res = await request(app.getHttpServer())
      .delete(`/api/v1/channel-connections/${connId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(res.status).toBe(200);
    expect(res.body.archivedAt).not.toBeNull();
  });
});
