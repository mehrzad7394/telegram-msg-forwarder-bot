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

  @Prop({ type: String, default: '08:30' })
  listeningStartTime!: string;

  @Prop({ type: String, default: '22:00' })
  listeningEndTime!: string;

  @Prop({ type: String, default: 'Asia/Tehran' })
  timeZone!: string;
}

export const SettingSchema = SchemaFactory.createForClass(Setting);
