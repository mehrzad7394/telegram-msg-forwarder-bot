"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  MessageSquareText,
  Radio,
  RefreshCw,
  Users,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { api } from "@/lib/api";
import type {
  ApiEnvelope,
  ChannelRecord,
  QueueRecord,
  UserRecord,
} from "@/lib/types";
import { useAppTranslations } from "@/components/providers";
import { Loading, Notice, PageHeading, Panel } from "@/components/ui";

type UserStats = { total: number; active: number; admins: number };
type ChannelStats = { total: number; active: number; withAdmin: number };
type QueueStats = {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
};
type OverviewData = {
  users: UserStats;
  channels: ChannelStats;
  queue: QueueStats;
  activeChannel: ChannelRecord | null;
  messages: QueueRecord[];
  usersList: UserRecord[];
  health: { status: string; service: string };
};

export default function OverviewPage() {
  const { t, language } = useAppTranslations();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [
        users,
        channels,
        queue,
        activeChannel,
        messages,
        usersList,
        health,
      ] = await Promise.all([
        api<ApiEnvelope<UserStats>>("users/stats"),
        api<ApiEnvelope<ChannelStats>>("channels/stats"),
        api<ApiEnvelope<QueueStats>>("queue/stats"),
        api<ApiEnvelope<ChannelRecord | null>>("channels/active"),
        api<ApiEnvelope<QueueRecord[]>>("queue/messages?limit=5"),
        api<ApiEnvelope<UserRecord[]>>("users"),
        api<{ status: string; service: string }>("health"),
      ]);
      setData({
        users: users.data,
        channels: channels.data,
        queue: queue.data,
        activeChannel: activeChannel.data,
        messages: messages.data,
        usersList: usersList.data.slice(0, 5),
        health,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("error"));
    } finally {
      setLoading(false);
    }
  }, [t]);
  useEffect(() => {
    void load();
  }, [load]);
  const number = (value: number) =>
    new Intl.NumberFormat(language === "fa" ? "fa-IR" : "en-US").format(value);
  const date = (value?: string) =>
    value
      ? new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(value))
      : "—";
  const metricCards = data
    ? [
        {
          key: "totalUsers" as const,
          value: data.users.total,
          sub: `${number(data.users.active)} ${t("active").toLowerCase()}`,
          icon: Users,
          tint: "#eeeaff",
          color: "#655bd9",
        },
        {
          key: "channelsCount" as const,
          value: data.channels.total,
          sub: `${number(data.channels.active)} ${t("active").toLowerCase()}`,
          icon: Radio,
          tint: "#e8f7f1",
          color: "#16865b",
        },
        {
          key: "queueWaiting" as const,
          value: data.queue.waiting,
          sub: `${number(data.queue.active)} ${t("processing").toLowerCase()}`,
          icon: Clock3,
          tint: "#fff4e5",
          color: "#c47a18",
        },
        {
          key: "queueFailed" as const,
          value: data.queue.failed,
          sub: `${number(data.queue.completed)} ${t("sent").toLowerCase()}`,
          icon: MessageSquareText,
          tint: "#ffeded",
          color: "#c94f58",
        },
      ]
    : [];

  return (
    <>
      <PageHeading
        title={t("welcome")}
        description={`${t("dashboard")} · ${t("live")}`}
        action={
          <button
            onClick={() => void load()}
            className="btn-ghost inline-flex items-center gap-2"
          >
            <RefreshCw size={15} />
            {t("refresh")}
          </button>
        }
      />
      {error && <Notice message={error} onClose={() => setError("")} />}
      {loading ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {metricCards.map((card) => (
                <Panel key={card.key} className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm muted">{t(card.key)}</p>
                      <p className="mt-3 text-3xl font-bold">
                        {number(card.value)}
                      </p>
                      <p className="mt-1 text-xs muted">{card.sub}</p>
                    </div>
                    <span
                      className="grid size-11 place-items-center rounded-xl"
                      style={{ background: card.tint, color: card.color }}
                    >
                      <card.icon size={20} />
                    </span>
                  </div>
                </Panel>
              ))}
            </div>
            <div className="mt-5 grid gap-5 xl:grid-cols-[1.5fr_1fr]">
              <Panel>
                <div
                  className="flex items-center justify-between border-b p-5"
                  style={{ borderColor: "var(--line)" }}
                >
                  <div>
                    <h2 className="font-bold">{t("recentMessages")}</h2>
                    <p className="mt-1 text-xs muted">{t("queueIntro")}</p>
                  </div>
                  <Link
                    href="/queue"
                    className="text-sm font-semibold"
                    style={{ color: "var(--accent)" }}
                  >
                    {t("manage")} <ArrowUpRight size={14} className="inline" />
                  </Link>
                </div>
                {data.messages.length ? (
                  <div
                    className="divide-y"
                    style={{ borderColor: "var(--line)" }}
                  >
                    {data.messages.map((message, index) => (
                      <div
                        key={message._id ?? index}
                        className="flex items-center gap-3 p-4"
                      >
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-xl"
                          style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                          }}
                        >
                          <MessageSquareText size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {message.processedMessage ||
                              message.originalMessage ||
                              "—"}
                          </p>
                          <p className="mt-1 text-xs muted">
                            {date(message.createdAt)}
                          </p>
                        </div>
                        <span
                          className="badge"
                          style={{
                            background:
                              message.status === "failed"
                                ? "#ffeded"
                                : message.status === "sent"
                                  ? "#e8f7f1"
                                  : "var(--bg)",
                            color:
                              message.status === "failed"
                                ? "#c94f58"
                                : message.status === "sent"
                                  ? "#16865b"
                                  : "var(--muted)",
                          }}
                        >
                          {t(message.status)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm muted">
                    {t("noMessages")}
                  </div>
                )}
              </Panel>
              <div className="space-y-5">
                <Panel className="p-5">
                  <div className="flex items-center gap-3">
                    <span
                      className="grid size-10 place-items-center rounded-xl"
                      style={{
                        background:
                          data.health.status === "ok" ? "#e8f7f1" : "#ffeded",
                        color:
                          data.health.status === "ok" ? "#16865b" : "#c94f58",
                      }}
                    >
                      <Activity size={19} />
                    </span>
                    <div>
                      <h2 className="font-bold">{t("systemStatus")}</h2>
                      <p className="text-xs muted">{t("apiHealth")}</p>
                    </div>
                    <span
                      className="ms-auto badge"
                      style={{
                        background:
                          data.health.status === "ok" ? "#e8f7f1" : "#ffeded",
                        color:
                          data.health.status === "ok" ? "#16865b" : "#c94f58",
                      }}
                    >
                      <span
                        className="size-1.5 rounded-full"
                        style={{
                          background:
                            data.health.status === "ok" ? "#22a06b" : "#c94f58",
                        }}
                      />
                      {data.health.status === "ok" ? t("healthOk") : t("error")}
                    </span>
                  </div>
                  <p className="mt-4 text-sm muted">{t("botInfo")}</p>
                  <div
                    className="mt-4 border-t pt-4"
                    style={{ borderColor: "var(--line)" }}
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="muted">{t("telegram")}</span>
                      <span className="font-medium">{t("unknown")}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-sm">
                      <span className="muted">{t("activeChannel")}</span>
                      <span className="max-w-[55%] truncate font-medium">
                        {data.activeChannel?.channelName ?? "—"}
                      </span>
                    </div>
                  </div>
                </Panel>
                <Panel className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className="font-bold">{t("latestUsers")}</h2>
                    <Link
                      href="/users"
                      aria-label={t("users")}
                      className="icon-button"
                    >
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  {data.usersList.length ? (
                    data.usersList.map((user, index) => (
                      <div
                        key={user._id ?? index}
                        className="flex items-center gap-3 py-2.5"
                      >
                        <span
                          className="grid size-8 place-items-center rounded-full text-xs font-bold"
                          style={{
                            background: "var(--accent-soft)",
                            color: "var(--accent)",
                          }}
                        >
                          {(user.username || user.telegramId || "?")
                            .slice(0, 1)
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {user.username || user.telegramId}
                          </p>
                          <p className="text-xs muted">{user.telegramId}</p>
                        </div>
                        <span
                          className="size-2 rounded-full"
                          title={user.isActive ? t("active") : t("inactive")}
                          style={{
                            background: user.isActive ? "#22a06b" : "#aaa",
                          }}
                        />
                      </div>
                    ))
                  ) : (
                    <p className="text-sm muted">{t("noActivity")}</p>
                  )}
                </Panel>
              </div>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {[
                { key: "queueWaiting" as const, value: data.queue.waiting },
                { key: "queueSent" as const, value: data.queue.completed },
                { key: "queueFailed" as const, value: data.queue.failed },
              ].map((item) => (
                <Panel
                  key={item.key}
                  className="flex items-center justify-between p-4"
                >
                  <span className="text-sm muted">{t(item.key)}</span>
                  <span className="flex items-center gap-2 text-xl font-bold">
                    {number(item.value)}
                    {item.key === "queueSent" ? (
                      <CheckCircle2 size={16} className="text-emerald-500" />
                    ) : null}
                  </span>
                </Panel>
              ))}
            </div>
          </>
        )
      )}
    </>
  );
}
