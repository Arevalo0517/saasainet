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
const CLIENT_A1 = 'f0000001-0000-4000-8000-0000000000c2';
const SUPER_ADMIN = '11111111-1111-4000-8000-0000000000aa';
const CLIENT_A1_OWNER = '33333333-3333-4000-8000-0000000000aa';
const CLIENT_A1_USER = '44444444-4444-4000-8000-0000000000aa';

describe('Usage events (Fase 8f)', () => {
  let app: INestApplication | null = null;
  let db: Database | null = null;
  let dbAvailable = false;
  let superAdminToken = '';
  let clientA1OwnerToken = '';
  let clientA1UserToken = '';

  beforeAll(async () => {
    const identity = await loadIdentityConfig();
    if (identity === null) throw new Error('AUTH_SECRET requerido');
    try {
      db = createDatabase();
      await db.execute(sql`select 1`);
      dbAvailable = true;
    } catch {
      dbAvailable = false;
      return;
    }
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1');
    app.use((req: Request, res: Response, next: NextFunction) => {
      const mw = app!.get(TenantContextMiddleware);
      mw.use(req, res, next).catch((err: unknown) => next(err));
    });
    await app.init();
    superAdminToken = await signAccessToken(
      { userId: SUPER_ADMIN, platformId: PLATFORM_ID, distributorId: null, clientId: null, roles: ['platform_super_admin'], permissions: [], isPlatformSuperAdmin: true },
      identity,
    );
    clientA1OwnerToken = await signAccessToken(
      { userId: CLIENT_A1_OWNER, platformId: PLATFORM_ID, distributorId: DIST_A, clientId: CLIENT_A1, roles: ['client_owner'], permissions: [], isPlatformSuperAdmin: false },
      identity,
    );
    clientA1UserToken = await signAccessToken(
      { userId: CLIENT_A1_USER, platformId: PLATFORM_ID, distributorId: DIST_A, clientId: CLIENT_A1, roles: ['client_user'], permissions: [], isPlatformSuperAdmin: false },
      identity,
    );
  });

  afterAll(async () => {
    if (app !== null) await app.close();
    if (db !== null) await closeDatabase(db);
  });

  it('client_user no tiene acceso (retorna vacío)', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/usage-events/aggregate')
      .set('Authorization', `Bearer ${clientA1UserToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toEqual([]);
  });

  it('platform_super_admin puede agregar (aunque no haya datos)', async () => {
    if (!app || !dbAvailable) return;
    await db.execute(sql`TRUNCATE TABLE usage_events`);
    const res = await request(app.getHttpServer())
      .get('/api/v1/usage-events/aggregate?groupBy=day')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows).toBeDefined();
    expect(res.body.totals).toBeDefined();
    expect(res.body.groupBy).toBe('day');
  });

  it('aggregate suma por métrica y por día', async () => {
    if (!app || !dbAvailable) return;
    await new Promise((r) => setTimeout(r, 5000));
    await db.execute(sql`TRUNCATE TABLE usage_events`);
    await db.execute(sql`INSERT INTO usage_events (id, platform_id, distributor_id, client_id, agent_id, conversation_id, metric, quantity, cost_cents, model_profile, occurred_at) VALUES
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, NULL, NULL, 'messages_sent', 5, 0, NULL, NOW()),
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, NULL, NULL, 'messages_received', 3, 0, NULL, NOW()),
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, NULL, NULL, 'tokens_input', 100, 1, 'gpt-4o-mini', NOW())`);
    const res = await request(app.getHttpServer())
      .get('/api/v1/usage-events/aggregate?groupBy=metric')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    const map = new Map<string, { qty: number; events: number }>();
    for (const r of res.body.rows as Array<{ key: string; totalQuantity: number; eventCount: number }>) {
      map.set(r.key, { qty: r.totalQuantity, events: r.eventCount });
    }
    expect(map.get('messages_sent')?.qty).toBe(5);
    expect(map.get('messages_received')?.qty).toBe(3);
    expect(map.get('tokens_input')?.qty).toBe(100);
    expect(res.body.totals.totalQuantity).toBe(108);
    expect(res.body.totals.totalCostCents).toBe(1);
  });

  it('filtro por metric reduce los resultados', async () => {
    if (!app || !dbAvailable) return;
    await db.execute(sql`TRUNCATE TABLE usage_events`);
    await db.execute(sql`INSERT INTO usage_events (id, platform_id, distributor_id, client_id, agent_id, conversation_id, metric, quantity, cost_cents, model_profile, occurred_at) VALUES
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, NULL, NULL, 'messages_sent', 5, 0, NULL, NOW()),
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, NULL, NULL, 'agent_runs', 2, 0, NULL, NOW())`);
    const res = await request(app.getHttpServer())
      .get('/api/v1/usage-events/aggregate?groupBy=metric&metric=agent_runs')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.rows.length).toBe(1);
    expect(res.body.rows[0].key).toBe('agent_runs');
    expect(res.body.rows[0].totalQuantity).toBe(2);
  });

  it('client_owner ve solo su cliente (tenant-scope)', async () => {
    if (!app || !dbAvailable) return;
    await db.execute(sql`TRUNCATE TABLE usage_events`);
    const OTHER_CLIENT = 'f0000001-0000-4000-8000-0000000000c3';
    await db.execute(sql`INSERT INTO usage_events (id, platform_id, distributor_id, client_id, agent_id, conversation_id, metric, quantity, cost_cents, model_profile, occurred_at) VALUES
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, NULL, NULL, 'messages_sent', 5, 0, NULL, NOW()),
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${OTHER_CLIENT}, NULL, NULL, 'messages_sent', 99, 0, NULL, NOW())`);
    const res = await request(app.getHttpServer())
      .get('/api/v1/usage-events/aggregate?groupBy=metric')
      .set('Authorization', `Bearer ${clientA1OwnerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.totals.totalQuantity).toBe(5);
  });
});
