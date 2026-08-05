import { createHash } from 'node:crypto';
import type {
  MfaMethodRecord,
  RepositoryBundle,
  SessionRecord,
  UserRecord,
  UserRoleWithRole,
} from '../../src/services/identity/repositories.js';

let idCounter = 0;
const nextId = (): string => {
  idCounter += 1;
  const hex = idCounter.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
};

export const createUser = (overrides: Partial<UserRecord> = {}): UserRecord => ({
  id: nextId(),
  platformId: '00000000-0000-4000-8000-000000000001',
  email: 'user@example.test',
  emailNormalized: 'user@example.test',
  passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$U8ILbn8BNhXbsSAO75Rw7w$n/Bs5eF732qhZwZwrK5KmT8IKXacjHUMQwIkORYGI0g',
  fullName: 'Test User',
  locale: 'es',
  status: 'ACTIVE',
  emailVerifiedAt: new Date('2025-01-01T00:00:00Z'),
  lastLoginAt: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  passwordChangedAt: new Date('2025-01-01T00:00:00Z'),
  mfaEnabled: false,
  isPlatformSuperAdmin: false,
  createdAt: new Date('2025-01-01T00:00:00Z'),
  updatedAt: new Date('2025-01-01T00:00:00Z'),
  ...overrides,
});

export const createUserRole = (overrides: Partial<UserRoleWithRole> = {}): UserRoleWithRole => ({
  id: nextId(),
  userId: '00000000-0000-4000-8000-000000000010',
  roleId: '00000000-0000-4000-8000-000000000020',
  platformId: '00000000-0000-4000-8000-000000000001',
  distributorId: null,
  clientId: null,
  isActive: true,
  grantedAt: new Date('2025-01-01T00:00:00Z'),
  grantedBy: null,
  revokedAt: null,
  role: {
    id: '00000000-0000-4000-8000-000000000020',
    key: 'platform_super_admin',
    name: 'Platform Super Admin',
    scope: 'PLATFORM',
    isSystem: true,
  },
  permissionKeys: ['platform:read'],
  ...overrides,
});

export const createFakeRepos = (initial: {
  users?: UserRecord[];
  userRoles?: UserRoleWithRole[];
  sessions?: SessionRecord[];
  mfaMethods?: MfaMethodRecord[];
} = {}): RepositoryBundle => {
  const users = new Map<string, UserRecord>();
  for (const u of initial.users ?? []) users.set(u.id, { ...u });

  const userRoles = [...(initial.userRoles ?? [])];

  const sessions = new Map<string, SessionRecord>();
  const sessionsByHash = new Map<string, string>();
  for (const s of initial.sessions ?? []) {
    sessions.set(s.id, { ...s });
    sessionsByHash.set(s.refreshTokenHash, s.id);
  }

  const mfaMethods = new Map<string, MfaMethodRecord>();
  for (const m of initial.mfaMethods ?? []) mfaMethods.set(m.id, { ...m });

  return {
    users: {
      findById: async (id) => users.get(id) ?? null,
      findByEmailNormalized: async (platformId, emailNormalized) => {
        for (const u of users.values()) {
          if (u.platformId === platformId && u.emailNormalized === emailNormalized) return u;
        }
        return null;
      },
      incrementFailedLogin: async (id) => {
        const u = users.get(id);
        if (!u) throw new Error(`user ${id} no existe`);
        const updated: UserRecord = { ...u, failedLoginAttempts: u.failedLoginAttempts + 1 };
        users.set(id, updated);
        return updated;
      },
      resetFailedLogin: async (id, when) => {
        const u = users.get(id);
        if (!u) return;
        users.set(id, { ...u, failedLoginAttempts: 0, lockedUntil: null, updatedAt: when });
      },
      lockUntil: async (id, until) => {
        const u = users.get(id);
        if (!u) return;
        users.set(id, { ...u, lockedUntil: until, updatedAt: new Date() });
      },
      setLastLogin: async (id, when) => {
        const u = users.get(id);
        if (!u) return;
        users.set(id, { ...u, lastLoginAt: when, updatedAt: when });
      },
      setMfaEnabled: async (id, enabled) => {
        const u = users.get(id);
        if (!u) return;
        users.set(id, { ...u, mfaEnabled: enabled, updatedAt: new Date() });
      },
    },
    userRoles: {
      listActiveByUserId: async (userId) => userRoles.filter((ur) => ur.userId === userId),
    },
    sessions: {
      insert: async (input) => {
        const id = nextId();
        const session: SessionRecord = {
          id,
          createdAt: new Date(),
          lastUsedAt: new Date(),
          revokedAt: null,
          revokedReason: null,
          ...input,
        };
        sessions.set(id, session);
        sessionsByHash.set(session.refreshTokenHash, id);
        return session;
      },
      findActiveByRefreshTokenHash: async (hash) => {
        const id = sessionsByHash.get(hash);
        if (!id) return null;
        const s = sessions.get(id);
        if (!s) return null;
        if (s.revokedAt !== null) return null;
        return s;
      },
      revoke: async (id, reason, at) => {
        const s = sessions.get(id);
        if (!s) return;
        sessions.set(id, { ...s, revokedAt: at, revokedReason: reason });
        sessionsByHash.delete(s.refreshTokenHash);
      },
      touch: async (id, at) => {
        const s = sessions.get(id);
        if (!s) return;
        sessions.set(id, { ...s, lastUsedAt: at });
      },
    },
    mfaMethods: {
      insert: async (input) => {
        const id = nextId();
        const record: MfaMethodRecord = {
          id,
          createdAt: new Date(),
          updatedAt: new Date(),
          verifiedAt: null,
          lastUsedAt: null,
          ...input,
        };
        mfaMethods.set(id, record);
        return record;
      },
      findById: async (id) => mfaMethods.get(id) ?? null,
      findPrimaryActiveByUserId: async (userId) => {
        for (const m of mfaMethods.values()) {
          if (m.userId === userId && m.isPrimary && m.status === 'ACTIVE') return m;
        }
        return null;
      },
      activate: async (id, at) => {
        const m = mfaMethods.get(id);
        if (!m) return;
        mfaMethods.set(id, { ...m, status: 'ACTIVE', verifiedAt: at, updatedAt: at });
      },
      setLastUsed: async (id, at) => {
        const m = mfaMethods.get(id);
        if (!m) return;
        mfaMethods.set(id, { ...m, lastUsedAt: at, updatedAt: at });
      },
    },
  };
};

export const sha256Hex = (input: string): string =>
  createHash('sha256').update(input, 'utf8').digest('hex');