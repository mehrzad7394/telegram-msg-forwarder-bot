import type { SettingsInput } from '@repo/shared';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  IsTimeZone,
  Matches,
} from 'class-validator';

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

  @ApiPropertyOptional({
    example: '08:30',
    description: 'Daily listening start time (HH:mm)',
    default: '08:30',
  })
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  listeningStartTime?: string;
  @ApiPropertyOptional({
    example: '22:00',
    description: 'Daily listening end time (HH:mm)',
    default: '22:00',
  })
  @IsString()
  @Matches(/^(?:[01]\d|2[0-3]):[0-5]\d$/)
  @IsOptional()
  listeningEndTime?: string;

  @ApiPropertyOptional({
    example: 'Asia/Tehran',
    description: 'Timezone used for listening schedule (IANA timezone)',
    default: 'Asia/Tehran',
  })
  @IsString()
  @IsTimeZone()
  @IsOptional()
  timeZone?: string;
}
