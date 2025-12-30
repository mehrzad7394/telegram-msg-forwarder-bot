import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserRoles } from 'src/types/types';

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
  @Prop({ required: true }) // Only for admin login via dashboard
  passwordHash!: string;
  @Prop()
  createdAt!: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
