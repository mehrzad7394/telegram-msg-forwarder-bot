import { UserRoles } from '@monorepo/types';
import { SetMetadata } from '@nestjs/common';

export const Roles = (...roles: UserRoles[]) => SetMetadata('roles', roles);
