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
const PLATFORM_SUPER_ADMIN = '11111111-1111-4000-8000-000000000001';
const PLATFORM_ADMIN = '11111111-1111-4000-8000-000000000002';
const DIST_A_ADMIN = '22222222-2222-4000-8000-000000000003';
const CLIENT_A1_USER = '33333333-3333-4000-8000-000000000004';

describe('Webhook allowlist per client (Fase 8b)', () => {
  let app: INestApplication | null = null;
  let db: Database | null = null;
  let dbAvailable = false;
  let distAOwnerToken = '';

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
    distAOwnerToken = await signAccessToken(
      {
        userId: DIST_A_OWNER,
        platformId: PLATFORM_ID,
        distributorId: DIST_A,
        clientId: null,
        roles: ['distributor_owner'],
        permissions: [],
        isPlatformSuperAdmin: false,

      },
      identity,
    );
  });

  afterAll(async () => {
    if (app !== null) await app.close();
    if (db !== null) await closeDatabase(db);
  });

  it('GET /clients/:id/webhook-allowed-hosts 200 con lista vacía por defecto', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/clients/${CLIENT_A1}/webhook-allowed-hosts`)
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ clientId: CLIENT_A1, hosts: [] });
  });

  it('PATCH /clients/:id/webhook-allowed-hosts 200 con hosts válidos', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/clients/${CLIENT_A1}/webhook-allowed-hosts`)
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ hosts: ['hooks.example.com', '*.webhooks.example.com'] });
    expect(res.status).toBe(200);
    expect(res.body.hosts).toEqual(['hooks.example.com', '*.webhooks.example.com']);
  });

  it('PATCH rechaza host inválido con 400', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/clients/${CLIENT_A1}/webhook-allowed-hosts`)
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ hosts: ['hooks.example.com', 'bad host with spaces'] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEBHOOK_ALLOWLIST_INVALID');
  });

  it('PATCH rechaza lista demasiado grande con 400', async () => {
    if (!app || !dbAvailable) return;
    const big = Array.from({ length: 201 }, (_, i) => `h${i}.example.com`);
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/clients/${CLIENT_A1}/webhook-allowed-hosts`)
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ hosts: big });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEBHOOK_ALLOWLIST_TOO_LARGE');
  });

  it('PATCH normaliza lowercase + dedupe + strip dots', async () => {
    if (!app || !dbAvailable) return;
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/clients/${CLIENT_A1}/webhook-allowed-hosts`)
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ hosts: ['  EXAMPLE.com  ', 'example.com', '*.hooks.Example.com'] });
    expect(res.status).toBe(200);
    expect(res.body.hosts).toEqual(['example.com', '*.hooks.example.com']);
  });

  it('PATCH como client_user sin permisos retorna 403', async () => {
    if (!app || !dbAvailable) return;
    const identity = await loadIdentityConfig();
    if (identity === null) throw new Error('AUTH_SECRET requerido');
    const token = await signAccessToken(
      {
        userId: CLIENT_A1_USER,
        platformId: PLATFORM_ID,
        distributorId: DIST_A,
        clientId: CLIENT_A1,
        roles: ['client_user'],
        permissions: [],
        isPlatformSuperAdmin: false,

      },
      identity,
    );
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/clients/${CLIENT_A1}/webhook-allowed-hosts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hosts: ['x.example.com'] });
    expect(res.status).toBe(403);
  });

  it('PATCH como platform_super_admin acepta', async () => {
    if (!app || !dbAvailable) return;
    const identity = await loadIdentityConfig();
    if (identity === null) throw new Error('AUTH_SECRET requerido');
    const token = await signAccessToken(
      {
        userId: PLATFORM_SUPER_ADMIN,
        platformId: PLATFORM_ID,
        distributorId: null,
        clientId: null,
        roles: ['platform_super_admin'],
        permissions: [],
        isPlatformSuperAdmin: true,

      },
      identity,
    );
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/clients/${CLIENT_A1}/webhook-allowed-hosts`)
      .set('Authorization', `Bearer ${token}`)
      .send({ hosts: [] });
    expect(res.status).toBe(200);
    expect(res.body.hosts).toEqual([]);
  });
});
