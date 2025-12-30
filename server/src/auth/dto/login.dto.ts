import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user',
    description: 'Username',
  })
  @IsString()
  username!: string;

  @ApiProperty({
    example: 'StrongPassword123',
    description: 'User password',
  })
  @IsString()
  password!: string;
}
