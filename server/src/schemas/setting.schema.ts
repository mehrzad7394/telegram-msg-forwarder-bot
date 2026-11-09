import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Setting extends Document {
  @Prop({
    required: true,
    unique: true,
    default: 'global',
    immutable: true,
  })
  key: string;

  @Prop()
  removeMention!: boolean;

  @Prop()
  removeURL!: boolean;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
