import type { SettingsInput } from '@repo/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingDto implements SettingsInput {
  @ApiPropertyOptional({
    example: true,
    description: 'Remove Mentions From Message',
  })
  @IsBoolean()
  @IsOptional()
  removeMention?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Remove URLs From Message',
  })
  @IsBoolean()
  @IsOptional()
  removeURL?: boolean;
}
