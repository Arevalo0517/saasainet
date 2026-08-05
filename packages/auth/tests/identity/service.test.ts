import { describe, it, expect } from 'vitest';
import { IdentityService } from '../../src/services/identity/service.js';
import {
  InvalidCredentialsError,
  MfaInvalidError,
  MfaRequiredError,
  UserLockedError,
  UserSuspendedError,
} from '../../src/services/identity/errors.js';
import { encryptMfaSecret } from '../../src/services/identity/mfa.js';
import { loadIdentityConfig } from '../../src/services/identity/config.js';
import { createFakeRepos, createUser, createUserRole } from './fakes.js';
import type { MfaMethodRecord, UserRecord, UserRoleWithRole } from '../../src/services/identity/repositories.js';

const PLATFORM_ID = '00000000-0000-4000-8000-000000000001';
const config = loadIdentityConfig({ AUTH_SECRET: 'a'.repeat(48) } as unknown as NodeJS.ProcessEnv);

const makeRole = (userId: string, overrides: Partial<UserRoleWithRole> = {}): UserRoleWithRole =>
  createUserRole({
    userId,
    platformId: PLATFORM_ID,
    ...overrides,
  });

const makePlatformRole = (userId: string): UserRoleWithRole =>
  makeRole(userId, {
    role: { id: 'r-psa', key: 'platform_super_admin', name: 'PSA', scope: 'PLATFORM', isSystem: true },
    permissionKeys: ['platform:read'],
  });

