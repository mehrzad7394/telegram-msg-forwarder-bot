import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { FilterActions } from '../../../../packages/types/enums/FilterActions';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Filter extends Document {
  @Prop({ required: true })
  name!: string;

  @Prop({ required: true })
  pattern!: string;

  @Prop({ required: true, enum: FilterActions })
  action!: FilterActions;

  @Prop()
  replacement?: string;

  @Prop({ default: false })
  isRegex!: boolean;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  createdAt!: Date;
}

export const FilterSchema = SchemaFactory.createForClass(Filter);
