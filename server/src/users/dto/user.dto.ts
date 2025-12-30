import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { UserRoles } from 'src/types/types';

export class CreateUserDto {
  @ApiProperty({
    example: '123456789',
    description: 'Telegram unique user ID',
  })
  @IsString()
  telegramId!: string;
  @ApiPropertyOptional({
    example: 'john_doe',
    description: 'Telegram username',
  })
  @IsString()
  @IsOptional()
  username?: string;
  @ApiProperty({
    enum: UserRoles,
    example: UserRoles.ADMIN,
    description: 'User role in the system',
  })
  @IsEnum(UserRoles)
  role!: UserRoles;
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the user account is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
export class UpdateUserDto {
  @ApiPropertyOptional({
    example: 'john_updated',
    description: 'Updated Telegram username',
  })
  @IsString()
  @IsOptional()
  username?: string;
  @ApiPropertyOptional({
    enum: UserRoles,
    example: UserRoles.USER,
    description: 'Updated user role',
  })
  @IsEnum(UserRoles)
  @IsOptional()
  role?: UserRoles;
  @ApiPropertyOptional({
    example: false,
    description: 'Enable or disable the user account',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
