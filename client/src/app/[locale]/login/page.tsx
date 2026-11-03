"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { Languages, Moon, Sun, Send } from "lucide-react";
import { api, ApiError } from "@/lib/api";

const schema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});
type LoginValues = z.infer<typeof schema>;

export default function LoginPage() {
  const router = useRouter();
  const pathname = usePathname();
  const language = useLocale();
  const t = useTranslations();
  const [dark, setDark] = useState(false);
  const [error, setError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    const theme = localStorage.getItem("relay-theme");
    if (theme === "dark") setDark(true);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("relay-theme", dark ? "dark" : "light");
  }, [dark]);

  const submit = handleSubmit(async (values) => {
    setError("");
    try {
      await api("auth/login", { method: "POST", body: JSON.stringify(values) });
      router.replace("/");
    } catch (cause) {
      setError(
        cause instanceof ApiError && cause.status === 401
          ? t("loginError")
          : t("loginError")
      );
    }
  });

  return (
    <main
      dir={language === "fa" ? "rtl" : "ltr"}
      className="min-h-screen grid place-items-center px-5 py-10"
    >
      <div className="fixed top-5 end-5 flex gap-2">
        <button
          className="icon-button"
          aria-label={t("language")}
          onClick={() =>
            router.replace(pathname, {
              locale: language === "en" ? "fa" : "en",
            })
          }
        >
          <Languages size={17} />
          <span className="ms-1 text-[10px]">{language.toUpperCase()}</span>
        </button>
        <button
          className="icon-button"
          aria-label={t("theme")}
          onClick={() => setDark(!dark)}
        >
          {dark ? <Sun size={17} /> : <Moon size={17} />}
        </button>
      </div>
      <section className="surface w-full max-w-[440px] p-8 sm:p-10 shadow-sm">
        <div className="flex items-center gap-3 mb-9">
          <div
            className="grid size-12 place-items-center rounded-2xl text-white"
            style={{ background: "var(--accent)" }}
          >
            <Send size={21} />
          </div>
          <div>
            <p className="text-xl font-bold">{t("brand")}</p>
            <p className="text-[10px] tracking-[.18em] muted">
              {t("brandSub")}
            </p>
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">{t("loginTitle")}</h1>
        <p className="muted text-sm mb-7">{t("loginSubtitle")}</p>
        <form onSubmit={submit} className="space-y-5">
          <label className="block text-sm font-medium">
            {t("username")}
            <input
              className="field mt-2"
              autoComplete="username"
              {...register("username")}
            />
            {errors.username && (
              <span className="text-xs text-red-500">{t("required")}</span>
            )}
          </label>
          <label className="block text-sm font-medium">
            {t("password")}
            <input
              type="password"
              className="field mt-2"
              autoComplete="current-password"
              {...register("password")}
            />
            {errors.password && (
              <span className="text-xs text-red-500">{t("required")}</span>
            )}
          </label>
          {error && (
            <p role="alert" className="text-sm text-red-500">
              {error}
            </p>
          )}
          <button className="btn-primary w-full" disabled={isSubmitting}>
            {isSubmitting ? t("loading") : t("login")}
          </button>
        </form>
      </section>
    </main>
  );
}
