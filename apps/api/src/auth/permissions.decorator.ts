import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_METADATA_KEY = 'permissions:required';

export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(PERMISSIONS_METADATA_KEY, permissions);
