import type { Database } from '@platform/db';
import type { RepositoryBundle } from '@platform/auth';
import { DrizzleUserRepository } from './user.repository.js';
import { DrizzleUserRoleRepository } from './user-role.repository.js';
import { DrizzleSessionRepository } from './session.repository.js';
import { DrizzleMfaMethodRepository } from './mfa-method.repository.js';

export const createDrizzleRepositories = (db: Database): RepositoryBundle => ({
  users: new DrizzleUserRepository(db),
  userRoles: new DrizzleUserRoleRepository(db),
  sessions: new DrizzleSessionRepository(db),
  mfaMethods: new DrizzleMfaMethodRepository(db),
});

export { DrizzleUserRepository } from './user.repository.js';
export { DrizzleUserRoleRepository } from './user-role.repository.js';
export { DrizzleSessionRepository } from './session.repository.js';
export { DrizzleMfaMethodRepository } from './mfa-method.repository.js';