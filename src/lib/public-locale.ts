import { cookies } from "next/headers";

export type PublicLocale = "fr" | "en";

export function normalizePublicLocale(value: string | null | undefined): PublicLocale {
  return value === "en" ? "en" : "fr";
}

export async function getPublicLocale(): Promise<PublicLocale> {
  const cookieStore = await cookies();
  return normalizePublicLocale(cookieStore.get("japora-lang")?.value);
}

export function publicText(frValue: string, enValue: string, locale: PublicLocale): string {
  return locale === "en" ? enValue : frValue;
}

/**
 * Server components: `const tr = await getServerTr();` then tr("français", "English"),
 * the same call shape as usePublicLang().tr in client components.
 */
export async function getServerTr(): Promise<<T = string>(frValue: T, enValue: T) => T> {
  let locale: PublicLocale = "fr";
  try {
    locale = await getPublicLocale();
  } catch {
    // Outside a request (scripts, tests calling a route directly): French, the default.
  }
  return <T = string>(frValue: T, enValue: T): T => (locale === "en" ? enValue : frValue);
}
