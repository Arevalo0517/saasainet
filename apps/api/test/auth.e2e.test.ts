import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Test } from '@nestjs/testing';
import { ValidationPipe, type INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { createDatabase, closeDatabase, type Database } from '@platform/db';
import { sql } from 'drizzle-orm';

const PLATFORM_ID = 'f0000001-0000-4000-8000-000000000001';
const SUPER_EMAIL = 'super@acme-fabricante.test';
const PASSWORD = 'AcmeTest2026!';

const expectDbUp = async (db: Database): Promise<void> => {
  await db.execute(sql`select 1 as ok`);
};

const userExists = async (db: Database, platformId: string, email: string): Promise<boolean> => {
  const rows = await db.execute<{ count: string }>(sql`select count(*)::text as count from public.users where platform_id = ${platformId} and email_normalized = ${email}`);
  const first = (rows as unknown as Array<{ count: string }>)[0];
  return Boolean(first && Number.parseInt(first.count, 10) > 0);
};

describe('AuthController (Fase 1)', () => {
  let app: INestApplication;
  let db: Database | null = null;
  let seedAvailable = false;

  beforeAll(async () => {
    try {
      db = createDatabase();
      await expectDbUp(db);
      seedAvailable = await userExists(db, PLATFORM_ID, SUPER_EMAIL);
      if (!seedAvailable) {
        console.warn(`Seed no disponible en este backend (multi-backend issue, ver D-F1-003). Se saltan los tests que requieren el seed.`);
      }
    } catch (err) {
      console.warn('DB no accesible; saltando smoke test de auth.', err);
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
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (db) await closeDatabase();
  });

  it('login → refresh → logout end-to-end con super admin sembrado', async () => {
    if (!app) return;
    if (!seedAvailable) {
      console.warn('SKIP: seed no disponible en este backend.');
      return;
    }

    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ platformId: PLATFORM_ID, email: SUPER_EMAIL, password: PASSWORD });

    if (login.status !== 200) {
      console.error('LOGIN FAILED', login.status, login.body);
    }
    expect(login.status).toBe(200);

    expect(login.body.accessToken.split('.').length).toBe(3);
    expect(login.body.refreshToken.length).toBeGreaterThan(60);
    expect(login.body.tenant.userId).toMatch(/^[0-9a-f-]+$/u);
    expect(login.body.tenant.platformId).toBe(PLATFORM_ID);
    expect(login.body.tenant.roles).toContain('platform_super_admin');
    expect(login.body.mfaRequired).toBe(false);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);

    expect(refresh.body.accessToken).not.toBe(login.body.accessToken);
    expect(refresh.body.refreshToken).not.toBe(login.body.refreshToken);
    expect(refresh.body.tenant.userId).toBe(login.body.tenant.userId);

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: refresh.body.refreshToken })
      .expect(204);

    const reuse = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: refresh.body.refreshToken });

    expect([401, 404]).toContain(reuse.status);
  });

  it('login con credenciales inválidas retorna 401', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ platformId: PLATFORM_ID, email: SUPER_EMAIL, password: 'WRONG_PASSWORD' });
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('INVALID_CREDENTIALS');
  });

  it('login con email inválido retorna 400 (validation)', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ platformId: PLATFORM_ID, email: 'no-es-email', password: PASSWORD });
    if (res.status !== 400) {
      throw new Error(`Expected 400, got ${res.status}: ${JSON.stringify(res.body)}`);
    }
    expect(res.status).toBe(400);
  });

  it('refresh con token inválido retorna 401', async () => {
    if (!app) return;
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: 'token-que-no-existe-y-es-suficientemente-largo' });
    expect([401, 404]).toContain(res.status);
  });
});