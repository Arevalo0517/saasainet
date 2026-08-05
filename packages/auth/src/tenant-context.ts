import type { TenantContext } from '@platform/contracts';
import { TenantContextSchema } from '@platform/contracts';

export const createPlatformTenantContext = (params: {
  platformId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  isSupportSession?: boolean;
  correlationId?: string;
}): TenantContext => {
  return TenantContextSchema.parse({
    platformId: params.platformId,
    userId: params.userId,
    roles: params.roles,
    permissions: params.permissions,
    isSupportSession: params.isSupportSession ?? false,
    correlationId: params.correlationId,
  });
};

export const createDistributorTenantContext = (params: {
  platformId: string;
  distributorId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  isSupportSession?: boolean;
  correlationId?: string;
}): TenantContext => {
  return TenantContextSchema.parse({
    platformId: params.platformId,
    distributorId: params.distributorId,
    userId: params.userId,
    roles: params.roles,
    permissions: params.permissions,
    isSupportSession: params.isSupportSession ?? false,
    correlationId: params.correlationId,
  });
};

export const createClientTenantContext = (params: {
  platformId: string;
  distributorId: string;
  clientId: string;
  userId: string;
  roles: string[];
  permissions: string[];
  isSupportSession?: boolean;
  correlationId?: string;
}): TenantContext => {
  return TenantContextSchema.parse({
    platformId: params.platformId,
    distributorId: params.distributorId,
    clientId: params.clientId,
    userId: params.userId,
    roles: params.roles,
    permissions: params.permissions,
    isSupportSession: params.isSupportSession ?? false,
    correlationId: params.correlationId,
  });
};

export const canSeeOtherDistributors = (ctx: TenantContext): boolean => {
  return ctx.roles.includes('PLATFORM_SUPER_ADMIN') || ctx.roles.includes('PLATFORM_SUPPORT');
};

export const canSeeOtherClients = (ctx: TenantContext): boolean => {
  if (ctx.isSupportSession) return true;
  return ctx.roles.includes('PLATFORM_SUPER_ADMIN');
};
