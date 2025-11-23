import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRoles } from '../../../../packages/types';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true })
  chatId!: string; // Telegram user id as string

  @Prop({ default: UserRoles.admin, enum: UserRoles })
  role!: UserRoles;
}

export const UserSchema = SchemaFactory.createForClass(User);
