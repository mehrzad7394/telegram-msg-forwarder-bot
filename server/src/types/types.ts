export { FilterActions, UserRoles } from '@repo/shared';
export type {
  Channel,
  Filter,
  JWTPayload,
  QueuedMessage,
  User,
  UserProfile,
} from '@repo/shared';

export interface RelayChannelPostPayload {
  telegramChannelId: string;
  message: string;
  messageId: number;
}
