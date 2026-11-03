"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { TranslationKey } from "@/lib/i18n";

type UiContextValue = { dark: boolean; setDark: (dark: boolean) => void };
const UiContext = createContext<UiContextValue | null>(null);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const storedTheme = localStorage.getItem("relay-theme");
    setDark(storedTheme === "dark");
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("relay-theme", dark ? "dark" : "light");
  }, [dark]);
  const value = useMemo(() => ({ dark, setDark }), [dark]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const value = useContext(UiContext);
  if (!value) throw new Error("useUi must be used inside UiProvider");
  return value;
}

export function useAppTranslations() {
  const t = useTranslations() as (key: TranslationKey) => string;
  const locale = useLocale();
  return { t, language: locale === "fa" ? "fa" : "en" } as const;
}
