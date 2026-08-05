import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { randomUUID } from 'node:crypto';
import type { IdentityConfig } from './config.js';
import { TokenExpiredError, TokenInvalidError } from './errors.js';

export interface JwtClaims {
  sub: string;
  platform_id: string;
  distributor_id: string | null;
  client_id: string | null;
  roles: string[];
  permissions: string[];
  is_platform_super_admin: boolean;
  jti: string;
  iat: number;
  exp: number;
}

export interface SignAccessTokenInput {
  userId: string;
  platformId: string;
  distributorId: string | null;
  clientId: string | null;
  roles: string[];
  permissions: string[];
  isPlatformSuperAdmin: boolean;
}

const encoder = new TextEncoder();

const toJoseSecret = (secret: string): Uint8Array => encoder.encode(secret);

export const signAccessToken = async (input: SignAccessTokenInput, config: IdentityConfig): Promise<string> => {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({
    platform_id: input.platformId,
    distributor_id: input.distributorId,
    client_id: input.clientId,
    roles: input.roles,
    permissions: input.permissions,
    is_platform_super_admin: input.isPlatformSuperAdmin,
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(input.userId)
    .setJti(randomUUID())
    .setIssuedAt(now)
    .setExpirationTime(now + config.accessTokenTtlSeconds)
    .setIssuer(config.issuer)
    .setAudience(config.issuer);
  return jwt.sign(toJoseSecret(config.authSecret));
};

export const verifyAccessToken = async (token: string, config: IdentityConfig): Promise<JwtClaims> => {
  let payload: JWTPayload;
  try {
    const result = await jwtVerify(token, toJoseSecret(config.authSecret), {
      issuer: config.issuer,
      audience: config.issuer,
      algorithms: ['HS256'],
    });
    payload = result.payload;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === 'ERR_JWT_EXPIRED') {
      throw new TokenExpiredError();
    }
    throw new TokenInvalidError();
  }

  const sub = payload.sub;
  const platformId = payload['platform_id'];
  const distributorId = payload['distributor_id'];
  const clientId = payload['client_id'];
  const roles = payload['roles'];
  const permissions = payload['permissions'];
  const isPlatformSuperAdmin = payload['is_platform_super_admin'];
  const jti = payload.jti;
  const iat = payload.iat;
  const exp = payload.exp;

  if (
    typeof sub !== 'string' ||
    typeof platformId !== 'string' ||
    !Array.isArray(roles) ||
    roles.some((r) => typeof r !== 'string') ||
    !Array.isArray(permissions) ||
    permissions.some((p) => typeof p !== 'string') ||
    typeof isPlatformSuperAdmin !== 'boolean' ||
    typeof jti !== 'string' ||
    typeof iat !== 'number' ||
    typeof exp !== 'number'
  ) {
    throw new TokenInvalidError();
  }

  return {
    sub,
    platform_id: platformId,
    distributor_id: typeof distributorId === 'string' ? distributorId : null,
    client_id: typeof clientId === 'string' ? clientId : null,
    roles: roles as string[],
    permissions: permissions as string[],
    is_platform_super_admin: isPlatformSuperAdmin,
    jti,
    iat,
    exp,
  };
};

export const accessTokenTtlSeconds = (config: IdentityConfig): number => config.accessTokenTtlSeconds;