export type IdentityErrorCode =
  | 'INVALID_CREDENTIALS'
  | 'USER_LOCKED'
  | 'USER_SUSPENDED'
  | 'USER_NOT_VERIFIED'
  | 'MFA_REQUIRED'
  | 'MFA_INVALID'
  | 'MFA_NOT_ENROLLED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'REFRESH_TOKEN_REUSE'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_REVOKED';

export class IdentityError extends Error {
  public readonly code: IdentityErrorCode;
  public readonly details?: Record<string, unknown>;

  constructor(code: IdentityErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'IdentityError';
    this.code = code;
    this.details = details;
  }
}

export class InvalidCredentialsError extends IdentityError {
  constructor(details?: Record<string, unknown>) {
    super('INVALID_CREDENTIALS', 'Email o contraseña inválidos.', details);
    this.name = 'InvalidCredentialsError';
  }
}

export class UserLockedError extends IdentityError {
  constructor(public readonly lockedUntil: Date) {
    super('USER_LOCKED', 'Cuenta bloqueada por demasiados intentos fallidos.', { lockedUntil: lockedUntil.toISOString() });
    this.name = 'UserLockedError';
  }
}

export class UserSuspendedError extends IdentityError {
  constructor() {
    super('USER_SUSPENDED', 'Cuenta suspendida.', undefined);
    this.name = 'UserSuspendedError';
  }
}

export class UserNotVerifiedError extends IdentityError {
  constructor() {
    super('USER_NOT_VERIFIED', 'Cuenta pendiente de verificación de email.', undefined);
    this.name = 'UserNotVerifiedError';
  }
}

export class MfaRequiredError extends IdentityError {
  constructor() {
    super('MFA_REQUIRED', 'Código MFA requerido.', undefined);
    this.name = 'MfaRequiredError';
  }
}

export class MfaInvalidError extends IdentityError {
  constructor() {
    super('MFA_INVALID', 'Código MFA inválido o expirado.', undefined);
    this.name = 'MfaInvalidError';
  }
}

export class MfaNotEnrolledError extends IdentityError {
  constructor() {
    super('MFA_NOT_ENROLLED', 'El usuario no tiene MFA enrolado.', undefined);
    this.name = 'MfaNotEnrolledError';
  }
}

export class TokenInvalidError extends IdentityError {
  constructor(message = 'Token inválido.') {
    super('TOKEN_INVALID', message, undefined);
    this.name = 'TokenInvalidError';
  }
}

export class TokenExpiredError extends IdentityError {
  constructor() {
    super('TOKEN_EXPIRED', 'Token expirado.', undefined);
    this.name = 'TokenExpiredError';
  }
}

export class RefreshTokenReuseError extends IdentityError {
  constructor() {
    super('REFRESH_TOKEN_REUSE', 'Refresh token reutilizado o revocado. Todas las sesiones del usuario fueron revocadas.', undefined);
    this.name = 'RefreshTokenReuseError';
  }
}

export class SessionNotFoundError extends IdentityError {
  constructor() {
    super('SESSION_NOT_FOUND', 'Sesión no encontrada.', undefined);
    this.name = 'SessionNotFoundError';
  }
}

export class SessionRevokedError extends IdentityError {
  constructor() {
    super('SESSION_REVOKED', 'Sesión revocada.', undefined);
    this.name = 'SessionRevokedError';
  }
}