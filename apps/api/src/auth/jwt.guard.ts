import { Injectable, UnauthorizedException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../common/request.js';

@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const tenantContext = (req as AuthenticatedRequest).tenantContext;
    if (!tenantContext) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Missing or invalid token' });
    }
    return true;
  }
}
