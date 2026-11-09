import type { ChannelInput, ChannelUpdate } from '@repo/shared';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional } from 'class-validator';
export class CreateChannelDto implements ChannelInput {
  @ApiProperty({
    example: '-1001234567890',
    description: 'Telegram channel unique ID',
  })
  @IsString()
  channelId!: string;
  @ApiProperty({
    example: 'My News Channel',
    description: 'Human-readable channel name',
  })
  @IsString()
  channelName!: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Indicates whether the bot is admin in the channel',
  })
  @IsBoolean()
  @IsOptional()
  botIsAdmin?: boolean;
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the channel is active',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
export class UpdateChannelDto implements ChannelUpdate {
  @ApiPropertyOptional({
    example: 'Updated Channel Name',
    description: 'New channel display name',
  })
  @IsString()
  @IsOptional()
  channelName?: string;
  @ApiPropertyOptional({
    example: true,
    description: 'Whether the bot is admin in the channel',
  })
  @IsBoolean()
  @IsOptional()
  botIsAdmin?: boolean;
  @ApiPropertyOptional({
    example: false,
    description: 'Enable or disable the channel',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
