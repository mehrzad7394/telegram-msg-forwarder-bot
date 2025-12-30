import { SetMetadata } from '@nestjs/common';
import { UserRoles } from 'src/types/types';

export const Roles = (...roles: UserRoles[]) => SetMetadata('roles', roles);
