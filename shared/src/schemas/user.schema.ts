import { z } from 'zod';
import { UserRoles } from '../types/types';

export const UserProfileSchema = z.object({
  _id: z.string(),
  telegramId: z.string(),
  username: z.string(),
  role: z.enum(UserRoles),
  isActive: z.boolean(),
  passwordHash: z.string().optional(),
});