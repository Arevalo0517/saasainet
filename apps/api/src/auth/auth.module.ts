import { Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Database } from '@platform/db';
import {
  IdentityService,
  loadIdentityConfig,
  type IdentityConfig,
  type RepositoryBundle,
} from '@platform/auth';
import { createDrizzleRepositories } from '../infrastructure/persistence/drizzle/repositories.factory.js';
import { DATABASE } from '../infrastructure/database/database.module.js';
import { AuthController } from './auth.controller.js';
import { JwtVerifierService } from './jwt-verifier.service.js';
import { TenantContextMiddleware } from './tenant-context.middleware.js';

export const IDENTITY_CONFIG = Symbol('IDENTITY_CONFIG');
export const REPOSITORY_BUNDLE = Symbol('REPOSITORY_BUNDLE');

export { JwtVerifierService, TenantContextMiddleware };

const jwtVerifierProvider: Provider = {
  provide: JwtVerifierService,
  inject: [IDENTITY_CONFIG],
  useFactory: (config: IdentityConfig): JwtVerifierService => new JwtVerifierService(config),
};

const identityConfigProvider: Provider = {
  provide: IDENTITY_CONFIG,
  inject: [ConfigService],
  useFactory: (config: ConfigService): IdentityConfig => {
    const get = (key: string): string | undefined => {
      const v = config.get<string>(key);
      if (v !== undefined) return v;
      return process.env[key];
    };
    return loadIdentityConfig({
      AUTH_SECRET: get('AUTH_SECRET'),
      AUTH_ACCESS_TOKEN_TTL_SECONDS: get('AUTH_ACCESS_TOKEN_TTL_SECONDS'),
      AUTH_SESSION_DAYS: get('AUTH_SESSION_DAYS'),
      AUTH_MAX_FAILED_LOGIN_ATTEMPTS: get('AUTH_MAX_FAILED_LOGIN_ATTEMPTS'),
      AUTH_LOCKOUT_SECONDS: get('AUTH_LOCKOUT_SECONDS'),
      AUTH_ISSUER: get('AUTH_ISSUER'),
    } as unknown as NodeJS.ProcessEnv);
  },
};

const repositoriesProvider: Provider = {
  provide: REPOSITORY_BUNDLE,
  inject: [DATABASE],
  useFactory: (db: Database): RepositoryBundle => createDrizzleRepositories(db),
};

const identityServiceProvider: Provider = {
  provide: IdentityService,
  inject: [IDENTITY_CONFIG, REPOSITORY_BUNDLE],
  useFactory: (cfg: IdentityConfig, repos: RepositoryBundle): IdentityService =>
    new IdentityService({ config: cfg, repos }),
};

@Module({
  providers: [identityConfigProvider, repositoriesProvider, identityServiceProvider, jwtVerifierProvider, TenantContextMiddleware],
  controllers: [AuthController],
  exports: [IdentityService, IDENTITY_CONFIG, REPOSITORY_BUNDLE, JwtVerifierService, TenantContextMiddleware],
})
export class AuthModule {}