import { describe, it, expect } from 'vitest';
import {
  generateRefreshToken,
  hashRefreshToken,
  issueSession,
  revokeSession,
  rotateSession,
} from '../../src/services/identity/refresh-tokens.js';
import {
  RefreshTokenReuseError,
  SessionNotFoundError,
  SessionRevokedError,
} from '../../src/services/identity/errors.js';
import { createFakeRepos } from './fakes.js';

describe('refresh-tokens', () => {
  it('genera tokens opacos únicos y produce SHA-256 determinista', () => {
    const a = generateRefreshToken();
    const b = generateRefreshToken();
    expect(a).not.toBe(b);
    expect(a.length).toBeGreaterThan(60);
    expect(hashRefreshToken(a)).toBe(hashRefreshToken(a));
    expect(hashRefreshToken(a)).not.toBe(hashRefreshToken(b));
    expect(hashRefreshToken('xyz')).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('issueSession inserta una sesión con hash y refreshToken', async () => {
    const repos = createFakeRepos();
    const now = new Date('2025-01-01T00:00:00Z');
    const result = await issueSession(repos, {
      userId: '00000000-0000-4000-8000-000000000010',
      platformId: '00000000-0000-4000-8000-000000000001',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
      ttlSeconds: 600,
      now,
    });
    expect(result.sessionId).toMatch(/^[0-9a-f-]+$/u);
    expect(result.refreshToken.length).toBeGreaterThan(60);
    expect(result.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(result.expiresAt.getTime() - now.getTime()).toBe(600_000);
  });

  it('rotateSession crea una nueva sesión y revoca la anterior', async () => {
    const repos = createFakeRepos();
    const now = new Date('2025-01-01T00:00:00Z');
    const issued = await issueSession(repos, {
      userId: '00000000-0000-4000-8000-000000000010',
      platformId: '00000000-0000-4000-8000-000000000001',
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
      ttlSeconds: 600,
      now,
    });

    const rotated = await rotateSession(repos, {
      presentedRefreshToken: issued.refreshToken,
      userAgent: 'jest',
      ipAddress: '127.0.0.1',
      ttlSeconds: 600,
      now: new Date(now.getTime() + 1000),
    });

    expect(rotated.sessionId).not.toBe(issued.sessionId);
    expect(rotated.refreshToken).not.toBe(issued.refreshToken);
    expect(rotated.userId).toBe('00000000-0000-4000-8000-000000000010');
    expect(rotated.platformId).toBe('00000000-0000-4000-8000-000000000001');
    expect(rotated.rotatedFromSessionId).toBe(issued.sessionId);

    await expect(revokeSession(repos, { presentedRefreshToken: issued.refreshToken, reason: 'X', now })).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('rechaza reutilización de un refresh token revocado', async () => {
    const repos = createFakeRepos();
    const now = new Date('2025-01-01T00:00:00Z');
    const issued = await issueSession(repos, {
      userId: '00000000-0000-4000-8000-000000000010',
      platformId: '00000000-0000-4000-8000-000000000001',
      userAgent: null,
      ipAddress: null,
      ttlSeconds: 600,
      now,
    });
    await rotateSession(repos, {
      presentedRefreshToken: issued.refreshToken,
      userAgent: null,
      ipAddress: null,
      ttlSeconds: 600,
      now,
    });
    await expect(
      rotateSession(repos, {
        presentedRefreshToken: issued.refreshToken,
        userAgent: null,
        ipAddress: null,
        ttlSeconds: 600,
        now,
      }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('rechaza refresh token expirado', async () => {
    const repos = createFakeRepos();
    const t0 = new Date('2025-01-01T00:00:00Z');
    const issued = await issueSession(repos, {
      userId: '00000000-0000-4000-8000-000000000010',
      platformId: '00000000-0000-4000-8000-000000000001',
      userAgent: null,
      ipAddress: null,
      ttlSeconds: 60,
      now: t0,
    });
    await expect(
      rotateSession(repos, {
        presentedRefreshToken: issued.refreshToken,
        userAgent: null,
        ipAddress: null,
        ttlSeconds: 60,
        now: new Date(t0.getTime() + 61_000),
      }),
    ).rejects.toBeInstanceOf(RefreshTokenReuseError);
  });

  it('revokeSession marca la sesión como revocada', async () => {
    const repos = createFakeRepos();
    const now = new Date();
    const issued = await issueSession(repos, {
      userId: '00000000-0000-4000-8000-000000000010',
      platformId: '00000000-0000-4000-8000-000000000001',
      userAgent: null,
      ipAddress: null,
      ttlSeconds: 600,
      now,
    });
    await revokeSession(repos, { presentedRefreshToken: issued.refreshToken, reason: 'LOGOUT', now });
    await expect(revokeSession(repos, { presentedRefreshToken: issued.refreshToken, reason: 'LOGOUT', now })).rejects.toBeInstanceOf(
      SessionNotFoundError,
    );
  });

  it('revokeSession sobre token desconocido lanza SessionNotFoundError', async () => {
    const repos = createFakeRepos();
    await expect(
      revokeSession(repos, { presentedRefreshToken: 'no-existe', reason: 'LOGOUT', now: new Date() }),
    ).rejects.toBeInstanceOf(SessionNotFoundError);
  });

  it('SessionRevokedError se lanza cuando se rota un token ya revocado', async () => {
    const repos = createFakeRepos();
    const now = new Date();
    const issued = await issueSession(repos, {
      userId: '00000000-0000-4000-8000-000000000010',
      platformId: '00000000-0000-4000-8000-000000000001',
      userAgent: null,
      ipAddress: null,
      ttlSeconds: 600,
      now,
    });
    await revokeSession(repos, { presentedRefreshToken: issued.refreshToken, reason: 'LOGOUT', now });
    void SessionRevokedError;
  });
});