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

const PLATFORM_ID = 'f0000001-0000-4000-8000-000000000001';
const DIST_A = 'f0000001-0000-4000-8000-0000000000a1';
const CLIENT_A1 = 'f0000001-0000-4000-8000-0000000000c1';
const DIST_A_OWNER = '22222222-2222-4000-8000-000000000002';
const AGENT_PUB = 'a0000002-0000-4000-8000-000000000001';
const WID = 'wgt_a000000200004000';

const widgetPost = (app: INestApplication, body: unknown): request.Test =>
  request(app.getHttpServer()).post(`/api/v1/widget/${WID}/chat`).send(body as object);

const widgetGet = (app: INestApplication): request.Test =>
  request(app.getHttpServer()).get(`/api/v1/widget/${WID}/config`);

const agentRow = async (db: Database, id: string): Promise<{ publicWidgetId: string | null } | null> => {
  const rows = await db.execute<{ public_widget_id: string | null }>(
    sql`select public_widget_id from public.agents where id = ${id}::uuid`,
  );
  const r = (rows as unknown as Array<{ public_widget_id: string | null }>)[0];
  return r === undefined ? null : { publicWidgetId: r.public_widget_id };
};

describe('Widget e2e', () => {
  let app: INestApplication | null = null;
  let db: Database | null = null;
  let seedAvailable = false;
  let userToken = '';

  beforeAll(async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-min-32-chars-aaaaaaaaaaaa';
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? 'saasplatform-ainnet';
    process.env.MODEL_PROVIDER = 'mock';

    let cfg: ReturnType<typeof loadIdentityConfig>;
    try {
      cfg = loadIdentityConfig({
        AUTH_SECRET: process.env.AUTH_SECRET,
        AUTH_ISSUER: process.env.AUTH_ISSUER,
      } as unknown as NodeJS.ProcessEnv);
    } catch (err) {
      console.warn('Auth config no inicializable; saltando Fase 5 tests.', err);
      return;
    }

    userToken = await signAccessToken(
      {
        userId: DIST_A_OWNER,
        platformId: PLATFORM_ID,
        distributorId: DIST_A,
        clientId: CLIENT_A1,
        roles: ['distributor_owner'],
        permissions: ['agents:read', 'agents:write', 'knowledge_bases:read', 'knowledge_bases:write', 'conversations:read', 'conversations:write', 'chat:write'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );

    try {
      db = createDatabase();
      await db.execute(sql`select 1 as ok`);
      const a = await agentRow(db, AGENT_PUB);
      seedAvailable = a !== null && a.publicWidgetId === WID;
      if (!seedAvailable) {
        console.warn('Seed Fase 5 no disponible en este backend (D-F1-003). Se saltan los tests.');
        return;
      }
    } catch (err) {
      console.warn('DB no accesible; saltando Fase 5 tests.', err);
      return;
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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

  it('GET /widget/:id/config 200 (no auth)', async () => {
    if (!app || !seedAvailable) return;
    const res = await widgetGet(app);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ publicWidgetId: WID, agentId: AGENT_PUB });
    expect(typeof res.body.welcomeMessage).toBe('string');
  });

  it('GET /widget/:id/config 404 para widgetId desconocido', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer()).get('/api/v1/widget/wgt_does_not_exist/config');
    expect(res.status).toBe(404);
  });

  it('POST /widget/:id/chat 201 crea conversacion y persiste IN/OUT', async () => {
    if (!app || !seedAvailable) return;
    const res = await widgetPost(app, { content: 'Hola, ¿qué puedes hacer?' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ agentId: AGENT_PUB, channel: 'widget' });
    expect(res.body.message.direction).toBe('OUTBOUND');
    expect(typeof res.body.message.content).toBe('string');
    expect(res.body.conversation.id).toBeDefined();
  });

  it('POST /widget/:id/chat 400 cuando content vacío', async () => {
    if (!app || !seedAvailable) return;
    const res = await widgetPost(app, { content: '' });
    expect(res.status).toBe(400);
  });

  it('POST /widget/:id/chat 400 cuando content >2000 chars', async () => {
    if (!app || !seedAvailable) return;
    const res = await widgetPost(app, { content: 'x'.repeat(2001) });
    expect(res.status).toBe(400);
  });

  it('POST /widget/:id/chat 404 con widgetId inexistente', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/widget/wgt_does_not_exist/chat')
      .send({ content: 'hola' });
    expect(res.status).toBe(404);
  });

  it('POST /widget/:id/chat con conversationExternalId reusa la conversacion', async () => {
    if (!app || !seedAvailable) return;
    const ext = `ext-${Date.now()}`;
    const a = await widgetPost(app, { content: 'primero', conversationExternalId: ext });
    expect(a.status).toBe(201);
    const b = await widgetPost(app, { content: 'segundo', conversationExternalId: ext });
    expect(b.status).toBe(201);
    expect(b.body.conversation.id).toBe(a.body.conversation.id);
  });

  it('POST /conversations/:id/reply 201 (humano)', async () => {
    if (!app || !seedAvailable) return;
    const w = await widgetPost(app, { content: 'cliente pregunta' });
    expect(w.status).toBe(201);
    const convId = w.body.conversation.id;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/reply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'respuesta humana' });
    expect(res.status).toBe(201);
    expect(res.body.message.role).toBe('ASSISTANT');
    expect(res.body.message.metadata).toMatchObject({ source: 'human' });
  });

  it('POST /conversations/:id/reply 400 cuando ya está CLOSED', async () => {
    if (!app || !seedAvailable) return;
    const w = await widgetPost(app, { content: 'cliente' });
    const convId = w.body.conversation.id;
    const close = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/close`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(close.status).toBe(201);
    const rep = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/reply`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({ content: 'tarde' });
    expect(rep.status).toBe(400);
  });

  it('POST /conversations/:id/close 201 y deja state=CLOSED', async () => {
    if (!app || !seedAvailable) return;
    const w = await widgetPost(app, { content: 'cliente' });
    const convId = w.body.conversation.id;
    const res = await request(app.getHttpServer())
      .post(`/api/v1/conversations/${convId}/close`)
      .set('Authorization', `Bearer ${userToken}`)
      .send();
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('CLOSED');
    expect(res.body.closedAt).not.toBeNull();
  });

  it('GET /conversations lista y GET /conversations/:id/messages', async () => {
    if (!app || !seedAvailable) return;
    const w = await widgetPost(app, { content: 'listame' });
    const list = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.items)).toBe(true);
    const msgs = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${w.body.conversation.id}/messages`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(msgs.status).toBe(200);
    expect(msgs.body.items.length).toBeGreaterThan(0);
    const last = msgs.body.items[msgs.body.items.length - 1];
    expect(['INBOUND', 'OUTBOUND']).toContain(last.direction);
  });

  it('GET /conversations 401 sin auth', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer()).get('/api/v1/conversations');
    expect(res.status).toBe(401);
  });
});
