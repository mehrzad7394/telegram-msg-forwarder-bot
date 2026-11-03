import type { Metadata } from "next";
import { getLocale, getMessages } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { routing } from "@/i18n/navigation";

export const metadata: Metadata = {
  title: "Relay · Bot Control Center",
  description: "Administration dashboard for the Telegram forwarding bot",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const requestedLocale = await getLocale();
  const locale = routing.locales.includes(
    requestedLocale as (typeof routing.locales)[number],
  )
    ? requestedLocale
    : routing.defaultLocale;
  const messages = await getMessages();
  return (
    <html
      lang={locale}
      dir={locale === "fa" ? "rtl" : "ltr"}
      suppressHydrationWarning
    >
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
