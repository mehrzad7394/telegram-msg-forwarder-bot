import { SetMetadata } from '@nestjs/common';
import { UserRoles } from '@repo/shared';

export const Roles = (...roles: UserRoles[]) => SetMetadata('roles', roles);
