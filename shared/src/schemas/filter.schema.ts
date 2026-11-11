import { z } from 'zod';
import { FilterActions } from '../types/types';

export const FilterSchema = z.object({
  name: z.string(),
  pattern: z.string(),
  action: z.enum(FilterActions),
  replacement: z.string().optional(),
  isRegex: z.boolean().default(false),
  isActive: z.boolean().default(true),
});