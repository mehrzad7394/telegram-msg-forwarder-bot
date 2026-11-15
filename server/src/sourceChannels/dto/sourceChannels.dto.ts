import type { SourceChannelInput, SourceChannelUpdate } from '@repo/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';
export class CreateSourceChannelsDto implements SourceChannelInput {
  @ApiProperty({
    example: '-1001234567890',
    description: 'Telegram channel unique ID',
  })
  @IsString()
  channelId!: string;
  @ApiProperty({
    example: 'PlayStation store 1',
    description: 'Human-readable channel name',
  })
  @IsString()
  channelName!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the channel is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
export class UpdateSourceChannelDto implements SourceChannelUpdate {
  @ApiPropertyOptional({
    example: 'Updated Channel Name',
    description: 'New channel display name',
  })
  @IsString()
  @IsOptional()
  channelName?: string;
  @ApiPropertyOptional({
    example: false,
    description: 'Enable or disable the channel',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
