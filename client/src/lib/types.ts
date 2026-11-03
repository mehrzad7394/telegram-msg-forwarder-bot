import type { FilterActions, UserRoles } from '@repo/shared';

export type ApiEnvelope<T> = { success?: boolean; message?: string; data: T };
export type UserRecord = {
  _id: string;
  telegramId: string;
  username: string;
  role: UserRoles;
  isActive: boolean;
  createdAt?: string;
};
export type ChannelRecord = {
  _id: string;
  channelId: string;
  channelName: string;
  botIsAdmin: boolean;
  isActive: boolean;
  createdAt?: string;
};
export type FilterRecord = {
  _id: string;
  name: string;
  pattern: string;
  action: FilterActions;
  replacement?: string;
  isRegex: boolean;
  isActive: boolean;
  createdAt?: string;
};
export type QueueRecord = {
  _id: string;
  originalMessage: string;
  processedMessage: string;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  error?: string;
  createdAt?: string;
  sentAt?: string;
};
export type SettingsRecord = { removeMention?: boolean; removeURL?: boolean };