import type { TenantContext } from '@platform/contracts';

declare global {
  namespace Express {
    interface Request {
      tenantContext?: TenantContext;
    }
  }
}

export type AuthenticatedRequest = Express.Request & { tenantContext: TenantContext };
