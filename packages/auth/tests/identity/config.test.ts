import { describe, it, expect } from 'vitest';
import { loadIdentityConfig } from '../../src/services/identity/config.js';

describe('identity config', () => {
  it('lee AUTH_SECRET y aplica defaults razonables', () => {
    const cfg = loadIdentityConfig({
      AUTH_SECRET: 'a'.repeat(48),
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.authSecret).toBe('a'.repeat(48));
    expect(cfg.accessTokenTtlSeconds).toBe(900);
    expect(cfg.refreshTokenTtlSeconds).toBe(7 * 24 * 60 * 60);
    expect(cfg.maxFailedLoginAttempts).toBe(5);
    expect(cfg.lockoutSeconds).toBe(900);
    expect(cfg.issuer).toBe('plataforma-saas-chatbots');
  });

  it('deriva TTL de refresh desde AUTH_SESSION_DAYS', () => {
    const cfg = loadIdentityConfig({
      AUTH_SECRET: 'a'.repeat(48),
      AUTH_SESSION_DAYS: '14',
    } as unknown as NodeJS.ProcessEnv);
    expect(cfg.refreshTokenTtlSeconds).toBe(14 * 24 * 60 * 60);
  });

  it('rechaza AUTH_SECRET ausente o corto', () => {
    expect(() => loadIdentityConfig({} as unknown as NodeJS.ProcessEnv)).toThrow();
    expect(() =>
      loadIdentityConfig({ AUTH_SECRET: 'short' } as unknown as NodeJS.ProcessEnv),
    ).toThrow();
  });
});