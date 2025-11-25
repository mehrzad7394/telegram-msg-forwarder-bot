import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FilterAction } from '../../../../packages/types/enums/FilterActions';
import { Document } from 'mongoose';

export type FilterDocument = Filter & Document;

@Schema({ timestamps: true })
export class Filter {
  @Prop({ required: true })
  name!: string; // e.g., "bad-words", "marketing"

  @Prop({ required: true })
  match!: string; // substring or regex string

  @Prop({ required: true, enum: FilterAction })
  action!: FilterAction;

  @Prop()
  replaceWith?: string; // used for 'replace' or 'addStart'/'addEnd'

  @Prop({ default: false })
  caseInsensitive?: boolean;

  @Prop({ default: false })
  useRegex?: boolean;
}

export const FilterSchema = SchemaFactory.createForClass(Filter);
