import { FilterActions } from "./enums/FilterActions";
import { UserRoles } from "./enums/UserRoles";

export * from "./enums/UserRoles";
export * from "./enums/FilterActions";
export interface User {
  id: string;
  telegramId: string;
  username?: string;
  role: UserRoles;
  isActive: boolean;
  createdAt: Date;
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
  status: "queued" | "processing" | "sent" | "failed";
  createdAt: Date;
}
