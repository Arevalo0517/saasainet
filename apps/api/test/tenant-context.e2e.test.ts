import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Controller, Get, Module, Req, UseGuards, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';
import { signAccessToken, loadIdentityConfig } from '@platform/auth';
import { AppModule } from '../src/app.module.js';
import { TenantContextMiddleware } from '../src/auth/tenant-context.middleware.js';
import { JwtGuard } from '../src/auth/jwt.guard.js';
import { RolesGuard } from '../src/auth/roles.guard.js';
import { PermissionsGuard } from '../src/auth/permissions.guard.js';
import { Roles } from '../src/auth/roles.decorator.js';
import { RequirePermissions } from '../src/auth/permissions.decorator.js';

@Controller('protected')
class ProtectedController {
  @Get('whoami')
  @UseGuards(JwtGuard)
  whoami(@Req() req: Request): { userId: string; roles: string[] } {
    const ctx = req.tenantContext!;
    return { userId: ctx.userId, roles: ctx.roles };
  }

  @Get('admin')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles('platform_super_admin')
  adminOnly(@Req() req: Request): { userId: string } {
    return { userId: req.tenantContext!.userId };
  }

  @Get('kb')
  @UseGuards(JwtGuard, PermissionsGuard)
  @RequirePermissions('kb:read')
  kb(@Req() req: Request): { userId: string } {
    return { userId: req.tenantContext!.userId };
  }
}

@Module({ controllers: [ProtectedController] })
class ProtectedTestModule {}

describe('TenantContextMiddleware + Guards (Fase 1)', () => {
  let app: INestApplication;
  let superToken = '';
  let distributorToken = '';
  let tokenWithoutKbRead = '';

  beforeAll(async () => {
    process.env.AUTH_SECRET = process.env.AUTH_SECRET ?? 'test-secret-min-32-chars-aaaaaaaaaaaa';
    process.env.AUTH_ISSUER = process.env.AUTH_ISSUER ?? 'saasplatform-ainnet';
    const cfg = loadIdentityConfig({
      AUTH_SECRET: process.env.AUTH_SECRET,
      AUTH_ISSUER: process.env.AUTH_ISSUER,
    } as unknown as NodeJS.ProcessEnv);

    superToken = await signAccessToken(
      {
        userId: '11111111-1111-4000-8000-000000000001',
        platformId: 'f0000001-0000-4000-8000-000000000001',
        distributorId: null,
        clientId: null,
        roles: ['platform_super_admin'],
        permissions: ['kb:read'],
        isPlatformSuperAdmin: true,
      },
      cfg,
    );
    distributorToken = await signAccessToken(
      {
        userId: '22222222-2222-4000-8000-000000000002',
        platformId: 'f0000001-0000-4000-8000-000000000001',
        distributorId: 'd0000011-0000-4000-8000-000000000011',
        clientId: null,
        roles: ['distributor_admin'],
        permissions: ['kb:read'],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );
    tokenWithoutKbRead = await signAccessToken(
      {
        userId: '33333333-3333-4000-8000-000000000003',
        platformId: 'f0000001-0000-4000-8000-000000000001',
        distributorId: null,
        clientId: null,
        roles: ['platform_viewer'],
        permissions: [],
        isPlatformSuperAdmin: false,
      },
      cfg,
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule, ProtectedTestModule],
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

  it('whoami sin token retorna 401', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/protected/whoami');
    expect(res.status).toBe(401);
  });

  it('whoami con token válido retorna 200 y userId/roles', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/protected/whoami')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe('11111111-1111-4000-8000-000000000001');
    expect(res.body.roles).toContain('platform_super_admin');
  });

  it('whoami con token malformado retorna 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/protected/whoami')
      .set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
  });

  it('admin con super_admin retorna 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/protected/admin')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it('admin con distributor_admin (sin super_admin) retorna 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/protected/admin')
      .set('Authorization', `Bearer ${distributorToken}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('kb con permission kb:read retorna 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/protected/kb')
      .set('Authorization', `Bearer ${superToken}`);
    expect(res.status).toBe(200);
  });

  it('kb sin permission kb:read retorna 403', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/protected/kb')
      .set('Authorization', `Bearer ${tokenWithoutKbRead}`);
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('FORBIDDEN_PERMISSION');
  });
});
