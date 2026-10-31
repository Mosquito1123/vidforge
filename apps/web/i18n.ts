import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

const locales = ["en", "zh"] as const;
type Locale = (typeof locales)[number];

function resolveLocale(value: string | undefined): Locale {
  if (value && (locales as readonly string[]).includes(value)) return value as Locale;
  return "en";
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  let locale = resolveLocale(cookieStore.get("NEXT_LOCALE")?.value);

  if (!cookieStore.get("NEXT_LOCALE")) {
    const accept = (await headers()).get("accept-language") || "";
    const preferred = accept.split(",")[0]?.split("-")[0]?.trim().toLowerCase();
    locale = resolveLocale(preferred === "zh" ? "zh" : preferred);
    // default to en if not zh
    if (locale !== "zh") locale = "en";
  }

  const messages = (await import(`./messages/${locale}.json`)).default;
  return { locale, messages };
});