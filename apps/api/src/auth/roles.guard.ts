import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
// Reflector must be a runtime value for DI
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../common/request.js';
import { ROLES_METADATA_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_METADATA_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }
    const req = context.switchToHttp().getRequest<Request>();
    const ctx = (req as AuthenticatedRequest).tenantContext;
    if (!ctx) {
      return false;
    }
    const hasAny = required.some((role) => ctx.roles.includes(role) || ctx.roles.includes('platform_super_admin'));
    if (!hasAny) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: `Required role: ${required.join(' | ')}`,
      });
    }
    return true;
  }
}
