export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export type RoleScope = 'PLATFORM' | 'DISTRIBUTOR' | 'CLIENT';

export type MfaMethodType = 'TOTP' | 'EMAIL' | 'SMS';
export type MfaMethodStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'DISABLED';

export interface UserRecord {
  id: string;
  platformId: string;
  email: string;
  emailNormalized: string;
  passwordHash: string;
  fullName: string | null;
  locale: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  lastLoginAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  passwordChangedAt: Date | null;
  mfaEnabled: boolean;
  isPlatformSuperAdmin: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RoleRecord {
  id: string;
  key: string;
  name: string;
  scope: RoleScope;
  isSystem: boolean;
}

export interface PermissionRecord {
  id: string;
  key: string;
  description: string | null;
}

export interface UserRoleRecord {
  id: string;
  userId: string;
  roleId: string;
  platformId: string;
  distributorId: string | null;
  clientId: string | null;
  isActive: boolean;
  grantedAt: Date;
  grantedBy: string | null;
  revokedAt: Date | null;
}

export interface UserRoleWithRole extends UserRoleRecord {
  role: RoleRecord;
  permissionKeys: string[];
}

export interface SessionRecord {
  id: string;
  userId: string;
  platformId: string;
  refreshTokenHash: string;
  userAgent: string | null;
  ipAddress: string | null;
  issuedAt: Date;
  lastUsedAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
  revokedReason: string | null;
  createdAt: Date;
}

export interface MfaMethodRecord {
  id: string;
  userId: string;
  type: MfaMethodType;
  status: MfaMethodStatus;
  secretEncrypted: string | null;
  destination: string | null;
  isPrimary: boolean;
  verifiedAt: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRepository {
  findById(id: string): Promise<UserRecord | null>;
  findByEmailNormalized(platformId: string, emailNormalized: string): Promise<UserRecord | null>;
  incrementFailedLogin(id: string): Promise<UserRecord>;
  resetFailedLogin(id: string, when: Date): Promise<void>;
  lockUntil(id: string, until: Date): Promise<void>;
  setLastLogin(id: string, when: Date): Promise<void>;
  setMfaEnabled(id: string, enabled: boolean): Promise<void>;
}

export interface UserRoleRepository {
  listActiveByUserId(userId: string): Promise<UserRoleWithRole[]>;
}

export interface SessionRepository {
  insert(input: Omit<SessionRecord, 'id' | 'createdAt' | 'lastUsedAt' | 'revokedAt' | 'revokedReason'>): Promise<SessionRecord>;
  findActiveByRefreshTokenHash(hash: string): Promise<SessionRecord | null>;
  revoke(id: string, reason: string, at: Date): Promise<void>;
  touch(id: string, at: Date): Promise<void>;
}

export interface MfaMethodRepository {
  insert(input: Omit<MfaMethodRecord, 'id' | 'createdAt' | 'updatedAt' | 'verifiedAt' | 'lastUsedAt'>): Promise<MfaMethodRecord>;
  findById(id: string): Promise<MfaMethodRecord | null>;
  findPrimaryActiveByUserId(userId: string): Promise<MfaMethodRecord | null>;
  activate(id: string, at: Date): Promise<void>;
  setLastUsed(id: string, at: Date): Promise<void>;
}

export interface RepositoryBundle {
  users: UserRepository;
  userRoles: UserRoleRepository;
  sessions: SessionRepository;
  mfaMethods: MfaMethodRepository;
}

export interface TransactionRunner {
  run<T>(fn: (tx: RepositoryBundle) => Promise<T>): Promise<T>;
}