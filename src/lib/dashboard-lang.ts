import { cookies } from "next/headers";

export type DashboardLocale = "fr" | "en";

/**
 * Resolve the active dashboard language ("fr" | "en") on the server.
 * Priority:
 *  1) `japora-lang` cookie (set by the navbar language switcher)
 *  2) `vendor.language` ("en" -> "en", otherwise "fr")
 */
export async function getDashboardLocale(vendorLang?: string | null): Promise<DashboardLocale> {
  try {
    const store = await cookies();
    const cookieVal = store.get("japora-lang")?.value;
    if (cookieVal === "en" || cookieVal === "fr") {
      return cookieVal;
    }
  } catch {
    // ignore outside request context
  }
  if (vendorLang === "en") return "en";
  return "fr";
}

export function trServer<T = string>(locale: DashboardLocale, frVal: T, enVal: T): T {
  return locale === "en" ? enVal : frVal;
}

