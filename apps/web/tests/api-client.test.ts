import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAccessToken, getTenant, persistSession, clearSession, type LoginResponse } from '../src/lib/api-client';

const fakeResponse: LoginResponse = {
  accessToken: 'eyJ.fake.token',
  refreshToken: 'fake-refresh-token',
  refreshTokenExpiresAt: '2026-12-31T00:00:00.000Z',
  mfaRequired: false,
  tenant: {
    platformId: 'f0000001-0000-4000-8000-000000000001',
    distributorId: null,
    clientId: null,
    userId: '11111111-1111-4000-8000-000000000001',
    roles: ['platform_super_admin'],
    permissions: ['*'],
    isSupportSession: false,
  },
};

describe('api-client session storage', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    window.localStorage.clear();
  });

  it('getAccessToken y getTenant devuelven null si no hay sesión', () => {
    expect(getAccessToken()).toBeNull();
    expect(getTenant()).toBeNull();
  });

  it('persistSession guarda token, refresh y tenant', () => {
    persistSession(fakeResponse);
    expect(getAccessToken()).toBe('eyJ.fake.token');
    const tenant = getTenant();
    expect(tenant).not.toBeNull();
    expect(tenant?.userId).toBe('11111111-1111-4000-8000-000000000001');
    expect(tenant?.roles).toContain('platform_super_admin');
  });

  it('clearSession borra todos los items', () => {
    persistSession(fakeResponse);
    clearSession();
    expect(getAccessToken()).toBeNull();
    expect(getTenant()).toBeNull();
  });
});
