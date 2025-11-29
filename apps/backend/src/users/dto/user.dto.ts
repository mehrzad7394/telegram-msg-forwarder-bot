import { UserRoles } from '../../../../../packages/types/enums/UserRoles';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateUserDto {
  @IsString()
  telegramId!: string;

  @IsString()
  @IsOptional()
  username?: string;

  @IsEnum(UserRoles)
  role!: UserRoles;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
export class UpdateUserDto {
  @IsString()
  @IsOptional()
  username?: string;

  @IsEnum(UserRoles)
  @IsOptional()
  role?: UserRoles;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
