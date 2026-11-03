"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { api } from "@/lib/api";
import type { ApiEnvelope } from "@/lib/types";
import { useAppTranslations } from "@/components/providers";
import {
  ConfirmButton,
  EmptyState,
  Loading,
  Notice,
  PageHeading,
  Panel,
  SearchBox,
} from "@/components/ui";
import type { TranslationKey } from "@/lib/i18n";
import { FilterActions } from "@repo/shared";

type Field = {
  name: string;
  label: string;
  type?: "text" | "boolean" | "select";
  required?: boolean;
  options?: { label: string; value: string }[];
  hiddenOnEdit?: boolean;
};
type ResourceConfig = {
  titleKey: "users" | "channels" | "filters";
  introKey: "usersIntro" | "currentChannelNote" | "filtersIntro";
  base: string;
  fields: Field[];
  columns: {
    name: string;
    label: string;
    kind?: "status" | "role" | "date" | "boolean" | "code" | "action";
  }[];
  searchable: string[];
  activate?: string;
  create?: boolean;
};

const configs: Record<"users" | "channels" | "filters", ResourceConfig> = {
  users: {
    titleKey: "users",
    introKey: "usersIntro",
    base: "users",
    fields: [
      { name: "telegramId", label: "telegramId", required: true },
      { name: "username", label: "username", required: true },
      {
        name: "role",
        label: "role",
        type: "select",
        required: true,
        options: [
          { label: "user", value: "user" },
          { label: "adminRole", value: "admin" },
        ],
      },
      { name: "isActive", label: "status", type: "boolean" },
    ],
    columns: [
      { name: "username", label: "username" },
      { name: "telegramId", label: "telegramId", kind: "code" },
      { name: "role", label: "role", kind: "role" },
      { name: "isActive", label: "status", kind: "status" },
      { name: "createdAt", label: "created", kind: "date" },
    ],
    searchable: ["username", "telegramId"],
    activate: "activate",
    create: false,
  },
  channels: {
    titleKey: "channels",
    introKey: "currentChannelNote",
    base: "channels",
    fields: [
      {
        name: "channelId",
        label: "channelId",
        required: true,
        hiddenOnEdit: true,
      },
      { name: "channelName", label: "channel", required: true },
      { name: "isActive", label: "status", type: "boolean" },
    ],
    columns: [
      { name: "channelName", label: "channel" },
      { name: "channelId", label: "channelId", kind: "code" },
      { name: "botIsAdmin", label: "botAdmin", kind: "boolean" },
      { name: "isActive", label: "status", kind: "status" },
    ],
    searchable: ["channelName", "channelId"],
    activate: "set-active",
    create: false,
  },
  filters: {
    titleKey: "filters",
    introKey: "filtersIntro",
    base: "filters",
    fields: [
      { name: "name", label: "name", required: true },
      { name: "pattern", label: "pattern", required: true },
      {
        name: "action",
        label: "action",
        type: "select",
        required: true,
        options: [
          { label: "actionRemoveWord", value: FilterActions.REMOVE_WORD },
          { label: "actionReplaceWord", value: FilterActions.REPLACE_WORD },
          { label: "actionRemoveLine", value: FilterActions.REMOVE_LINE },
          { label: "actionReplaceLine", value: FilterActions.REPLACE_LINE },
          { label: "actionRegexReplace", value: FilterActions.REGEX_REPLACE },
          { label: "actionPrepend", value: FilterActions.PREPEND_TEXT },
          { label: "actionAppend", value: FilterActions.APPEND_TEXT },
        ],
      },
      { name: "replacement", label: "replacement" },
      { name: "isRegex", label: "regex", type: "boolean" },
      { name: "isActive", label: "status", type: "boolean" },
    ],
    columns: [
      { name: "name", label: "name" },
      { name: "pattern", label: "pattern", kind: "code" },
      { name: "action", label: "action", kind: "action" },
      { name: "isActive", label: "status", kind: "status" },
    ],
    searchable: ["name", "pattern", "action"],
    activate: "activate",
    create: true,
  },
};

