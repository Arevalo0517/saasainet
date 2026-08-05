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
const DIST_B = 'f0000001-0000-4000-8000-0000000000b1';
const CLIENT_A1 = 'f0000001-0000-4000-8000-0000000000c1';
const CLIENT_B1 = 'f0000001-0000-4000-8000-0000000000c3';
const SUPER_USER = '11111111-1111-4000-8000-000000000001';
const DIST_A_OWNER = '22222222-2222-4000-8000-000000000002';
const DIST_B_OWNER = '33333333-3333-4000-8000-000000000003';
const CLIENT_USER = '44444444-4444-4000-8000-000000000004';

const expectDbUp = async (db: Database): Promise<void> => {
  await db.execute(sql`select 1 as ok`);
};

const distributorExists = async (db: Database, id: string): Promise<boolean> => {
  const rows = await db.execute<{ count: string }>(sql`select count(*)::text as count from public.distributors where id = ${id}::uuid`);
  const first = (rows as unknown as Array<{ count: string }>)[0];
  return Boolean(first && Number.parseInt(first.count, 10) > 0);
};

describe('DistributorsController + ClientsController (Fase 2)', () => {
  let app: INestApplication;
  let db: Database | null = null;
  let seedAvailable = false;
  let superToken = '';
  let distAOwnerToken = '';
  let distBOwnerToken = '';
  let clientUserToken = '';

  beforeAll(async () => {
    let cfg: ReturnType<typeof loadIdentityConfig> | null = null;
    try {
      process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-min-32-chars-aaaaaaaaaaaa';
      process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? 'saasplatform-ainnet';
      cfg = loadIdentityConfig({
        AUTH_SECRET: process.env.AUTH_SECRET,
        AUTH_ISSUER: process.env.AUTH_ISSUER,
      } as unknown as NodeJS.ProcessEnv);
    } catch (err) {
      console.warn('Auth config no inicializable; saltando Fase 2 tests.', err);
      return;
    }

    superToken = await signAccessToken(
      {
        userId: SUPER_USER,
        platformId: PLATFORM_ID,
        distributorId: null,
        clientId: null,
        roles: ['platform_super_admin'],
        permissions: ['distributors:read', 'distributors:write', 'clients:read', 'clients:write'],
        isPlatformSuperAdmin: true,
      },
      cfg,
    );
    distAOwnerToken = await signAccessToken(
      {
        userId: DIST_A_OWNER,
        platformId: PLATFORM_ID,
        distributorId: DIST_A,
        clientId: null,
        roles: ['distributor_owner'],
        permissions: ['distributors:read', 'distributors:write', 'clients:read', 'clients:write'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );
    distBOwnerToken = await signAccessToken(
      {
        userId: DIST_B_OWNER,
        platformId: PLATFORM_ID,
        distributorId: DIST_B,
        clientId: null,
        roles: ['distributor_owner'],
        permissions: ['distributors:read', 'distributors:write', 'clients:read', 'clients:write'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );
    clientUserToken = await signAccessToken(
      {
        userId: CLIENT_USER,
        platformId: PLATFORM_ID,
        distributorId: DIST_A,
        clientId: CLIENT_A1,
        roles: ['client_user'],
        permissions: ['clients:read'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );

    try {
      db = createDatabase();
      await expectDbUp(db);
      seedAvailable = await distributorExists(db, DIST_A);
      if (!seedAvailable) {
        console.warn('Seed de Fase 2 no disponible en este backend (D-F1-003). Se saltan los tests.');
        return;
      }
    } catch (err) {
      console.warn('DB no accesible; saltando Fase 2 tests.', err);
      return;
    }

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
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

  it('GET /distributors como super_admin lista 2 distribuidores', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/distributors')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(2);
  });

  it('GET /distributors como distributor_owner A lista solo su distribuidor', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/distributors')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(1);
    expect(res.body.items[0].id).toBe(DIST_A);
  });

  it('GET /distributors/:id de otro tenant retorna 403', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get(`/api/v1/distributors/${DIST_B}`)
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('GET /clients como distributor_owner A incluye cliente seed CLIENT_A1', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((c: { id: string }) => c.id);
    expect(ids).toContain(CLIENT_A1);
  });

  it('GET /clients como distributor_owner A no ve clientes de B', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((c: { id: string }) => c.id);
    expect(ids).not.toContain(CLIENT_B1);
  });

  it('GET /clients como client_user lista solo su cliente (CLIENT_A1)', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${clientUserToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((c: { id: string }) => c.id);
    expect(ids).toEqual([CLIENT_A1]);
  });

  it('GET /clients como client_user lista solo su cliente (CLIENT_A1)', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/clients')
      .set('Authorization', `Bearer ${clientUserToken}`);
    expect(res.status).toBe(200);
    const ids = res.body.items.map((c: { id: string }) => c.id);
    expect(ids).toEqual([CLIENT_A1]);
  });

  it('POST /clients como distributor_owner en su distribuidor retorna 201', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({
        distributorId: DIST_A,
        key: 'test-clt-a-' + Date.now(),
        name: 'Cliente Test A',
        legalName: 'Cliente Test A SA de CV',
      });
    expect(res.status).toBe(201);
    expect(res.body.distributorId).toBe(DIST_A);
  });

  it('POST /clients en distribuidor de otro tenant retorna 403', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({
        distributorId: DIST_B,
        key: 'attacker',
        name: 'Atacante',
        legalName: 'Atacante SA',
      });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TENANT_ACCESS');
  });

  it('POST /clients como client_user (no owner) retorna 403', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/clients')
      .set('Authorization', `Bearer ${clientUserToken}`)
      .send({
        distributorId: DIST_A,
        key: 'clienttry',
        name: 'Cliente',
        legalName: 'Cliente SA',
      });
    expect(res.status).toBe(403);
  });

  it('GET /distributors sin token retorna 401', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer()).get('/api/v1/distributors');
    expect(res.status).toBe(401);
  });
});
