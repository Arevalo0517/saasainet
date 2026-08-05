export interface IdentityConfig {
  authSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  maxFailedLoginAttempts: number;
  lockoutSeconds: number;
  issuer: string;
}

const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS = 5;
const DEFAULT_LOCKOUT_SECONDS = 900;
const DEFAULT_ISSUER = 'plataforma-saas-chatbots';

const requireSecret = (raw: string | undefined): string => {
  if (!raw || raw.length < 32) {
    throw new Error('AUTH_SECRET debe estar definido y tener al menos 32 caracteres.');
  }
  return raw;
};

const parsePositiveInt = (raw: string | undefined, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
};

export const loadIdentityConfig = (env: NodeJS.ProcessEnv = process.env): IdentityConfig => {
  return {
    authSecret: requireSecret(env.AUTH_SECRET),
    accessTokenTtlSeconds: parsePositiveInt(env.AUTH_ACCESS_TOKEN_TTL_SECONDS, DEFAULT_ACCESS_TOKEN_TTL_SECONDS),
    refreshTokenTtlSeconds: (() => {
      if (!env.AUTH_SESSION_DAYS) return DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
      const days = Number(env.AUTH_SESSION_DAYS);
      if (!Number.isFinite(days) || days <= 0) return DEFAULT_REFRESH_TOKEN_TTL_SECONDS;
      return days * 24 * 60 * 60;
    })(),
    maxFailedLoginAttempts: parsePositiveInt(env.AUTH_MAX_FAILED_LOGIN_ATTEMPTS, DEFAULT_MAX_FAILED_LOGIN_ATTEMPTS),
    lockoutSeconds: parsePositiveInt(env.AUTH_LOCKOUT_SECONDS, DEFAULT_LOCKOUT_SECONDS),
    issuer: env.AUTH_ISSUER ?? DEFAULT_ISSUER,
  };
};