function display(
  value: unknown,
  kind: string | undefined,
  t: (key: TranslationKey) => string,
  language: string,
) {
  if (kind === "status" || kind === "boolean")
    return (
      <span
        className="badge"
        style={{
          background: value ? "#e7f7ef" : "#f1f1f5",
          color: value ? "#16734a" : "#777",
        }}
      >
        <span
          className="size-1.5 rounded-full"
          style={{ background: value ? "#22a06b" : "#999" }}
        />
        {t(value ? "active" : "inactive")}
      </span>
    );
  if (kind === "role")
    return (
      <span
        className="badge"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        {t(value === "admin" ? "adminRole" : "user")}
      </span>
    );
  if (kind === "action") {
    const actionKeys: Record<string, TranslationKey> = {
      remove_word: "actionRemoveWord",
      replace_word: "actionReplaceWord",
      remove_line: "actionRemoveLine",
      replace_line: "actionReplaceLine",
      regex_replace: "actionRegexReplace",
      prepend_text: "actionPrepend",
      append_text: "actionAppend",
    };
    return t(actionKeys[String(value)] ?? "action");
  }
  if (kind === "date" && value)
    return (
      <span>
        {new Intl.DateTimeFormat(language === "fa" ? "fa-IR" : "en-US", {
          dateStyle: "medium",
        }).format(new Date(String(value)))}
      </span>
    );
  if (kind === "code")
    return (
      <code
        className="rounded-md px-1.5 py-1 text-xs"
        style={{ background: "var(--bg)" }}
      >
        {String(value ?? "—")}
      </code>
    );
  return String(value ?? "—");
}

