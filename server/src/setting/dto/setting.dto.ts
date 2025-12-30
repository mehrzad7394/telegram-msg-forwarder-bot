import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateSettingDto {
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
