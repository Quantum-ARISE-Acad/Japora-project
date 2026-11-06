import { en } from "@/i18n/en";
import { pcm } from "@/i18n/pcm";
import { sw } from "@/i18n/sw";
import { fr } from "@/i18n/fr";
import { wo } from "@/i18n/wo";
import { am } from "@/i18n/am";
import { ha } from "@/i18n/ha";

export type Lang = "en" | "pcm" | "sw" | "fr" | "wo" | "am" | "ha";

export const DEFAULT_LANG: Lang = "en";

export const LANG_NAMES: Record<Lang, string> = {
  en: "English",
  pcm: "Pidgin",
  sw: "Kiswahili",
  fr: "Français",
  wo: "Wolof",
  am: "አማርኛ",
  ha: "Hausa",
};

export type Dictionary = Record<string, string>;

const DICTIONARIES: Record<Lang, Dictionary> = {
  en,
  pcm,
  sw,
  fr,
  wo,
  am,
  ha,
};

const SUPPORTED: Lang[] = ["en", "pcm", "sw", "fr", "wo", "am", "ha"];

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    const value = vars[key];
    return value === undefined || value === null ? match : String(value);
  });
}

/**
 * Translate a dictionary key for a given language.
 * Falls back to English when a key is missing, then to the raw key.
 * Supports {name} placeholder interpolation via `vars`.
 */
export function t(
  key: string,
  lang: Lang = DEFAULT_LANG,
  vars?: Record<string, string | number>
): string {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANG];
  const value = dict[key] ?? DICTIONARIES[DEFAULT_LANG][key] ?? key;
  return interpolate(value, vars);
}

/**
 * Detect a supported Lang from an Accept-Language header, optionally
 * overridden by a vendor preference. Returns DEFAULT_LANG if nothing matches.
 */
export function detectLang(acceptLanguage?: string | null, vendorLang?: string | null): Lang {
  if (vendorLang && (SUPPORTED as string[]).includes(vendorLang)) {
    return vendorLang as Lang;
  }
  if (!acceptLanguage) return DEFAULT_LANG;

  const candidates = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag, qPart] = part.trim().split(";");
      const q = qPart && qPart.startsWith("q=") ? parseFloat(qPart.slice(2)) : 1;
      return { tag: tag.toLowerCase(), q: Number.isFinite(q) ? q : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of candidates) {
    // Nigerian Pidgin tags (check before primary 'en' match so 'en-ng' resolves to 'pcm')
    if (tag === "pcm" || tag.startsWith("pcm-") || tag === "en-ng") return "pcm";
    const primary = tag.split("-")[0];
    // Direct match on primary subtag
    if ((SUPPORTED as string[]).includes(primary)) {
      return primary as Lang;
    }
    // Map common aliases
    if (primary === "sw" || tag.startsWith("sw-")) return "sw";
    if (primary === "fr" || tag.startsWith("fr-")) return "fr";
    if (primary === "am" || tag.startsWith("am-")) return "am";
    if (primary === "ha" || tag.startsWith("ha-")) return "ha";
    if (primary === "wo" || tag.startsWith("wo-")) return "wo";
  }

  return DEFAULT_LANG;
}
