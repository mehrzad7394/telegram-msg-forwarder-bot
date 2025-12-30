export interface JWTPayload {
  telegramId: string;
  username: string;
  sub: string;
  role: string;
}
export interface UserProfile {
  _id: string;
  telegramId: string;
  username: string;
  role: string;
  isActive: boolean;
  passwordHash?: string;
}

export enum FilterActions {
  REMOVE_WORD = 'remove_word',
  REPLACE_WORD = 'replace_word',
  REMOVE_LINE = 'remove_line',
  REPLACE_LINE = 'replace_line',
  REMOVE_URL = 'remove_url',
  REGEX_REPLACE = 'regex_replace',
  PREPEND_TEXT = 'prepend_text',
  APPEND_TEXT = 'append_text',
}

export interface User {
  id: string;
  telegramId: string;
  username: string;
  role: UserRoles;
  isActive: boolean;
  createdAt: Date;
}
export enum UserRoles {
  ADMIN = 'admin',
  USER = 'user',
}

export interface Filter {
  id: string;
  name: string;
  pattern: string;
  action: FilterActions;
  replacement?: string;
  isRegex: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface Channel {
  id: string;
  channelId: string;
  channelName: string;
  botIsAdmin: boolean;
  isActive: boolean;
  createdAt: Date;
}

export interface QueuedMessage {
  id: string;
  originalMessage: string;
  processedMessage: string;
  userId: string;
  status: 'queued' | 'processing' | 'sent' | 'failed';
  createdAt: Date;
}
