import { z } from 'zod';

export const QueuedMessageSchema = z.object({
  originalMessage: z.string(),
  processedMessage: z.string(),
  userId: z.string(),
  status: z.enum(['queued', 'processing', 'sent', 'failed']),
  sentAt: z.date().optional(),
  error: z.string().optional(),
});