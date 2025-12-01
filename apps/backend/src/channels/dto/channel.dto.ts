import { IsString, IsBoolean, IsOptional } from 'class-validator';
export class CreateChannelDto {
  @IsString()
  channelId!: string;

  @IsString()
  channelName!: string;

  @IsBoolean()
  @IsOptional()
  botIsAdmin?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
export class UpdateChannelDto {
  @IsString()
  @IsOptional()
  channelName?: string;

  @IsBoolean()
  @IsOptional()
  botIsAdmin?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
