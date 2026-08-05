import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { Database } from '@platform/db';
import {
  permissions,
  rolePermissions,
  roles,
  userRoles,
  type Role as DbRole,
  type UserRole as DbUserRole,
} from '@platform/db';
import type {
  RoleRecord,
  UserRoleRepository,
  UserRoleWithRole,
} from '@platform/auth';

const toRoleRecord = (row: DbRole): RoleRecord => ({
  id: row.id,
  key: row.key,
  name: row.name,
  scope: row.scope,
  isSystem: row.isSystem === '1',
});

export class DrizzleUserRoleRepository implements UserRoleRepository {
  constructor(private readonly db: Database) {}

  async listActiveByUserId(userId: string): Promise<UserRoleWithRole[]> {
    const joined = await this.db
      .select({ ur: userRoles, role: roles })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(and(eq(userRoles.userId, userId), eq(userRoles.isActive, true), isNull(userRoles.revokedAt)));

    if (joined.length === 0) return [];

    const roleIds = Array.from(new Set(joined.map((j) => j.role.id)));
    const permRows = await this.db
      .select({ roleId: rolePermissions.roleId, key: permissions.key })
      .from(rolePermissions)
      .innerJoin(permissions, eq(permissions.id, rolePermissions.permissionId))
      .where(inArray(rolePermissions.roleId, roleIds));

    const permsByRole = new Map<string, string[]>();
    for (const p of permRows) {
      const arr = permsByRole.get(p.roleId) ?? [];
      arr.push(p.key);
      permsByRole.set(p.roleId, arr);
    }

    return joined.map(({ ur, role }) => this.toUserRoleWithRole(ur, role, permsByRole));
  }

  private toUserRoleWithRole(
    ur: DbUserRole,
    role: DbRole,
    permsByRole: Map<string, string[]>,
  ): UserRoleWithRole {
    return {
      id: ur.id,
      userId: ur.userId,
      roleId: ur.roleId,
      platformId: ur.platformId,
      distributorId: ur.distributorId,
      clientId: ur.clientId,
      isActive: ur.isActive,
      grantedAt: ur.grantedAt,
      grantedBy: ur.grantedBy,
      revokedAt: ur.revokedAt,
      role: toRoleRecord(role),
      permissionKeys: permsByRole.get(role.id) ?? [],
    };
  }
}