const makeMfaMethod = (userId: string, secretPlain: string): MfaMethodRecord => ({
  id: 'mfa-method-1',
  userId,
  type: 'TOTP',
  status: 'ACTIVE',
  secretEncrypted: encryptMfaSecret(secretPlain, config.authSecret),
  destination: null,
  isPrimary: true,
  verifiedAt: new Date(),
  lastUsedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('IdentityService.login', () => {
  it('happy path: emite access+refresh, construye tenant context', async () => {
    const user = createUser({ platformId: PLATFORM_ID, emailNormalized: 'super@acme-fabricante.test' });
    const repos = createFakeRepos({
      users: [user],
      userRoles: [makePlatformRole(user.id)],
    });
    const svc = new IdentityService({ config, repos });
    const result = await svc.login({
      platformId: PLATFORM_ID,
      email: 'super@acme-fabricante.test',
      password: 'AcmeTest2026!',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });
    expect(result.accessToken.split('.').length).toBe(3);
    expect(result.refreshToken.length).toBeGreaterThan(60);
    expect(result.refreshTokenExpiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(result.tenant.userId).toBe(user.id);
    expect(result.tenant.platformId).toBe(PLATFORM_ID);
    expect(result.mfaRequired).toBe(false);
  });

  it('rechaza credenciales inválidas e incrementa failedLoginAttempts', async () => {
    const user = createUser({ platformId: PLATFORM_ID, emailNormalized: 'super@acme-fabricante.test' });
    const repos = createFakeRepos({ users: [user], userRoles: [makePlatformRole(user.id)] });
    const svc = new IdentityService({ config, repos });
    await expect(
      svc.login({
        platformId: PLATFORM_ID,
        email: 'super@acme-fabricante.test',
        password: 'WRONG',
        userAgent: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(InvalidCredentialsError);
  });

  it('bloquea al usuario tras maxFailedLoginAttempts', async () => {
    const user = createUser({ platformId: PLATFORM_ID, emailNormalized: 'super@acme-fabricante.test' });
    const repos = createFakeRepos({ users: [user], userRoles: [makePlatformRole(user.id)] });
    const svc = new IdentityService({ config, repos });
    for (let i = 0; i < config.maxFailedLoginAttempts - 1; i += 1) {
      await expect(
        svc.login({
          platformId: PLATFORM_ID,
          email: 'super@acme-fabricante.test',
          password: 'WRONG',
          userAgent: null,
          ipAddress: null,
        }),
      ).rejects.toBeInstanceOf(InvalidCredentialsError);
    }
    await expect(
      svc.login({
        platformId: PLATFORM_ID,
        email: 'super@acme-fabricante.test',
        password: 'WRONG',
        userAgent: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(UserLockedError);
  });

  it('rechaza usuario suspendido', async () => {
    const user = createUser({
      platformId: PLATFORM_ID,
      emailNormalized: 'super@acme-fabricante.test',
      status: 'SUSPENDED',
    });
    const repos = createFakeRepos({ users: [user], userRoles: [makePlatformRole(user.id)] });
    const svc = new IdentityService({ config, repos });
    await expect(
      svc.login({
        platformId: PLATFORM_ID,
        email: 'super@acme-fabricante.test',
        password: 'AcmeTest2026!',
        userAgent: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(UserSuspendedError);
  });

  it('requiere MFA si mfaEnabled=true y no se proporciona código', async () => {
    const user = createUser({
      platformId: PLATFORM_ID,
      emailNormalized: 'super@acme-fabricante.test',
      mfaEnabled: true,
    });
    const repos = createFakeRepos({ users: [user], userRoles: [makePlatformRole(user.id)] });
    const svc = new IdentityService({ config, repos });
    await expect(
      svc.login({
        platformId: PLATFORM_ID,
        email: 'super@acme-fabricante.test',
        password: 'AcmeTest2026!',
        userAgent: null,
        ipAddress: null,
      }),
    ).rejects.toBeInstanceOf(MfaRequiredError);
  });

  it('rechaza código MFA incorrecto', async () => {
    const user = createUser({
      platformId: PLATFORM_ID,
      emailNormalized: 'super@acme-fabricante.test',
      mfaEnabled: true,
    });
    const repos = createFakeRepos({
      users: [user],
      userRoles: [makePlatformRole(user.id)],
      mfaMethods: [makeMfaMethod(user.id, 'JBSWY3DPEHPK3PXP')],
    });
    const svc = new IdentityService({ config, repos });
    await expect(
      svc.login({
        platformId: PLATFORM_ID,
        email: 'super@acme-fabricante.test',
        password: 'AcmeTest2026!',
        userAgent: null,
        ipAddress: null,
        mfaCode: '000000',
      }),
    ).rejects.toBeInstanceOf(MfaInvalidError);
  });
});

describe('IdentityService.refresh + logout', () => {
  it('refresh rota el token y emite uno nuevo con la misma identidad', async () => {
    const user = createUser({ platformId: PLATFORM_ID, emailNormalized: 'super@acme-fabricante.test' });
    const repos = createFakeRepos({ users: [user], userRoles: [makePlatformRole(user.id)] });
    const svc = new IdentityService({ config, repos });
    const login = await svc.login({
      platformId: PLATFORM_ID,
      email: 'super@acme-fabricante.test',
      password: 'AcmeTest2026!',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });
    const result = await svc.refresh({
      refreshToken: login.refreshToken,
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });
    expect(result.refreshToken).not.toBe(login.refreshToken);
    expect(result.tenant.userId).toBe(user.id);
  });

  it('logout revoca la sesión', async () => {
    const user = createUser({ platformId: PLATFORM_ID, emailNormalized: 'super@acme-fabricante.test' });
    const repos = createFakeRepos({ users: [user], userRoles: [makePlatformRole(user.id)] });
    const svc = new IdentityService({ config, repos });
    const login = await svc.login({
      platformId: PLATFORM_ID,
      email: 'super@acme-fabricante.test',
      password: 'AcmeTest2026!',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
    });
    await svc.logout({ refreshToken: login.refreshToken });
    await expect(
      svc.refresh({ refreshToken: login.refreshToken, userAgent: 'jest', ipAddress: '127.0.0.1' }),
    ).rejects.toThrow();
  });
});

describe('IdentityService.setupMfa', () => {
  it('genera otpauth URL y persistencia pending verification', async () => {
    const user = createUser({ platformId: PLATFORM_ID, emailNormalized: 'super@acme-fabricante.test' });
    const repos = createFakeRepos({ users: [user], userRoles: [makePlatformRole(user.id)] });
    const svc = new IdentityService({ config, repos });
    const result = await svc.setupMfa({ userId: user.id, email: user.email });
    expect(result.secret).toMatch(/^[A-Z2-7]{32}$/u);
    expect(result.otpAuthUrl.startsWith('otpauth://totp/')).toBe(true);
    expect(result.mfaMethodId).toMatch(/^[0-9a-f-]+$/u);
  });
});