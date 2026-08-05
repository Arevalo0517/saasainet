import { describe, it, expect } from 'vitest';
import { hasPermission, ROLE_PERMISSIONS, permissionsForRoles, PERMISSIONS } from '../src/permissions.js';

describe('permissions', () => {
  it('otorga permiso wildcard a super admin', () => {
    const ctx = {
      platformId: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      roles: ['PLATFORM_SUPER_ADMIN'],
      permissions: ['*'],
      isSupportSession: false,
    };
    expect(hasPermission(ctx, PERMISSIONS.PLATFORM_PAYOUT_WRITE)).toBe(true);
  });

  it('niega permiso a cliente read-only sobre facturación', () => {
    const ctx = {
      platformId: '00000000-0000-0000-0000-000000000001',
      distributorId: '00000000-0000-0000-0000-000000000003',
      clientId: '00000000-0000-0000-0000-000000000004',
      userId: '00000000-0000-0000-0000-000000000002',
      roles: ['CLIENT_READ_ONLY'],
      permissions: ROLE_PERMISSIONS.CLIENT_READ_ONLY,
      isSupportSession: false,
    };
    expect(hasPermission(ctx, PERMISSIONS.CLIENT_BILLING_WRITE)).toBe(false);
  });

  it('combina permisos de múltiples roles', () => {
    const perms = permissionsForRoles(['DISTRIBUTOR_SUPPORT', 'DISTRIBUTOR_ANALYST']);
    expect(perms).toContain(PERMISSIONS.DISTRIBUTOR_INBOX_READ);
    expect(perms).toContain(PERMISSIONS.DISTRIBUTOR_COMMISSION_READ);
  });
});
