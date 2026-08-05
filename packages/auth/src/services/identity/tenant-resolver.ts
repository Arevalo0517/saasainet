import type { TenantContext } from '@platform/contracts';
import type { RepositoryBundle, RoleScope, UserRoleWithRole } from './repositories.js';

const SCOPE_PRIORITY: Record<RoleScope, number> = {
  CLIENT: 0,
  DISTRIBUTOR: 1,
  PLATFORM: 2,
};

export interface ResolveTenantContextInput {
  userId: string;
  isPlatformSuperAdmin: boolean;
}

export const resolveTenantContext = async (
  repos: RepositoryBundle,
  input: ResolveTenantContextInput,
): Promise<TenantContext> => {
  const activeRoles = (await repos.userRoles.listActiveByUserId(input.userId)).filter((ur) => ur.isActive);

  if (activeRoles.length === 0) {
    throw new Error(`El usuario ${input.userId} no tiene roles activos.`);
  }

  const sorted = [...activeRoles].sort((a, b) => {
    const pa = SCOPE_PRIORITY[a.role.scope];
    const pb = SCOPE_PRIORITY[b.role.scope];
    if (pa !== pb) return pa - pb;
    return b.grantedAt.getTime() - a.grantedAt.getTime();
  });

  const chosen = sorted[0]!;
  const roleKeys = sorted.map((ur) => ur.role.key);

  const permissionSet = new Set<string>();
  for (const ur of sorted) {
    for (const k of ur.permissionKeys) permissionSet.add(k);
  }
  const permissions = Array.from(permissionSet);

  return {
    platformId: chosen.platformId,
    distributorId: chosen.distributorId,
    clientId: chosen.clientId,
    userId: input.userId,
    roles: roleKeys,
    permissions,
    isSupportSession: false,
    correlationId: undefined,
  };
};

export const buildTenantContextFromRoles = (params: {
  userId: string;
  roles: UserRoleWithRole[];
  isPlatformSuperAdmin: boolean;
}): TenantContext => {
  const sorted = [...params.roles].sort((a, b) => {
    const pa = SCOPE_PRIORITY[a.role.scope];
    const pb = SCOPE_PRIORITY[b.role.scope];
    if (pa !== pb) return pa - pb;
    return b.grantedAt.getTime() - a.grantedAt.getTime();
  });

  const chosen = sorted[0]!;
  const roleKeys = sorted.map((ur) => ur.role.key);
  const permissionSet = new Set<string>();
  for (const ur of sorted) {
    for (const k of ur.permissionKeys) permissionSet.add(k);
  }

  return {
    platformId: chosen.platformId,
    distributorId: chosen.distributorId,
    clientId: chosen.clientId,
    userId: params.userId,
    roles: roleKeys,
    permissions: Array.from(permissionSet),
    isSupportSession: false,
    correlationId: undefined,
  };
};