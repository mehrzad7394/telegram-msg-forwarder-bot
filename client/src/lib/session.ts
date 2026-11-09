import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirectInLocale } from "@/i18n/redirect";
import { type ApiData, type AuthProfile, UserRoles } from "@repo/shared";
import { ApiError, request, sessionCookie } from "./api";

export const getSession = cache(async (): Promise<AuthProfile | null> => {
  if (!(await cookies()).has(sessionCookie)) return null;
  try {
    const { data } = await request<ApiData<AuthProfile>>("/auth/profile");
    return data.isActive && data.role === UserRoles.ADMIN ? data : null;
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      return null;
    throw error;
  }
});

export async function requireSession() {
  const profile = await getSession();
  if (!profile) return redirectInLocale("/login");
  return profile;
}
