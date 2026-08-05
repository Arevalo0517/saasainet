import { createHash, randomBytes } from 'node:crypto';
import type { RepositoryBundle } from './repositories.js';
import { RefreshTokenReuseError, SessionNotFoundError, SessionRevokedError } from './errors.js';

const REFRESH_TOKEN_BYTES = 48;

export const generateRefreshToken = (): string => {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
};

export const hashRefreshToken = (token: string): string => {
  return createHash('sha256').update(token, 'utf8').digest('hex');
};

export interface IssueSessionInput {
  userId: string;
  platformId: string;
  userAgent: string | null;
  ipAddress: string | null;
  ttlSeconds: number;
  now: Date;
}

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export const issueSession = async (repos: RepositoryBundle, input: IssueSessionInput): Promise<IssuedSession> => {
  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(input.now.getTime() + input.ttlSeconds * 1000);

  const session = await repos.sessions.insert({
    userId: input.userId,
    platformId: input.platformId,
    refreshTokenHash,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    issuedAt: input.now,
    expiresAt,
  });

  return { sessionId: session.id, refreshToken, refreshTokenHash, expiresAt };
};

export interface RotatedSession extends IssuedSession {
  rotatedFromSessionId: string;
  userId: string;
  platformId: string;
}

export const rotateSession = async (
  repos: RepositoryBundle,
  input: {
    presentedRefreshToken: string;
    userAgent: string | null;
    ipAddress: string | null;
    ttlSeconds: number;
    now: Date;
  },
): Promise<RotatedSession> => {
  const presentedHash = hashRefreshToken(input.presentedRefreshToken);
  const existing = await repos.sessions.findActiveByRefreshTokenHash(presentedHash);
  if (!existing) {
    throw new SessionNotFoundError();
  }
  if (existing.revokedAt !== null) {
    throw new SessionRevokedError();
  }
  if (existing.expiresAt.getTime() <= input.now.getTime()) {
    throw new RefreshTokenReuseError();
  }

  await repos.sessions.revoke(existing.id, 'ROTATED', input.now);

  const refreshToken = generateRefreshToken();
  const refreshTokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(input.now.getTime() + input.ttlSeconds * 1000);

  const session = await repos.sessions.insert({
    userId: existing.userId,
    platformId: existing.platformId,
    refreshTokenHash,
    userAgent: input.userAgent,
    ipAddress: input.ipAddress,
    issuedAt: input.now,
    expiresAt,
  });

  return {
    sessionId: session.id,
    refreshToken,
    refreshTokenHash,
    expiresAt,
    rotatedFromSessionId: existing.id,
    userId: existing.userId,
    platformId: existing.platformId,
  };
};

export const revokeSession = async (
  repos: RepositoryBundle,
  input: { presentedRefreshToken: string; reason: string; now: Date },
): Promise<void> => {
  const presentedHash = hashRefreshToken(input.presentedRefreshToken);
  const existing = await repos.sessions.findActiveByRefreshTokenHash(presentedHash);
  if (!existing) {
    throw new SessionNotFoundError();
  }
  if (existing.revokedAt === null) {
    await repos.sessions.revoke(existing.id, input.reason, input.now);
  }
};