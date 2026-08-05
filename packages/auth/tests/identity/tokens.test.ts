import { describe, it, expect } from 'vitest';
import { signAccessToken, verifyAccessToken } from '../../src/services/identity/tokens.js';
import { TokenExpiredError, TokenInvalidError } from '../../src/services/identity/errors.js';
import { loadIdentityConfig } from '../../src/services/identity/config.js';

const config = loadIdentityConfig({ AUTH_SECRET: 'a'.repeat(48) } as unknown as NodeJS.ProcessEnv);

describe('tokens (jose HS256)', () => {
  it('firma y verifica un JWT con claims tenant', async () => {
    const token = await signAccessToken(
      {
        userId: '00000000-0000-4000-8000-000000000010',
        platformId: '00000000-0000-4000-8000-000000000001',
        distributorId: '00000000-0000-4000-8000-000000000020',
        clientId: null,
        roles: ['DISTRIBUTOR_ADMIN', 'PLATFORM_SUPPORT'],
        permissions: ['distributor:client:write', 'platform:distributor:read'],
        isPlatformSuperAdmin: false,
      },
      config,
    );
    const claims = await verifyAccessToken(token, config);
    expect(claims.sub).toBe('00000000-0000-4000-8000-000000000010');
    expect(claims.platform_id).toBe('00000000-0000-4000-8000-000000000001');
    expect(claims.distributor_id).toBe('00000000-0000-4000-8000-000000000020');
    expect(claims.client_id).toBeNull();
    expect(claims.roles).toEqual(['DISTRIBUTOR_ADMIN', 'PLATFORM_SUPPORT']);
    expect(claims.permissions).toEqual(['distributor:client:write', 'platform:distributor:read']);
    expect(claims.is_platform_super_admin).toBe(false);
    expect(typeof claims.jti).toBe('string');
    expect(claims.exp).toBeGreaterThan(claims.iat);
  });

  it('rechaza firma con secreto incorrecto', async () => {
    const token = await signAccessToken(
      {
        userId: '00000000-0000-4000-8000-000000000010',
        platformId: '00000000-0000-4000-8000-000000000001',
        distributorId: null,
        clientId: null,
        roles: [],
        permissions: [],
        isPlatformSuperAdmin: false,
      },
      config,
    );
    const otherConfig = loadIdentityConfig({ AUTH_SECRET: 'b'.repeat(48) } as unknown as NodeJS.ProcessEnv);
    await expect(verifyAccessToken(token, otherConfig)).rejects.toBeInstanceOf(TokenInvalidError);
  });

  it('rechaza token manipulado', async () => {
    const token = await signAccessToken(
      {
        userId: '00000000-0000-4000-8000-000000000010',
        platformId: '00000000-0000-4000-8000-000000000001',
        distributorId: null,
        clientId: null,
        roles: ['PLATFORM_SUPER_ADMIN'],
        permissions: ['*'],
        isPlatformSuperAdmin: true,
      },
      config,
    );
    const tampered = token.slice(0, -4) + 'AAAA';
    await expect(verifyAccessToken(tampered, config)).rejects.toBeInstanceOf(TokenInvalidError);
  });

  it('rechaza JWT expirado con TokenExpiredError', async () => {
    const expiredConfig = { ...config, accessTokenTtlSeconds: -10 };
    const token = await signAccessToken(
      {
        userId: '00000000-0000-4000-8000-000000000010',
        platformId: '00000000-0000-4000-8000-000000000001',
        distributorId: null,
        clientId: null,
        roles: [],
        permissions: [],
        isPlatformSuperAdmin: false,
      },
      expiredConfig,
    );
    await expect(verifyAccessToken(token, config)).rejects.toBeInstanceOf(TokenExpiredError);
  });
});