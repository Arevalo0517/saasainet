import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, HttpException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
// IdentityService and the error classes are runtime values: DI token and instanceof checks.
import {
  IdentityService,
  InvalidCredentialsError,
  MfaInvalidError,
  MfaNotEnrolledError,
  MfaRequiredError,
  RefreshTokenReuseError,
  SessionNotFoundError,
  SessionRevokedError,
  TokenExpiredError,
  TokenInvalidError,
  UserLockedError,
  UserNotVerifiedError,
  UserSuspendedError,
  IdentityError,
} from '@platform/auth';
// DTOs are runtime values so emitDecoratorMetadata emits the class reference in __metadata('design:paramtypes').
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { LoginDto } from './dto/login.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { RefreshDto, LogoutDto } from './dto/refresh.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
import { VerifyMfaDto } from './dto/mfa.dto.js';

type TenantResponse = {
  platformId: string;
  distributorId: string | null;
  clientId: string | null;
  userId: string;
  roles: string[];
  permissions: string[];
  isSupportSession: boolean;
};

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  mfaRequired: boolean;
  tenant: TenantResponse;
};

type RefreshResponse = Omit<LoginResponse, 'mfaRequired'>;

const toTenantResponse = (t: {
  platformId: string;
  distributorId?: string | null;
  clientId?: string | null;
  userId: string;
  roles: string[];
  permissions: string[];
  isSupportSession: boolean;
}): TenantResponse => ({
  platformId: t.platformId,
  distributorId: t.distributorId ?? null,
  clientId: t.clientId ?? null,
  userId: t.userId,
  roles: t.roles,
  permissions: t.permissions,
  isSupportSession: t.isSupportSession,
});

const toLoginResponse = (r: {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  tenant: {
    platformId: string;
    distributorId?: string | null;
    clientId?: string | null;
    userId: string;
    roles: string[];
    permissions: string[];
    isSupportSession: boolean;
  };
  mfaRequired: boolean;
}): LoginResponse => ({
  accessToken: r.accessToken,
  refreshToken: r.refreshToken,
  refreshTokenExpiresAt: r.refreshTokenExpiresAt.toISOString(),
  mfaRequired: r.mfaRequired,
  tenant: toTenantResponse(r.tenant),
});

const toRefreshResponse = (r: {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  tenant: {
    platformId: string;
    distributorId?: string | null;
    clientId?: string | null;
    userId: string;
    roles: string[];
    permissions: string[];
    isSupportSession: boolean;
  };
}): RefreshResponse => ({
  accessToken: r.accessToken,
  refreshToken: r.refreshToken,
  refreshTokenExpiresAt: r.refreshTokenExpiresAt.toISOString(),
  tenant: toTenantResponse(r.tenant),
});

const ipFrom = (req: Request): string | null => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]?.trim() ?? null;
  }
  return req.ip ?? null;
};

const uaFrom = (req: Request): string | null => {
  const ua = req.headers['user-agent'];
  if (typeof ua === 'string' && ua.length > 0) return ua.slice(0, 500);
  return null;
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(@Inject(IdentityService) private readonly identity: IdentityService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login con email + password (opcional MFA)' })
  async login(@Body() dto: LoginDto, @Req() req: Request): Promise<LoginResponse> {
    try {
      const result = await this.identity.login({
        platformId: dto.platformId,
        email: dto.email,
        password: dto.password,
        mfaCode: dto.mfaCode,
        ipAddress: ipFrom(req),
        userAgent: uaFrom(req),
      });
      return toLoginResponse(result);
    } catch (err) {
      throw mapIdentityError(err);
    }
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rota refresh token y emite nuevo access+refresh' })
  async refresh(@Body() dto: RefreshDto, @Req() req: Request): Promise<RefreshResponse> {
    try {
      const result = await this.identity.refresh({
        refreshToken: dto.refreshToken,
        ipAddress: ipFrom(req),
        userAgent: uaFrom(req),
      });
      return toRefreshResponse(result);
    } catch (err) {
      throw mapIdentityError(err);
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoca la sesión del refresh token presentado' })
  async logout(@Body() dto: LogoutDto): Promise<void> {
    try {
      await this.identity.logout({ refreshToken: dto.refreshToken });
    } catch (err) {
      throw mapIdentityError(err);
    }
  }

  @Post('mfa/setup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Inicia setup de MFA TOTP (devuelve secret + otpauth URL)' })
  async mfaSetup(@Body() body: { userId: string; email: string }): Promise<{
    mfaMethodId: string;
    secret: string;
    otpAuthUrl: string;
  }> {
    return this.identity.setupMfa({ userId: body.userId, email: body.email });
  }

  @Post('mfa/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verifica código TOTP y activa método MFA' })
  async mfaVerify(@Body() dto: VerifyMfaDto): Promise<{ status: 'activated' }> {
    try {
      await this.identity.verifyMfaSetup({ mfaMethodId: dto.mfaMethodId, code: dto.code });
      return { status: 'activated' };
    } catch (err) {
      throw mapIdentityError(err);
    }
  }
}

const mapIdentityError = (err: unknown): HttpException => {
  if (err instanceof UserLockedError) {
    return new HttpException(
      { code: err.code, message: err.message, details: err.details },
      HttpStatus.FORBIDDEN,
    );
  }
  if (err instanceof UserSuspendedError || err instanceof UserNotVerifiedError) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.FORBIDDEN,
    );
  }
  if (err instanceof InvalidCredentialsError) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (err instanceof MfaRequiredError) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (err instanceof MfaInvalidError || err instanceof MfaNotEnrolledError) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (err instanceof TokenExpiredError) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (
    err instanceof TokenInvalidError ||
    err instanceof SessionNotFoundError ||
    err instanceof SessionRevokedError
  ) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (err instanceof RefreshTokenReuseError) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.UNAUTHORIZED,
    );
  }
  if (err instanceof IdentityError) {
    return new HttpException(
      { code: err.code, message: err.message },
      HttpStatus.BAD_REQUEST,
    );
  }
  if (err instanceof Error) {
    return new HttpException(
      { code: 'INTERNAL_ERROR', message: err.message },
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
  }
  return new HttpException(
    { code: 'INTERNAL_ERROR', message: 'Error desconocido' },
    HttpStatus.INTERNAL_SERVER_ERROR,
  );
};