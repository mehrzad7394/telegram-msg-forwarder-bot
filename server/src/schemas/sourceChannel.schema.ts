import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class SourceChannel extends Document {
  @Prop({ required: true, unique: true })
  channelId!: string;
  @Prop({ required: true, unique: true, length: 50 })
  channelName!: string;

  @Prop({ default: false })
  isActive!: boolean;

  @Prop()
  createdAt!: Date;
}

export const SourceChannelSchema = SchemaFactory.createForClass(SourceChannel);
