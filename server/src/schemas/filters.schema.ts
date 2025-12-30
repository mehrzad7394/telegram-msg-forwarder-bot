import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { FilterActions } from 'src/types/types';

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
