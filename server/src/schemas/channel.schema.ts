import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class Channel extends Document {
  @Prop({ required: true, unique: true })
  channelId!: string;

  @Prop({ required: true })
  channelName!: string;

  @Prop({ default: false })
  botIsAdmin!: boolean;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop()
  createdAt!: Date;
}

export const ChannelSchema = SchemaFactory.createForClass(Channel);
