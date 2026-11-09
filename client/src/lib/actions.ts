"use server";

import {
  type ApiData,
  type ApiSuccess,
  type AuthProfile,
  type ChannelInput,
  type ChannelUpdate,
  type FilterInput,
  type LoginInput,
  type LoginResponse,
  type PasswordInput,
  type QueueCleanupInput,
  type SettingsInput,
  type SettingsRecord,
  type UserInput,
  type UserUpdate,
  FilterActions,
  FilterSchema,
  UserRoles,
  requiresFilterReplacement,
  usesFilterPattern,
} from "@repo/shared";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname } from "@/i18n/navigation";
import { cookies, headers } from "next/headers";
import { redirectInLocale } from "@/i18n/redirect";
import {
  ApiError,
  type ActionResult,
  entityPath,
  request,
  sessionCookie,
} from "./api";
import { requireSession } from "./session";

function field(form: FormData, name: string) {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

function checked(form: FormData, name: string) {
  return field(form, name) === "on";
}

type Translator = Awaited<ReturnType<typeof getTranslations>>;

function required(t: Translator, value: string, label: string) {
  if (!value.trim()) throw new ApiError(400, t("requiredField", { label }));
  return value;
}

function errorResult(error: unknown, t: Translator): ActionResult {
  return {
    status: "error",
    message: error instanceof ApiError ? error.message : t("actionFailed"),
  };
}

async function secureCookie() {
  const origin = (await headers()).get("origin");
  return Boolean(
    origin?.startsWith("https://") ||
    process.env.SITE_URL?.startsWith("https://"),
  );
}

export async function login(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const t = await getTranslations();
  try {
    const body: LoginInput = {
      username: required(t, field(form, "username").trim(), t("username")),
      password: required(t, field(form, "password"), t("password")),
    };
    const { access_token } = await request<LoginResponse>("/auth/login", {
      auth: false,
      method: "POST",
      body,
    });
    if (!access_token) throw new ApiError(502, t("missingLoginToken"));
    const { data: profile } = await request<ApiData<AuthProfile>>(
      "/auth/profile",
      { token: access_token },
    );
    if (!profile.isActive || profile.role !== UserRoles.ADMIN) {
      throw new ApiError(403, t("adminAccessRequired"));
    }
    (await cookies()).set(sessionCookie, access_token, {
      httpOnly: true,
      secure: await secureCookie(),
      sameSite: "lax",
      path: "/",
      maxAge: 86_400,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return { status: "error", message: t("invalidCredentials") };
    }
    return errorResult(error, t);
  }
  return redirectInLocale("/");
}

export async function logout() {
  try {
    if ((await cookies()).has(sessionCookie))
      await request<ApiSuccess>("/auth/logout", { method: "POST" });
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
  } finally {
    (await cookies()).delete(sessionCookie);
  }
  await redirectInLocale("/login");
}

async function mutate(
  operation: (t: Translator) => Promise<ActionResult>,
): Promise<ActionResult> {
  const t = await getTranslations();
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof ApiError) return errorResult(error, t);
    throw error;
  }
  try {
    return await operation(t);
  } catch (error) {
    if (error instanceof ApiError && [401, 403].includes(error.status))
      await redirectInLocale("/login");
    return errorResult(error, t);
  }
}

export async function setupPassword(_previous: ActionResult, form: FormData) {
  return mutate(async (t) => {
    const password = required(t, field(form, "password"), t("newPassword"));
    if (password !== field(form, "confirmPassword"))
      throw new ApiError(400, t("passwordsMismatch"));
    if (new TextEncoder().encode(password).length > 72)
      throw new ApiError(400, t("passwordTooLong"));
    const body: PasswordInput = { password };
    await request<ApiSuccess>("/auth/setup-password", { method: "POST", body });
    return { status: "success", message: t("passwordChanged") };
  });
}

export async function saveUser(
  id: string | null,
  _previous: ActionResult,
  form: FormData,
) {
  return mutate(async (t) => {
    const username = field(form, "username").trim();
    const role = field(form, "role");
    if (role !== UserRoles.ADMIN && role !== UserRoles.USER)
      throw new ApiError(400, t("invalidRole"));
    const changes: UserUpdate = {
      username: username || undefined,
      role,
      isActive: checked(form, "isActive"),
    };
    const body: UserInput | UserUpdate = id
      ? changes
      : {
          ...changes,
          role,
          telegramId: required(
            t,
            field(form, "telegramId").trim(),
            t("telegramId"),
          ),
        };
    await request<ApiSuccess>(
      id ? entityPath("/users", id, t("invalidRecordId")) : "/users",
      { method: id ? "PUT" : "POST", body },
    );
    return {
      status: "success",
      message: id ? t("userSaved") : t("userCreated"),
    };
  });
}

