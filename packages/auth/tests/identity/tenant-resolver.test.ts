import { describe, it, expect } from 'vitest';
import { resolveTenantContext, buildTenantContextFromRoles } from '../../src/services/identity/tenant-resolver.js';
import { createFakeRepos, createUserRole } from './fakes.js';

describe('tenant-resolver', () => {
  it('lanza error si el usuario no tiene roles activos', async () => {
    const repos = createFakeRepos();
    await expect(resolveTenantContext(repos, { userId: 'u1', isPlatformSuperAdmin: false })).rejects.toThrow();
  });

  it('prefiere CLIENT > DISTRIBUTOR > PLATFORM', async () => {
    const userId = '00000000-0000-4000-8000-000000000010';
    const repos = createFakeRepos({
      userRoles: [
        createUserRole({
          userId,
          role: {
            id: 'r-platform',
            key: 'platform_super_admin',
            name: 'Platform SA',
            scope: 'PLATFORM',
            isSystem: true,
          },
          distributorId: null,
          clientId: null,
          grantedAt: new Date('2025-01-01T00:00:00Z'),
          permissionKeys: ['platform:read'],
        }),
        createUserRole({
          userId,
          role: {
            id: 'r-distributor',
            key: 'distributor_owner',
            name: 'Dist Owner',
            scope: 'DISTRIBUTOR',
            isSystem: true,
          },
          distributorId: '00000000-0000-4000-8000-000000000020',
          clientId: null,
          grantedAt: new Date('2025-01-02T00:00:00Z'),
          permissionKeys: ['distributor:read'],
        }),
        createUserRole({
          userId,
          role: {
            id: 'r-client',
            key: 'client_owner',
            name: 'Client Owner',
            scope: 'CLIENT',
            isSystem: true,
          },
          distributorId: '00000000-0000-4000-8000-000000000020',
          clientId: '00000000-0000-4000-8000-000000000030',
          grantedAt: new Date('2025-01-03T00:00:00Z'),
          permissionKeys: ['client:read'],
        }),
      ],
    });

    const ctx = await resolveTenantContext(repos, { userId, isPlatformSuperAdmin: true });
    expect(ctx.clientId).toBe('00000000-0000-4000-8000-000000000030');
    expect(ctx.distributorId).toBe('00000000-0000-4000-8000-000000000020');
    expect(ctx.roles).toEqual(['client_owner', 'distributor_owner', 'platform_super_admin']);
    expect(ctx.permissions.sort()).toEqual(['client:read', 'distributor:read', 'platform:read']);
  });

  it('resuelve a DISTRIBUTOR cuando solo hay rol de distribuidor', async () => {
    const userId = '00000000-0000-4000-8000-000000000010';
    const repos = createFakeRepos({
      userRoles: [
        createUserRole({
          userId,
          role: {
            id: 'r1',
            key: 'distributor_admin',
            name: 'DA',
            scope: 'DISTRIBUTOR',
            isSystem: true,
          },
          distributorId: '00000000-0000-4000-8000-000000000020',
          clientId: null,
          permissionKeys: ['distributor:client:write'],
        }),
      ],
    });
    const ctx = await resolveTenantContext(repos, { userId, isPlatformSuperAdmin: false });
    expect(ctx.platformId).toBe('00000000-0000-4000-8000-000000000001');
    expect(ctx.distributorId).toBe('00000000-0000-4000-8000-000000000020');
    expect(ctx.clientId).toBeNull();
    expect(ctx.roles).toEqual(['distributor_admin']);
  });

  it('ignora roles inactivos', async () => {
    const userId = '00000000-0000-4000-8000-000000000010';
    const repos = createFakeRepos({
      userRoles: [
        createUserRole({
          userId,
          isActive: false,
          role: {
            id: 'r1',
            key: 'platform_super_admin',
            name: 'PSA',
            scope: 'PLATFORM',
            isSystem: true,
          },
          permissionKeys: [],
        }),
      ],
    });
    await expect(resolveTenantContext(repos, { userId, isPlatformSuperAdmin: true })).rejects.toThrow();
  });

  it('buildTenantContextFromRoles funciona sin repos', () => {
    const ctx = buildTenantContextFromRoles({
      userId: 'u1',
      isPlatformSuperAdmin: false,
      roles: [
        createUserRole({
          userId: 'u1',
          role: {
            id: 'r1',
            key: 'platform_super_admin',
            name: 'PSA',
            scope: 'PLATFORM',
            isSystem: true,
          },
          permissionKeys: ['*'],
        }),
      ],
    });
    expect(ctx.roles).toEqual(['platform_super_admin']);
  });
});