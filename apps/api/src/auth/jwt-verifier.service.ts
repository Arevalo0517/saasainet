import { Inject, Injectable } from '@nestjs/common';
import { verifyAccessToken, type IdentityConfig, type JwtClaims } from '@platform/auth';
import { IDENTITY_CONFIG } from './auth.module.js';

@Injectable()
export class JwtVerifierService {
  private readonly config: IdentityConfig;

  constructor(@Inject(IDENTITY_CONFIG) config: IdentityConfig) {
    this.config = config;
  }

  async verify(token: string): Promise<JwtClaims> {
    return verifyAccessToken(token, this.config);
  }
}
