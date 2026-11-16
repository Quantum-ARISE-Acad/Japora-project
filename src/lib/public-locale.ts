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
