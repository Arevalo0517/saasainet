import { Injectable, UnauthorizedException, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { TenantContextSchema } from '@platform/contracts';
// JwtVerifierService must be a runtime value for DI
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { JwtVerifierService } from './jwt-verifier.service.js';

const BEARER_PREFIX = 'Bearer ';
const ACCESS_TOKEN_COOKIE = 'access_token';

const extractToken = (req: Request): string | null => {
  const header = req.headers.authorization;
  if (typeof header === 'string' && header.startsWith(BEARER_PREFIX) && header.length > BEARER_PREFIX.length) {
    return header.slice(BEARER_PREFIX.length).trim();
  }
  const cookieHeader = req.headers.cookie;
  if (typeof cookieHeader === 'string' && cookieHeader.length > 0) {
    for (const part of cookieHeader.split(';')) {
      const [rawName, ...rest] = part.trim().split('=');
      if (rawName === ACCESS_TOKEN_COOKIE && rest.length > 0) {
        return decodeURIComponent(rest.join('='));
      }
    }
  }
  return null;
};

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly verifier: JwtVerifierService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const token = extractToken(req);
    if (token === null) {
      next();
      return;
    }
    try {
      const claims = await this.verifier.verify(token);
      const ctx = TenantContextSchema.parse({
        platformId: claims.platform_id,
        distributorId: claims.distributor_id,
        clientId: claims.client_id,
        userId: claims.sub,
        roles: claims.roles,
        permissions: claims.permissions,
        isSupportSession: false,
        correlationId:
          typeof req.headers['x-correlation-id'] === 'string'
            ? (req.headers['x-correlation-id'] as string)
            : undefined,
      });
      req.tenantContext = ctx;
      next();
    } catch (err) {
      next(new UnauthorizedException({ code: 'UNAUTHENTICATED', message: (err as Error).message }));
    }
  }
}
