import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';
import { FilterActions } from 'src/types/types';

export class CreateFilterDto {
  @ApiProperty({
    example: 'Remove bad words',
    description: 'Human-readable filter name',
  })
  @IsString()
  name!: string;
  @ApiProperty({
    example: 'badword',
    description: 'Pattern to match against message content',
  })
  @IsString()
  pattern!: string;
  @ApiProperty({
    enum: FilterActions,
    example: FilterActions.REPLACE_WORD,
    description: 'Action to apply when pattern matches',
  })
  @IsEnum(FilterActions)
  action!: FilterActions;

  @ApiPropertyOptional({
    example: '***',
    description:
      'Replacement text (required for replace, prepend, append actions)',
  })
  @ValidateIf((o: CreateFilterDto) =>
    [
      FilterActions.REPLACE_WORD,
      FilterActions.REPLACE_LINE,
      FilterActions.REGEX_REPLACE,
      FilterActions.PREPEND_TEXT,
      FilterActions.APPEND_TEXT,
    ].includes(o.action),
  )
  @IsString()
  @IsNotEmpty()
  replacement!: string;
  @ApiPropertyOptional({
    example: false,
    description: 'Treat pattern as a regular expression',
  })
  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;
  @ApiPropertyOptional({
    example: true,
    description: 'Enable or disable this filter',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFilterDto {
  @ApiPropertyOptional({
    example: 'Updated filter name',
    description: 'New filter name',
  })
  @IsString()
  @IsOptional()
  name?: string;
  @ApiPropertyOptional({
    example: 'new-pattern',
    description: 'Updated pattern',
  })
  @IsString()
  @IsOptional()
  pattern?: string;
  @ApiPropertyOptional({
    enum: FilterActions,
    example: FilterActions.REGEX_REPLACE,
    description: 'Updated filter action',
  })
  @IsEnum(FilterActions)
  @IsOptional()
  action?: FilterActions;
  @ApiPropertyOptional({
    example: '###',
    description:
      'Replacement text (required for replace, prepend, append actions)',
  })
  @ValidateIf((o: CreateFilterDto) =>
    [
      FilterActions.REPLACE_WORD,
      FilterActions.REPLACE_LINE,
      FilterActions.REGEX_REPLACE,
      FilterActions.PREPEND_TEXT,
      FilterActions.APPEND_TEXT,
    ].includes(o.action),
  )
  @IsString()
  @IsNotEmpty()
  replacement?: string;
  @ApiPropertyOptional({
    example: true,
    description: 'Use regex matching',
  })
  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;
  @ApiPropertyOptional({
    example: false,
    description: 'Enable or disable this filter',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