export async function saveChannel(
  id: string | null,
  _previous: ActionResult,
  form: FormData,
) {
  return mutate(async (t) => {
    const channelName = required(
      t,
      field(form, "channelName").trim(),
      t("channelName"),
    );
    const changes: ChannelUpdate = {
      channelName,
      botIsAdmin: checked(form, "botIsAdmin"),
      ...(id && checked(form, "deactivate") ? { isActive: false } : {}),
    };
    const body: ChannelInput | ChannelUpdate = id
      ? changes
      : {
          ...changes,
          channelName,
          channelId: required(
            t,
            field(form, "channelId").trim(),
            t("channelId"),
          ),
        };
    await request<ApiSuccess>(
      id ? entityPath("/channels", id, t("invalidRecordId")) : "/channels",
      { method: id ? "PUT" : "POST", body },
    );
    return {
      status: "success",
      message: id ? t("channelSaved") : t("channelCreated"),
    };
  });
}

export async function saveFilter(
  id: string | null,
  _previous: ActionResult,
  form: FormData,
) {
  return mutate(async (t) => {
    const result = FilterSchema.safeParse({
      name: field(form, "name").trim(),
      pattern: field(form, "pattern"),
      action: field(form, "action"),
      replacement: field(form, "replacement"),
      isRegex: checked(form, "isRegex"),
      isActive: checked(form, "isActive"),
    });
    if (!result.success) throw new ApiError(400, t("invalidFilter"));
    const body: FilterInput = result.data;
    required(t, body.name, t("filterName"));
    if (!body.pattern && usesFilterPattern(body.action)) {
      throw new ApiError(400, t("patternRequired"));
    }
    if (requiresFilterReplacement(body.action) && !body.replacement) {
      throw new ApiError(400, t("replacementRequired"));
    }
    if (
      body.action === FilterActions.REGEX_REPLACE ||
      (body.isRegex && usesFilterPattern(body.action))
    ) {
      try {
        new RegExp(body.pattern);
      } catch {
        throw new ApiError(400, t("invalidRegex"));
      }
    }
    await request<ApiSuccess>(
      id ? entityPath("/filters", id, t("invalidRecordId")) : "/filters",
      { method: id ? "PUT" : "POST", body },
    );
    return {
      status: "success",
      message: id ? t("filterSaved") : t("filterCreated"),
    };
  });
}

const commands = {
  deleteUser: ["/users", "", "DELETE", "userDeleted"],
  activateUser: ["/users", "/activate", "PUT", "userActivated"],
  deactivateUser: ["/users", "/deactivate", "PUT", "userDeactivated"],
  promoteUser: ["/users", "/promote", "PUT", "userPromoted"],
  demoteUser: ["/users", "/demote", "PUT", "userDemoted"],
  deleteChannel: ["/channels", "", "DELETE", "channelDeleted"],
  activateChannel: ["/channels", "/set-active", "PUT", "destinationSet"],
  deleteFilter: ["/filters", "", "DELETE", "filterDeleted"],
  activateFilter: ["/filters", "/activate", "PUT", "filterActivated"],
  deactivateFilter: ["/filters", "/deactivate", "PUT", "filterDeactivated"],
} as const;

export type EntityCommand = keyof typeof commands;

export async function runEntityCommand(
  command: EntityCommand,
  id: string,
): Promise<ActionResult> {
  const result = await mutate(async (t) => {
    if (typeof command !== "string" || !Object.hasOwn(commands, command))
      throw new ApiError(400, t("invalidCommand"));
    const [base, suffix, method, messageKey] = commands[command];
    await request<ApiSuccess>(
      `${entityPath(base, id, t("invalidRecordId"))}${suffix}`,
      { method },
    );
    return { status: "success", message: t(messageKey) };
  });
  if (result?.status === "success" && command.startsWith("delete")) {
    const [path] = commands[command];
    return {
      ...result,
      redirectTo: getPathname({ href: path, locale: await getLocale() }),
    };
  }
  return result;
}

export async function saveSettings(_previous: ActionResult, form: FormData) {
  return mutate(async (t) => {
    const body: SettingsInput = {
      removeMention: checked(form, "removeMention"),
      removeURL: checked(form, "removeURL"),
    };
    await request<SettingsRecord>("/setting", { method: "PUT", body });
    return { status: "success", message: t("settingsSaved") };
  });
}

export async function cleanupQueue(_previous: ActionResult, form: FormData) {
  return mutate(async (t) => {
    const days = Number(field(form, "days"));
    if (!Number.isSafeInteger(days) || days < 1 || days > 36500)
      throw new ApiError(400, t("invalidDays"));
    const body: QueueCleanupInput = { days };
    const response = await request<ApiSuccess>("/queue/cleanup", {
      method: "POST",
      body,
    });
    const deleted = response.message?.match(/\d+/)?.[0];
    return deleted === undefined
      ? { status: "success", message: t("cleanupComplete") }
      : {
          status: "success",
          message: t("cleanedMessageCount", { count: Number(deleted) }),
        };
  });
}
