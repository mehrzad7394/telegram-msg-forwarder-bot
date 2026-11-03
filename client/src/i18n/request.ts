import { getRequestConfig } from "next-intl/server";
import { messages, type Language } from "@/lib/i18n";

export default getRequestConfig(async ({ requestLocale }) => {
  const requestedLocale = await requestLocale;
  const locale: Language = requestedLocale === "fa" ? "fa" : "en";
  return { locale, messages: messages[locale] };
});
