import { SetMetadata } from '@nestjs/common';

export const ROLES_METADATA_KEY = 'roles:required';

export const Roles = (...roles: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_METADATA_KEY, roles);
