import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRoles } from '@repo/shared';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  telegramId!: string;

  @Prop({ required: true, unique: true })
  username!: string;

  @Prop({ required: true, enum: UserRoles, default: UserRoles.USER })
  role!: UserRoles;

  @Prop({ default: true })
  isActive!: boolean;
  @Prop({ select: false }) // Set only for admins with dashboard credentials
  passwordHash?: string;
  @Prop()
  createdAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
