import { ForbiddenException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
// Reflector must be a runtime value for DI
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { Reflector } from '@nestjs/core';
import { hasPermission, type Permission } from '@platform/auth';
import type { Request } from 'express';
import type { AuthenticatedRequest } from '../common/request.js';
import { PERMISSIONS_METADATA_KEY } from './permissions.decorator.js';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(PERMISSIONS_METADATA_KEY, [
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
    const allowed = required.every((perm: string) => hasPermission(ctx, perm as Permission));
    if (!allowed) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_PERMISSION',
        message: `Missing permission: ${required.join(', ')}`,
      });
    }
    return true;
  }
}