export function ResourcePage({
  resource,
}: {
  resource: "users" | "channels" | "filters";
}) {
  const config = configs[resource];
  const { t, language } = useAppTranslations();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const pageSize = 8;
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api<ApiEnvelope<Record<string, unknown>[]>>(
        config.base,
      );
      setItems(Array.isArray(result.data) ? result.data : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [config.base]);
  useEffect(() => {
    void load();
  }, [load]);
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          config.searchable.some((key) =>
            String(item[key] ?? "")
              .toLocaleLowerCase()
              .includes(query.toLocaleLowerCase()),
          ) &&
          (statusFilter === "all" ||
            Boolean(item.isActive) === (statusFilter === "active")),
      ),
    [items, config.searchable, query, statusFilter],
  );
  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const open = (item?: Record<string, unknown>) => {
    setEditing(item ?? null);
    setForm(
      item
        ? Object.fromEntries(
          config.fields.map((field) => [field.name, item[field.name] ?? ""]),
        )
        : { isActive: true, isRegex: false },
    );
    setModal(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const schema = z
      .object(
        Object.fromEntries(
          config.fields.map((field) => [
            field.name,
            field.type === "boolean"
              ? z.boolean().optional()
              : field.required
                ? z.string().trim().min(1, t("required"))
                : z.string().optional(),
          ]),
        ),
      )
      .superRefine((values, context) => {
        if (
          resource === "filters" &&
          [
            "replace_word",
            "replace_line",
            "regex_replace",
            "prepend_text",
            "append_text",
          ].includes(String(values.action)) &&
          !String(values.replacement ?? "").trim()
        ) {
          context.addIssue({
            code: "custom",
            path: ["replacement"],
            message: t("required"),
          });
        }
      });
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? t("invalid"));
      return;
    }
    setSaving(true);
    setError("");
    try {
      const method = editing ? "PUT" : "POST";
      const path = editing
        ? `${config.base}/${String(editing._id)}`
        : config.base;
      await api(path, { method, body: JSON.stringify(parsed.data) });
      setModal(false);
      setNotice(t(editing ? "saved" : "createdOk"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("error"));
    } finally {
      setSaving(false);
    }
  };
  const remove = async (id: string) => {
    try {
      await api(`${config.base}/${id}`, { method: "DELETE" });
      setNotice(t("deletedOk"));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("error"));
    }
  };
  const activate = async (item: Record<string, unknown>) => {
    try {
      if (resource === "channels")
        await api(`${config.base}/${String(item._id)}/set-active`, {
          method: "PUT",
        });
      else
        await api(
          `${config.base}/${String(item._id)}/${item.isActive ? "deactivate" : "activate"}`,
          { method: "PUT" },
        );
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("error"));
    }
  };
  return (
    <>
      <PageHeading
        title={t(config.titleKey)}
        description={t(config.introKey)}
        action={
          config.create ? (
            <button className="btn-primary" onClick={() => open()}>
              ＋ {t("add")} {t(config.titleKey)}
            </button>
          ) : undefined
        }
      />
      {error && <Notice message={error} onClose={() => setError("")} />}
      {notice && (
        <Notice kind="success" message={notice} onClose={() => setNotice("")} />
      )}
      {resource === "channels" && (
        <p
          className="mb-4 rounded-xl border px-4 py-3 text-xs muted"
          style={{ borderColor: "var(--line)" }}
        >
          {t("cacheRefreshNote")}
        </p>
      )}
      <Panel>
        <div
          className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--line)" }}
        >
          <SearchBox
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
          />
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="status-filter">
              {t("filterStatus")}
            </label>
            <select
              id="status-filter"
              className="field max-w-[180px]"
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">{t("allStatuses")}</option>
              <option value="active">{t("activeOnly")}</option>
              <option value="inactive">{t("inactiveOnly")}</option>
            </select>
            <span className="text-xs muted">
              {filtered.length} {t("total").toLowerCase()}
            </span>
          </div>
        </div>
        {loading ? (
          <Loading />
        ) : visible.length === 0 ? (
          <EmptyState
            title={t(query ? "noRecords" : "emptyTitle")}
            detail={t(query ? "noRecords" : "emptyText")}
          />
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {config.columns.map((column) => (
                    <th key={column.name}>
                      {t(column.label as Parameters<typeof t>[0])}
                    </th>
                  ))}
                  <th>{t("actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((item, index) => (
                  <tr key={String(item._id ?? index)}>
                    {config.columns.map((column) => (
                      <td key={column.name}>
                        {display(item[column.name], column.kind, t, language)}
                      </td>
                    ))}
                    <td>
                      <div className="flex min-w-max items-center gap-3">
                        <button
                          className="text-sm font-medium"
                          style={{ color: "var(--accent)" }}
                          onClick={() => open(item)}
                        >
                          {t("edit")}
                        </button>
                        {config.activate && (
                          <button
                            className="text-sm"
                            style={{ color: "var(--muted)" }}
                            onClick={() => void activate(item)}
                          >
                            {resource === "channels"
                              ? t("setActive")
                              : t(item.isActive ? "deactivate" : "activate")}
                          </button>
                        )}
                        <ConfirmButton
                          label={t("delete")}
                          onConfirm={() => remove(String(item._id))}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered.length > pageSize && (
          <div
            className="flex items-center justify-between border-t p-4 text-sm"
            style={{ borderColor: "var(--line)" }}
          >
            <span className="muted">
              {t("page")} {page} {t("of")} {pages}
            </span>
            <div className="flex gap-2">
              <button
                className="btn-ghost"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                {t("previous")}
              </button>
              <button
                className="btn-ghost"
                disabled={page === pages}
                onClick={() => setPage(page + 1)}
              >
                {t("next")}
              </button>
            </div>
          </div>
        )}
      </Panel>
      {modal && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/45 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModal(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-title"
            className="surface max-h-[90vh] w-full max-w-xl overflow-y-auto p-6"
          >
            <div className="mb-5 flex items-center justify-between">
              <h3 id="record-title" className="text-lg font-bold">
                {t(editing ? "edit" : "createRecord")} {t(config.titleKey)}
              </h3>
              <button
                className="icon-button"
                onClick={() => setModal(false)}
                aria-label={t("close")}
              >
                ×
              </button>
            </div>
            <form onSubmit={save} className="space-y-4">
              {config.fields
                .filter((field) => !(editing && field.hiddenOnEdit))
                .map((field) => (
                  <label key={field.name} className="block text-sm font-medium">
                    {t(field.label as Parameters<typeof t>[0])}
                    {field.type === "boolean" ? (
                      <span className="mt-2 flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={Boolean(form[field.name])}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              [field.name]: event.target.checked,
                            })
                          }
                        />
                        {t(Boolean(form[field.name]) ? "enabled" : "disabled")}
                      </span>
                    ) : field.type === "select" ? (
                      <select
                        className="field mt-2"
                        value={String(form[field.name] ?? "")}
                        onChange={(event) =>
                          setForm({ ...form, [field.name]: event.target.value })
                        }
                      >
                        <option value="">—</option>
                        {field.options?.map((option) => (
                          <option key={option.value} value={option.value}>
                            {t(option.label as Parameters<typeof t>[0])}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className="field mt-2"
                        value={String(form[field.name] ?? "")}
                        required={field.required}
                        onChange={(event) =>
                          setForm({ ...form, [field.name]: event.target.value })
                        }
                      />
                    )}
                  </label>
                ))}
              <div className="flex justify-end gap-2 pt-3">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setModal(false)}
                >
                  {t("cancel")}
                </button>
                <button disabled={saving} className="btn-primary">
                  {saving ? t("loading") : t("saveRecord")}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
