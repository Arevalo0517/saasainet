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
const CLIENT_B1 = 'f0000001-0000-4000-8000-0000000000c3';
const SUPER_ADMIN = '11111111-1111-4000-8000-00000000000a';
const DIST_A_OWNER = '22222222-2222-4000-8000-00000000000a';
const CLIENT_A1_OWNER = '33333333-3333-4000-8000-00000000000a';
const CLIENT_B1_OWNER = '33333333-3333-4000-8000-00000000000b';
const CLIENT_A1_USER = '44444444-4444-4000-8000-00000000000a';

describe('Audit log (Fase 8e)', () => {
  let app: INestApplication | null = null;
  let db: Database | null = null;
  let dbAvailable = false;
  let superAdminToken = '';
  let clientA1OwnerToken = '';
  let clientB1OwnerToken = '';
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
    clientB1OwnerToken = await signAccessToken(
      { userId: CLIENT_B1_OWNER, platformId: PLATFORM_ID, distributorId: DIST_A, clientId: CLIENT_B1, roles: ['client_owner'], permissions: [], isPlatformSuperAdmin: false },
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

  it('client_user no tiene acceso (retorna items vacíos sin error)', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .set('Authorization', `Bearer ${clientA1UserToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
    expect(res.body.total).toBe(0);
  });

  it('client_owner ve sus eventos pero no los de otros clientes', async () => {
    if (!app || !dbAvailable) return;
    await db.execute(sql`TRUNCATE TABLE audit_events`);
    await db.execute(sql`INSERT INTO audit_events (id, platform_id, distributor_id, client_id, actor_user_id, actor_role, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at) VALUES
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, ${SUPER_ADMIN}, 'platform_super_admin', 'webhook_endpoint.created', 'webhook_endpoint', 'ep-1', '{}'::jsonb, NULL, NULL, NOW()),
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_B1}, ${SUPER_ADMIN}, 'platform_super_admin', 'client.created', 'client', ${CLIENT_B1}, '{}'::jsonb, NULL, NULL, NOW())`);
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .set('Authorization', `Bearer ${clientA1OwnerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].clientId).toBe(CLIENT_A1);
  });

  it('platform_super_admin ve todos los eventos', async () => {
    if (!app || !dbAvailable) return;
    await db.execute(sql`TRUNCATE TABLE audit_events`);
    await db.execute(sql`INSERT INTO audit_events (id, platform_id, distributor_id, client_id, actor_user_id, actor_role, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at) VALUES
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, ${SUPER_ADMIN}, 'platform_super_admin', 'webhook_endpoint.created', 'webhook_endpoint', 'ep-1', '{}'::jsonb, NULL, NULL, NOW()),
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_B1}, ${SUPER_ADMIN}, 'platform_super_admin', 'client.created', 'client', ${CLIENT_B1}, '{}'::jsonb, NULL, NULL, NOW())`);
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.total).toBe(2);
  });

  it('filtro action= y resourceType= funcionan', async () => {
    if (!app || !dbAvailable) return;
    await db.execute(sql`TRUNCATE TABLE audit_events`);
    await db.execute(sql`INSERT INTO audit_events (id, platform_id, distributor_id, client_id, actor_user_id, actor_role, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at) VALUES
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, ${SUPER_ADMIN}, 'platform_super_admin', 'webhook_endpoint.created', 'webhook_endpoint', 'ep-1', '{}'::jsonb, NULL, NULL, NOW()),
      (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, ${SUPER_ADMIN}, 'platform_super_admin', 'client.created', 'client', 'c-1', '{}'::jsonb, NULL, NULL, NOW())`);
    const byAction = await request(app.getHttpServer())
      .get('/api/v1/audit-events?action=webhook_endpoint.created')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(byAction.status).toBe(200);
    expect(byAction.body.items.length).toBe(1);
    expect(byAction.body.items[0].action).toBe('webhook_endpoint.created');
    const byResource = await request(app.getHttpServer())
      .get('/api/v1/audit-events?resourceType=client')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(byResource.status).toBe(200);
    expect(byResource.body.items.length).toBe(1);
    expect(byResource.body.items[0].resourceType).toBe('client');
  });

  it('paginación limit=1 offset=0/1', async () => {
    if (!app || !dbAvailable) return;
    await db.execute(sql`TRUNCATE TABLE audit_events`);
    await new Promise<void>((res) => setTimeout(res, 100));
    for (let i = 0; i < 3; i++) {
      await db.execute(sql`INSERT INTO audit_events (id, platform_id, distributor_id, client_id, actor_user_id, actor_role, action, resource_type, resource_id, metadata, ip_address, user_agent, created_at)
        VALUES (gen_random_uuid(), ${PLATFORM_ID}, ${DIST_A}, ${CLIENT_A1}, ${SUPER_ADMIN}, 'platform_super_admin', 'webhook_endpoint.created', 'webhook_endpoint', ${'ep-' + i}, '{}'::jsonb, NULL, NULL, NOW())`);
    }
    const p1 = await request(app.getHttpServer())
      .get('/api/v1/audit-events?limit=1&offset=0')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(p1.status).toBe(200);
    expect(p1.body.items.length).toBe(1);
    expect(p1.body.total).toBe(3);
    const p2 = await request(app.getHttpServer())
      .get('/api/v1/audit-events?limit=1&offset=1')
      .set('Authorization', `Bearer ${superAdminToken}`);
    expect(p2.body.items.length).toBe(1);
  });

  it('DIST_A_OWNER con role distributor_owner no está en la lista permitida — retorna vacío', async () => {
    if (!app || !dbAvailable) return;
    const identity = await loadIdentityConfig();
    if (identity === null) throw new Error('AUTH_SECRET requerido');
    const distOwnerToken = await signAccessToken(
      { userId: DIST_A_OWNER, platformId: PLATFORM_ID, distributorId: DIST_A, clientId: null, roles: ['distributor_owner'], permissions: [], isPlatformSuperAdmin: false },
      identity,
    );
    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-events')
      .set('Authorization', `Bearer ${distOwnerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});
