import { createNavigation } from "next-intl/navigation";

export const locales = ["en", "fa"] as const;
export const localePrefix = "never" as const;

export const routing = { locales, defaultLocale: "en" as const, localePrefix };

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation({
    ...routing,
  });
