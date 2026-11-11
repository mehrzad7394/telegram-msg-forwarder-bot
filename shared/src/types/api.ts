import type { Channel, Filter, QueuedMessage, User, UserRoles } from "./types";

type ApiRecord<T> = Omit<T, "id" | "createdAt"> & {
  _id: string;
  createdAt?: string;
  updatedAt?: string;
};

export interface ApiSuccess {
  success: true;
  message?: string;
}

export type ApiData<T> = ApiSuccess & { data: T };

export type UserRecord = ApiRecord<User>;
export type ChannelRecord = ApiRecord<Channel>;
export type FilterRecord = ApiRecord<Filter>;
export type MessageRecord = ApiRecord<Omit<QueuedMessage, "userId">> & {
  userId: Pick<UserRecord, "_id" | "telegramId" | "username"> | string | null;
  sentAt?: string;
  error?: string;
};

export type UserIdentity = Pick<
  User,
  "id" | "telegramId" | "username" | "role"
>;
export type AuthProfile = UserIdentity & Pick<User, "isActive">;
export interface LoginInput {
  username: string;
  password: string;
}
export interface LoginResponse {
  access_token: string;
  user: UserIdentity;
}
export type PasswordInput = Pick<LoginInput, "password">;

export type UserInput = Pick<User, "telegramId"> & {
  role: UserRoles;
  username?: string;
  isActive?: boolean;
};
export type UserUpdate = Partial<Omit<UserInput, "telegramId">>;
export type ChannelInput = Pick<Channel, "channelId" | "channelName"> &
  Partial<Pick<Channel, "botIsAdmin" | "isActive">>;
export type ChannelUpdate = Partial<Omit<ChannelInput, "channelId">>;
export type FilterInput = Pick<
  Filter,
  "name" | "pattern" | "action" | "replacement"
> &
  Partial<Pick<Filter, "isRegex" | "isActive">>;
export type FilterUpdate = Partial<FilterInput>;

export interface SettingsInput {
  removeMention?: boolean;
  removeURL?: boolean;
}
export type SettingsRecord = ApiRecord<SettingsInput & { key: "global" }>;

export interface HealthStatus {
  status: "ok";
  timestamp: string;
  service: string;
}
export interface UserStats {
  total: number;
  active: number;
  admins: number;
}
export interface ChannelStats {
  total: number;
  active: number;
  withAdmin: number;
}
export interface QueueStats {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}
export interface QueueCleanupInput {
  days?: number;
}
