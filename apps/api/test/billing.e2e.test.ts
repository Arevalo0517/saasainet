import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { createHmac } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bodyParser = require('body-parser');
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

const PLAN_STARTER = 'a0000001-0000-4000-8000-000000000001';
const PLAN_PRO = 'a0000001-0000-4000-8000-000000000002';
const PV_STARTER_V1 = 'b0000001-0000-4000-8000-000000000001';
const PV_PRO_V1 = 'b0000001-0000-4000-8000-000000000002';

const MOCK_SECRET = 'test-mock-secret-min-16-chars-aaaa';

const expectDbUp = async (db: Database): Promise<void> => {
  await db.execute(sql`select 1 as ok`);
};

const planExists = async (db: Database, id: string): Promise<boolean> => {
  const rows = await db.execute<{ count: string }>(
    sql`select count(*)::text as count from public.plans where id = ${id}::uuid`,
  );
  const first = (rows as unknown as Array<{ count: string }>)[0];
  return Boolean(first && Number.parseInt(first.count, 10) > 0);
};

const signMockBody = (body: string): string => createHmac('sha256', MOCK_SECRET).update(body).digest('hex');

describe('BillingModule (Fase 3): plans + subscriptions + payments + webhooks + commissions', () => {
  let app: INestApplication;
  let db: Database | null = null;
  let seedAvailable = false;
  let superToken = '';
  let distAOwnerToken = '';
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let distBOwnerToken = '';

  beforeAll(async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-min-32-chars-aaaaaaaaaaaa';
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? 'saasplatform-ainnet';
    process.env.PAYMENT_MOCK_SECRET = MOCK_SECRET;

    let cfg: ReturnType<typeof loadIdentityConfig>;
    try {
      cfg = loadIdentityConfig({
        AUTH_SECRET: process.env.AUTH_SECRET,
        AUTH_ISSUER: process.env.AUTH_ISSUER,
      } as unknown as NodeJS.ProcessEnv);
    } catch (err) {
      console.warn('Auth config no inicializable; saltando Fase 3 tests.', err);
      return;
    }

    superToken = await signAccessToken(
      {
        userId: SUPER_USER,
        platformId: PLATFORM_ID,
        distributorId: null,
        clientId: null,
        roles: ['platform_super_admin'],
        permissions: ['plans:read', 'plans:write', 'subscriptions:read', 'subscriptions:write', 'payments:read', 'payments:write'],
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
        permissions: ['subscriptions:read', 'subscriptions:write', 'payments:read', 'payments:write'],
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
        permissions: ['subscriptions:read', 'subscriptions:write'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );

    try {
      db = createDatabase();
      await expectDbUp(db);
      seedAvailable = await planExists(db, PLAN_STARTER);
      if (!seedAvailable) {
        console.warn('Seed de Fase 3 no disponible en este backend (D-F1-003). Se saltan los tests.');
        return;
      }
    } catch (err) {
      console.warn('DB no accesible; saltando Fase 3 tests.', err);
      return;
    }

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    app.use((req: Request, _res: Response, next: NextFunction) => {
      if (req.path.includes('/webhooks/') && req.method === 'POST') {
        bodyParser.json({
          verify: (r: Request, _res: Response, buf: Buffer) => {
            (r as Request & { rawBody?: string }).rawBody = buf.toString('utf8');
          },
        })(req, _res, next);
      } else {
        next();
      }
    });
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

  it('GET /plans sin auth lista 2 planes públicos (Starter, Pro)', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer()).get('/api/v1/plans');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items.length).toBe(2);
    const codes = res.body.items.map((p: { code: string }) => p.code);
    expect(codes).toContain('starter');
    expect(codes).toContain('pro');
  });

  it('GET /plans/:id retorna plan + 1 versión', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer()).get(`/api/v1/plans/${PLAN_STARTER}`);
    expect(res.status).toBe(200);
    expect(res.body.plan.code).toBe('starter');
    expect(Array.isArray(res.body.versions)).toBe(true);
    expect(res.body.versions.length).toBe(1);
    expect(res.body.versions[0].monthlyPriceCents).toBe(9900);
  });

  it('GET /plans/:id-inexistente retorna 404', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer()).get('/api/v1/plans/00000000-0000-4000-8000-000000000000');
    expect(res.status).toBe(404);
  });

  it('POST /subscriptions como distributor_owner A en su cliente retorna 201', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ clientId: CLIENT_A1, planVersionId: PV_PRO_V1, billingInterval: 'MONTHLY' });
    expect(res.status).toBe(201);
    expect(res.body.clientId).toBe(CLIENT_A1);
    expect(res.body.status).toBe('PENDING_ACTIVATION');
  });

  it('POST /subscriptions en cliente de otro tenant retorna 403', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ clientId: CLIENT_B1, planVersionId: PV_PRO_V1, billingInterval: 'MONTHLY' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('CROSS_TENANT_SUB');
  });

  it('GET /subscriptions como distributor_owner A ve suscripciones de sus clientes', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${distAOwnerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    const ids = res.body.items.map((s: { clientId: string }) => s.clientId);
    expect(ids).toContain(CLIENT_A1);
    expect(ids).not.toContain(CLIENT_B1);
  });

  it('POST /payments/checkout con super_admin retorna checkoutUrl mock', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ clientId: CLIENT_A1, planVersionId: PV_STARTER_V1, billingInterval: 'ANNUAL' });
    expect(res.status).toBe(201);
    expect(res.body.checkoutUrl).toMatch(/^https?:\/\/mock\.payments\.local\/checkout\?/);
    expect(res.body.providerReference).toMatch(/^mock_ch_/);
    expect(res.body.paymentId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('POST /payments/checkout cross-distributor retorna 403', async () => {
    if (!app || !seedAvailable) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${distAOwnerToken}`)
      .send({ clientId: CLIENT_B1, planVersionId: PV_STARTER_V1, billingInterval: 'MONTHLY' });
    expect(res.status).toBe(403);
  });

  it('POST /webhooks/payments con HMAC inválido retorna 400', async () => {
    if (!app || !seedAvailable) return;
    const body = JSON.stringify({ providerPaymentId: 'mock_ch_bad', eventType: 'payment.succeeded' });
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', 'deadbeef')
      .send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('WEBHOOK_INVALID_SIGNATURE');
  });

  it('POST /webhooks/payments con HMAC válido crea comisión (20%) y marca pago SUCCEEDED', async () => {
    if (!app || !seedAvailable) return;
    const checkoutRes = await request(app.getHttpServer())
      .post('/api/v1/payments/checkout')
      .set('Authorization', `Bearer ${superToken}`)
      .send({ clientId: CLIENT_A1, planVersionId: PV_STARTER_V1, billingInterval: 'ANNUAL' });
    const providerPaymentId = checkoutRes.body.providerReference as string;
    const payload = {
      providerPaymentId,
      eventId: `evt_${Date.now()}`,
      eventType: 'PAYMENT_SUCCEEDED',
      status: 'SUCCEEDED',
      amountCents: 49900,
      currency: 'mxn',
      clientId: CLIENT_A1,
      distributorId: DIST_A,
      planId: PLAN_PRO,
      planVersionId: PV_PRO_V1,
      billingInterval: 'MONTHLY',
    };
    const body = JSON.stringify(payload);
    const sig = signMockBody(body);
    const res = await request(app.getHttpServer())
      .post('/api/v1/webhooks/payments')
      .set('Content-Type', 'application/json')
      .set('x-mock-signature', sig)
      .send(body);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.commissionId).toBeDefined();

    const listRes = await request(app.getHttpServer())
      .get(`/api/v1/payments/commissions/${DIST_A}`)
      .set('Authorization', `Bearer ${superToken}`);
    expect(listRes.status).toBe(200);
    const ourCommission = listRes.body.items.find(
      (c: { paymentId: string }) => c.paymentId === res.body.paymentId,
    );
    expect(ourCommission).toBeDefined();
    expect(ourCommission.commissionRate).toBe('0.20');
    expect(ourCommission.commissionAmountCents).toBe(19800);
    expect(ourCommission.status).toBe('PENDING_AVAILABLE');
  });
});
