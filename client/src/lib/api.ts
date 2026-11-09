import "server-only";
import { cookies } from "next/headers";
import { redirectInLocale } from "@/i18n/redirect";
import { getLocale, getTranslations } from "next-intl/server";
import type { ApiData } from "@repo/shared";

export const sessionCookie = "relay_session";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: object;
  auth?: boolean;
  token?: string;
  format?: "text";
};

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const t = await getTranslations();
  const token =
    options.token ??
    (options.auth === false
      ? undefined
      : (await cookies()).get(sessionCookie)?.value);
  if (options.auth !== false && !token) {
    throw new ApiError(401, t("signInAgain"));
  }

  const base = (
    process.env.BACKEND_API_URL || "http://127.0.0.1:3001/api"
  ).replace(/\/+$/, "");
  const headers = new Headers({
    Accept: options.format === "text" ? "text/plain" : "application/json",
  });
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: options.method,
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new ApiError(503, t("serverConnectionError"));
  }

  if (!response.ok) {
    const payload: { message?: string | unknown[] } | null = await response
      .json()
      .catch(() => null);
    const message = Array.isArray(payload?.message)
      ? payload.message
          .flat(Infinity)
          .filter((part): part is string => typeof part === "string")
          .join(" · ")
      : payload?.message;
    const fallback = t("backendRejected", { status: response.status });
    const details =
      (await getLocale()) === "en" && typeof message === "string"
        ? message
        : fallback;
    throw new ApiError(
      response.status,
      response.status >= 500 ? t("serverActionError") : details || fallback,
    );
  }

  try {
    return options.format === "text"
      ? ((await response.text()) as T)
      : ((await response.json()) as T);
  } catch {
    throw new ApiError(502, t("invalidServerResponse"));
  }
}

export async function readData<T>(path: string): Promise<T> {
  try {
    return (await request<ApiData<T>>(path)).data;
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 401 || error.status === 403)
    )
      await redirectInLocale("/login");
    throw error;
  }
}

export function isRecordId(value: string): boolean {
  return /^[\da-f]{24}$/i.test(value);
}

export function entityPath(
  base: string,
  id: string,
  invalidIdMessage: string,
): string {
  if (!isRecordId(id)) throw new ApiError(400, invalidIdMessage);
  return `${base}/${id}`;
}

export type ActionResult =
  | { status: "success"; message: string; redirectTo?: string }
  | { status: "error"; message: string }
  | null;
