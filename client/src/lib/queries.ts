"use server";

import type {
  ChannelRecord,
  ChannelStats,
  FilterRecord,
  HealthStatus,
  MessageRecord,
  QueueStats,
  SettingsRecord,
  UserRecord,
  UserStats,
} from "@repo/shared";
import { ApiError, isRecordId, readData, request } from "./api";
import { requireSession } from "./session";

export async function getBackendHealth() {
  return request<HealthStatus>("/health", { auth: false });
}
export async function getBackendGreeting() {
  return request<string>("", { auth: false, format: "text" });
}
export async function getProfile() {
  return requireSession();
}

export async function getUsers() {
  return readData<UserRecord[]>("/users");
}
export async function getUserStats() {
  return readData<UserStats>("/users/stats");
}
export async function getUser(id: string) {
  return getEntity<UserRecord>("/users", id);
}

export async function getChannels() {
  return readData<ChannelRecord[]>("/channels");
}
export async function getActiveChannel() {
  return readData<ChannelRecord | null>("/channels/active");
}
export async function getChannelStats() {
  return readData<ChannelStats>("/channels/stats");
}
export async function getChannel(id: string) {
  return getEntity<ChannelRecord>("/channels", id);
}

export async function getFilters() {
  return readData<FilterRecord[]>("/filters");
}
export async function getActiveFilters() {
  return readData<FilterRecord[]>("/filters/active");
}
export async function getFilter(id: string) {
  return getEntity<FilterRecord>("/filters", id);
}

export async function getQueueStats() {
  return readData<QueueStats>("/queue/stats");
}
export async function getMessages(limit: number) {
  const safeLimit =
    Number.isInteger(limit) && limit >= 1 && limit <= 1000 ? limit : 50;
  return readData<MessageRecord[]>(`/queue/messages?limit=${safeLimit}`);
}
export async function getSettings() {
  return readData<SettingsRecord | null>("/setting");
}

async function getEntity<T>(base: string, id: string) {
  if (typeof id !== "string" || !isRecordId(id)) return null;
  try {
    return await readData<T>(`${base}/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}
