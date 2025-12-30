import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
@Schema({ timestamps: true })
export class QueuedMessage extends Document {
  @Prop({ required: true })
  originalMessage!: string;

  @Prop({ required: true })
  processedMessage!: string;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  userId!: string;

  @Prop({
    enum: ['queued', 'processing', 'sent', 'failed'],
    default: 'queued',
  })
  status!: string;

  @Prop()
  sentAt?: Date;

  @Prop()
  error?: string;

  @Prop()
  createdAt!: Date;
}

export const QueuedMessageSchema = SchemaFactory.createForClass(QueuedMessage);
