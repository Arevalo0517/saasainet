import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, Module, Req, UseGuards, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { signAccessToken, loadIdentityConfig } from '@platform/auth';
import { AppModule } from '../src/app.module.js';
import { TenantContextMiddleware } from '../src/auth/tenant-context.middleware.js';
import { JwtGuard } from '../src/auth/jwt.guard.js';
import { PermissionsGuard } from '../src/auth/permissions.guard.js';
import { RequirePermissions } from '../src/auth/permissions.decorator.js';

const PLATFORM_A = 'f0000001-0000-4000-8000-000000000001';
const PLATFORM_B = 'f0000002-0000-4000-8000-000000000002';
const DIST_A = 'd0000011-0000-4000-8000-000000000011';
const DIST_B = 'd0000012-0000-4000-8000-000000000012';
const CLIENT_A = 'c0000021-0000-4000-8000-000000000021';
const CLIENT_B = 'c0000022-0000-4000-8000-000000000022';
const USER_A = '11111111-1111-4000-8000-000000000001';
const USER_B = '22222222-2222-4000-8000-000000000002';

let app: INestApplication;
let cfg: ReturnType<typeof loadIdentityConfig>;

const sign = (params: {
  userId: string;
  platformId: string;
  distributorId: string | null;
  clientId: string | null;
  roles: string[];
  permissions: string[];
  isPlatformSuperAdmin: boolean;
}): Promise<string> => signAccessToken(params, cfg);

@Controller('iso')
class IsolationController {
  @Get('platform')
  @UseGuards(JwtGuard)
  platformId(@Req() req: Request): { platformId: string } {
    return { platformId: req.tenantContext!.platformId };
  }

  @Get('distributor')
  @UseGuards(JwtGuard)
  distributorId(@Req() req: Request): { distributorId: string | null } {
    return { distributorId: req.tenantContext!.distributorId ?? null };
  }

  @Get('super-only')
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions('*')
  superOnly(@Req() req: Request): { userId: string } {
    return { userId: req.tenantContext!.userId };
  }

  @Get('client-write')
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions('client:contact:write')
  clientWrite(@Req() req: Request): { userId: string } {
    return { userId: req.tenantContext!.userId };
  }
}

@Module({ controllers: [IsolationController] })
class IsolationTestModule {}

describe('Aislamiento multi-tenant (5 garantías críticas, Fase 1)', () => {
  beforeAll(async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-min-32-chars-aaaaaaaaaaaa';
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? 'saasplatform-ainnet';
    cfg = loadIdentityConfig({
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_ISSUER: process.env.AUTH_ISSUER,
    } as unknown as NodeJS.ProcessEnv);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, IsolationTestModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.use((req: Request, res: Response, next: NextFunction) => {
      const mw = app.get(TenantContextMiddleware);
      mw.use(req, res, next).catch((err: unknown) => next(err));
    });
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('1. distributor A: tenantContext.distributorId refleja su scope (no B)', async () => {
    const token = await sign({
      userId: USER_A,
      platformId: PLATFORM_A,
      distributorId: DIST_A,
      clientId: null,
      roles: ['distributor_admin'],
      permissions: ['distributor:client:write'],
      isPlatformSuperAdmin: false,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/iso/distributor')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.distributorId).toBe(DIST_A);
    expect(res.body.distributorId).not.toBe(DIST_B);
  });

  it('2. distributor B: tenantContext.distributorId refleja su scope (no A)', async () => {
    const token = await sign({
      userId: USER_B,
      platformId: PLATFORM_A,
      distributorId: DIST_B,
      clientId: null,
      roles: ['distributor_admin'],
      permissions: ['distributor:client:write'],
      isPlatformSuperAdmin: false,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/iso/distributor')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.distributorId).toBe(DIST_B);
    expect(res.body.distributorId).not.toBe(DIST_A);
  });

  it('3. client A: clientWrite requiere client:contact:write que A sí tiene', async () => {
    const token = await sign({
      userId: USER_A,
      platformId: PLATFORM_A,
      distributorId: DIST_A,
      clientId: CLIENT_A,
      roles: ['client_admin'],
      permissions: ['client:contact:write'],
      isPlatformSuperAdmin: false,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/iso/client-write')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('4. client B sin permission client:contact:write es bloqueado por PermissionsGuard', async () => {
    const token = await sign({
      userId: USER_B,
      platformId: PLATFORM_A,
      distributorId: DIST_B,
      clientId: CLIENT_B,
      roles: ['client_viewer'],
      permissions: ['client:inbox:read'],
      isPlatformSuperAdmin: false,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/iso/client-write')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });

  it('5. platform super_admin con `*` permission accede a endpoint restringido', async () => {
    const token = await sign({
      userId: USER_A,
      platformId: PLATFORM_A,
      distributorId: null,
      clientId: null,
      roles: ['platform_super_admin'],
      permissions: ['*'],
      isPlatformSuperAdmin: true,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/iso/super-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('6. token manipulado (firma inválida) es rechazado por el middleware', async () => {
    const good = await sign({
      userId: USER_A,
      platformId: PLATFORM_A,
      distributorId: null,
      clientId: null,
      roles: ['platform_viewer'],
      permissions: ['platform:audit:read'],
      isPlatformSuperAdmin: false,
    });
    const tampered = `${good.slice(0, -4)}AAAA`;
    const res = await request(app.getHttpServer())
      .get('/api/v1/iso/platform')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('7. platform A en JWT vs endpoint que esperaría platform B: el middleware reporta platform A (no hay bypass)', async () => {
    const token = await sign({
      userId: USER_A,
      platformId: PLATFORM_A,
      distributorId: null,
      clientId: null,
      roles: ['platform_viewer'],
      permissions: ['platform:audit:read'],
      isPlatformSuperAdmin: false,
    });
    const res = await request(app.getHttpServer())
      .get('/api/v1/iso/platform')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.platformId).toBe(PLATFORM_A);
    expect(res.body.platformId).not.toBe(PLATFORM_B);
  });
});
