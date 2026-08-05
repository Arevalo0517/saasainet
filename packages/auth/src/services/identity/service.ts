import type { TenantContext } from '@platform/contracts';
import type { IdentityConfig } from './config.js';
import {
  InvalidCredentialsError,
  MfaInvalidError,
  MfaNotEnrolledError,
  MfaRequiredError,
  UserLockedError,
  UserNotVerifiedError,
  UserSuspendedError,
} from './errors.js';
import { hashPassword, verifyPassword } from './passwords.js';
import { signAccessToken, verifyAccessToken } from './tokens.js';
import { issueSession, revokeSession, rotateSession, type IssuedSession } from './refresh-tokens.js';
import { resolveTenantContext } from './tenant-resolver.js';
import {
  buildOtpAuthUrl,
  decryptMfaSecret,
  encryptMfaSecret,
  generateTotpSecret,
  verifyTotp,
} from './mfa.js';
import type { RepositoryBundle, MfaMethodRecord, UserRecord } from './repositories.js';

export interface IdentityServiceDeps {
  config: IdentityConfig;
  repos: RepositoryBundle;
  clock?: () => Date;
}

export interface LoginInput {
  platformId: string;
  email: string;
  password: string;
  userAgent: string | null;
  ipAddress: string | null;
  mfaCode?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  tenant: TenantContext;
  mfaRequired: boolean;
}

export interface RefreshInput {
  refreshToken: string;
  userAgent: string | null;
  ipAddress: string | null;
}

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  tenant: TenantContext;
}

export interface LogoutInput {
  refreshToken: string;
}

export interface SetupMfaInput {
  userId: string;
  email: string;
}

export interface SetupMfaResult {
  mfaMethodId: string;
  secret: string;
  otpAuthUrl: string;
}

export interface VerifyMfaSetupInput {
  mfaMethodId: string;
  code: string;
}

export class IdentityService {
  private readonly config: IdentityConfig;
  private readonly repos: RepositoryBundle;
  private readonly clock: () => Date;

  constructor(deps: IdentityServiceDeps) {
    this.config = deps.config;
    this.repos = deps.repos;
    this.clock = deps.clock ?? (() => new Date());
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const emailNormalized = input.email.trim().toLowerCase();
    const user = await this.repos.users.findByEmailNormalized(input.platformId, emailNormalized);
    if (!user) {
      throw new InvalidCredentialsError();
    }

    if (user.lockedUntil !== null && user.lockedUntil.getTime() > this.clock().getTime()) {
      throw new UserLockedError(user.lockedUntil);
    }

    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new UserSuspendedError();
    }

    if (user.status === 'PENDING_VERIFICATION') {
      throw new UserNotVerifiedError();
    }

    const passwordOk = await verifyPassword(user.passwordHash, input.password);
    if (!passwordOk) {
      const updated = await this.repos.users.incrementFailedLogin(user.id);
      if (updated.failedLoginAttempts >= this.config.maxFailedLoginAttempts) {
        const lockUntil = new Date(this.clock().getTime() + this.config.lockoutSeconds * 1000);
        await this.repos.users.lockUntil(user.id, lockUntil);
        throw new UserLockedError(lockUntil);
      }
      throw new InvalidCredentialsError();
    }

    const tenant = await resolveTenantContext(this.repos, {
      userId: user.id,
      isPlatformSuperAdmin: user.isPlatformSuperAdmin,
    });

    if (user.mfaEnabled) {
      if (!input.mfaCode) {
        throw new MfaRequiredError();
      }
      const mfa = await this.repos.mfaMethods.findPrimaryActiveByUserId(user.id);
      if (!mfa || mfa.secretEncrypted === null) {
        throw new MfaNotEnrolledError();
      }
      const secret = decryptMfaSecret(mfa.secretEncrypted, this.config.authSecret);
      const ok = verifyTotp(secret, input.mfaCode, { now: this.clock() });
      if (!ok) {
        throw new MfaInvalidError();
      }
      await this.repos.mfaMethods.setLastUsed(mfa.id, this.clock());
    }

    await this.repos.users.resetFailedLogin(user.id, this.clock());
    await this.repos.users.setLastLogin(user.id, this.clock());

