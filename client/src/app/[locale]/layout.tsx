import type { Metadata, Viewport } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import "@fontsource-variable/vazirmatn";
import "../globals.css";
import { siteName, siteUrl } from "@/lib/metadata";
import { routing } from "@/i18n/routing";

type Props = { params: Promise<{ locale: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations({ locale });
  return {
    metadataBase: siteUrl,
    title: { default: siteName, template: `%s | ${siteName}` },
    description: t("siteDescription"),
    applicationName: siteName,
    robots: {
      index: false,
      follow: false,
      nocache: true,
      googleBot: { index: false, follow: false, noimageindex: true },
    },
    icons: { icon: "/relay.svg", apple: "/apple-touch-icon.png" },
    referrer: "no-referrer",
  };
}

export const viewport: Viewport = {
  themeColor: "#f7f7fc",
  colorScheme: "light",
};

export default async function LocaleLayout({
  children,
  params,
}: Props & { children: React.ReactNode }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return (
    <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
