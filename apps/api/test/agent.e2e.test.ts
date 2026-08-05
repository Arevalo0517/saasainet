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
const CLIENT_B1 = 'f0000001-0000-4000-8000-0000000000c3';
const DIST_B_OWNER = '33333333-3333-4000-8000-000000000003';
const DIST_A_OWNER = '22222222-2222-4000-8000-000000000002';

const AGENT_SEED = 'a0000002-0000-4000-8000-000000000001';
const KB_SEED = 'a0000002-0000-4000-8000-000000000002';

const expectDbUp = async (db: Database): Promise<void> => {
  await db.execute(sql`select 1 as ok`);
};

const agentExists = async (db: Database, id: string): Promise<boolean> => {
  const rows = await db.execute<{ count: string }>(
    sql`select count(*)::text as count from public.agents where id = ${id}::uuid`,
  );
  const first = (rows as unknown as Array<{ count: string }>)[0];
  return Boolean(first && Number.parseInt(first.count, 10) > 0);
};

describe('AgentModule (Fase 4): agents + KBs + documents + conversations + chat', () => {
  let app: INestApplication;
  let db: Database | null = null;
  let seedAvailable = false;
  let distAOwnerToken = '';
  let distBOwnerToken = '';

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
      console.warn('Auth config no inicializable; saltando Fase 4 tests.', err);
      return;
    }

    distAOwnerToken = await signAccessToken(
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
    distBOwnerToken = await signAccessToken(
      {
        userId: DIST_B_OWNER,
        platformId: PLATFORM_ID,
        distributorId: 'f0000001-0000-4000-8000-0000000000b1',
        clientId: 'f0000001-0000-4000-8000-0000000000c2',
        roles: ['distributor_owner'],
        permissions: ['agents:read', 'agents:write', 'knowledge_bases:read', 'knowledge_bases:write', 'conversations:read', 'conversations:write', 'chat:write'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );

    try {
      db = createDatabase();
      await expectDbUp(db);
      seedAvailable = await agentExists(db, AGENT_SEED);
      if (!seedAvailable) {
        console.warn('Seed de Fase 4 no disponible en este backend (D-F1-003). Se saltan los tests.');
        return;
      }
    } catch (err) {
      console.warn('DB no accesible; saltando Fase 4 tests.', err);
      return;
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.use((req: Request, res: Response, next: NextFunction) => {
      const mw = app.get(TenantContextMiddleware);
      mw.use(req, res, next).catch((err: unknown) => next(err));
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db) await closeDatabase();
  });

  it('GET /agents seed: lista al menos 1 agent del seed (Agente de Soporte)', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/agents')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((a: { id: string }) => a.id);
    expect(ids).toContain(AGENT_SEED);
  });

  it('GET /agents/:id del seed retorna detalle con 1 versión publicada', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/agents/${AGENT_SEED}`)
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(AGENT_SEED);

    const versionsRes = await request(app.getHttpServer())
      .get(`/api/v1/agents/${AGENT_SEED}/versions`)
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(versionsRes.status).toBe(200);
    const published = versionsRes.body.items.find((v: { state: string }) => v.state === 'PUBLISHED');
    expect(published).toBeDefined();
  });

  it('GET /agents del seed: distributor B no ve los del distributor A (cross-tenant)', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/agents')
      .set('Authorization', `Bearer ${distBOwnerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((a: { id: string }) => a.id);
    expect(ids).not.toContain(AGENT_SEED);
  });

  it('GET /knowledge-bases del seed lista la KB demo', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/knowledge-bases')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((k: { id: string }) => k.id);
    expect(ids).toContain(KB_SEED);
  });

  it('POST /chat crea conversación y devuelve mensaje OUTBOUND (mock provider)', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ agentId: AGENT_SEED, message: '¿Cuál es el horario?', channel: 'WIDGET' });
    expect(res.status).toBe(201);
    expect(res.body.conversation).toBeDefined();
    expect(res.body.conversation.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.conversation.state).toBe('AI_ACTIVE');
    expect(res.body.inbound.content).toBe('¿Cuál es el horario?');
    expect(res.body.inbound.direction).toBe('INBOUND');
    expect(res.body.outbound.direction).toBe('OUTBOUND');
    expect(typeof res.body.outbound.content).toBe('string');
    expect(res.body.outbound.content.length).toBeGreaterThan(0);
    expect(res.body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('POST /chat con conversationId existente agrega mensajes a la misma conversación', async () => {
    if (!app || !seedAvailable) return;
    const first = await request(app.getHttpServer())
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ agentId: AGENT_SEED, message: 'primera pregunta' });
    const convId = first.body.conversation.id;

    const second = await request(app.getHttpServer())
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ agentId: AGENT_SEED, message: 'segunda pregunta', conversationId: convId });
    expect(second.status).toBe(201);
    expect(second.body.conversation.id).toBe(convId);

    const msgsRes = await request(app.getHttpServer())
      .get(`/api/v1/conversations/${convId}/messages`)
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(msgsRes.status).toBe(200);
    expect(msgsRes.body.items.length).toBe(4);
  });

  it('POST /chat con agentId de otro tenant retorna 403', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat')
      .set('Authorization', `Bearer ${distBOwnerToken}`)
      .send({ agentId: AGENT_SEED, message: 'hola' });
    expect(res.status).toBe(403);
    expect(res.body.code).toMatch(/CROSS_TENANT|CROSS_PLATFORM/);
  });

  it('POST /knowledge-bases crea una nueva KB y aparece en el listado', async () => {
    if (!app || !seedAvailable) return;
    const create = await request(app.getHttpServer())
      .post('/api/v1/knowledge-bases')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ name: 'KB de prueba e2e', description: 'auto-test' });
    expect(create.status).toBe(201);
    const id = create.body.id;

    const list = await request(app.getHttpServer())
      .get('/api/v1/knowledge-bases')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    const ids = list.body.items.map((k: { id: string }) => k.id);
    expect(ids).toContain(id);

    const del = await request(app.getHttpServer())
      .delete(`/api/v1/knowledge-bases/${id}`)
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(del.status).toBe(200);
  });

  it('POST /chat/test sin persistencia ejecuta un turn (mock)', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/chat/test')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ agentId: AGENT_SEED, message: 'test rápido' });
    expect(res.status).toBe(201);
    expect(res.body.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('GET /conversations lista conversaciones del client actual', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/conversations')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });
});
