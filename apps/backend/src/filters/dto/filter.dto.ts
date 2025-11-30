import { FilterActions } from '../../../../../packages/types/enums/FilterActions';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export class CreateFilterDto {
  @IsString()
  name!: string;
  @IsString()
  pattern!: string;
  @IsEnum(FilterActions)
  action!: FilterActions;
  @IsString()
  @IsOptional()
  @ValidateIf(
    (o: CreateFilterDto) =>
      o.action === FilterActions.REMOVE_WORD ||
      o.action === FilterActions.REMOVE_LINE ||
      o.action === FilterActions.REGEX_REPLACE,
  )
  replacement?: string;
  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class UpdateFilterDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  pattern?: string;

  @IsEnum(FilterActions)
  @IsOptional()
  action?: FilterActions;

  @IsString()
  @IsOptional()
  replacement?: string;

  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
export class TestFilterDto {
  @IsString()
  text!: string;

  @IsString()
  pattern!: string;

  @IsEnum(FilterActions)
  action!: FilterActions;

  @IsBoolean()
  @IsOptional()
  isRegex?: boolean;

  @IsString()
  @IsOptional()
  replacement?: string;
}