    const session = await issueSession(this.repos, {
      userId: user.id,
      platformId: user.platformId,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      ttlSeconds: this.config.refreshTokenTtlSeconds,
      now: this.clock(),
    });

    const accessToken = await signAccessToken(
      {
        userId: user.id,
        platformId: user.platformId,
        distributorId: tenant.distributorId ?? null,
        clientId: tenant.clientId ?? null,
        roles: tenant.roles,
        permissions: tenant.permissions,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      },
      this.config,
    );

    return {
      accessToken,
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
      tenant,
      mfaRequired: user.mfaEnabled && !input.mfaCode,
    };
  }

  async refresh(input: RefreshInput): Promise<RefreshResult> {
    const rotated = await rotateSession(this.repos, {
      presentedRefreshToken: input.refreshToken,
      userAgent: input.userAgent,
      ipAddress: input.ipAddress,
      ttlSeconds: this.config.refreshTokenTtlSeconds,
      now: this.clock(),
    });

    const user = await this.repos.users.findById(rotated.userId);
    if (!user) {
      throw new InvalidCredentialsError();
    }
    if (user.status === 'SUSPENDED' || user.status === 'DEACTIVATED') {
      throw new UserSuspendedError();
    }
    const tenant = await resolveTenantContext(this.repos, {
      userId: user.id,
      isPlatformSuperAdmin: user.isPlatformSuperAdmin,
    });

    const accessToken = await signAccessToken(
      {
        userId: user.id,
        platformId: user.platformId,
        distributorId: tenant.distributorId ?? null,
        clientId: tenant.clientId ?? null,
        roles: tenant.roles,
        permissions: tenant.permissions,
        isPlatformSuperAdmin: user.isPlatformSuperAdmin,
      },
      this.config,
    );

    return {
      accessToken,
      refreshToken: rotated.refreshToken,
      refreshTokenExpiresAt: rotated.expiresAt,
      tenant,
    };
  }

  async logout(input: LogoutInput): Promise<void> {
    await revokeSession(this.repos, {
      presentedRefreshToken: input.refreshToken,
      reason: 'LOGOUT',
      now: this.clock(),
    });
  }

  async verifyAccessTokenForRequest(token: string): Promise<TenantContext> {
    const claims = await verifyAccessToken(token, this.config);
    return {
      platformId: claims.platform_id,
      distributorId: claims.distributor_id,
      clientId: claims.client_id,
      userId: claims.sub,
      roles: claims.roles,
      permissions: claims.permissions,
      isSupportSession: false,
      correlationId: undefined,
    };
  }

  async setupMfa(input: SetupMfaInput): Promise<SetupMfaResult> {
    const secret = generateTotpSecret();
    const encrypted = encryptMfaSecret(secret, this.config.authSecret);
    const mfa = await this.repos.mfaMethods.insert({
      userId: input.userId,
      type: 'TOTP',
      status: 'PENDING_VERIFICATION',
      secretEncrypted: encrypted,
      destination: null,
      isPrimary: true,
    });
    const otpAuthUrl = buildOtpAuthUrl({
      email: input.email,
      secret,
      issuer: this.config.issuer,
    });
    return { mfaMethodId: mfa.id, secret, otpAuthUrl };
  }

  async verifyMfaSetup(input: VerifyMfaSetupInput): Promise<void> {
    const mfa = await this.repos.mfaMethods.findById(input.mfaMethodId);
    if (!mfa || mfa.secretEncrypted === null) {
      throw new MfaNotEnrolledError();
    }
    const secret = decryptMfaSecret(mfa.secretEncrypted, this.config.authSecret);
    const ok = verifyTotp(secret, input.code, { now: this.clock() });
    if (!ok) {
      throw new MfaInvalidError();
    }
    await this.repos.mfaMethods.activate(mfa.id, this.clock());
    await this.repos.mfaMethods.setLastUsed(mfa.id, this.clock());
    await this.repos.users.setMfaEnabled(mfa.userId, true);
  }
}

export const hashPasswordForSeed = hashPassword;
export type { MfaMethodRecord, UserRecord, IssuedSession };