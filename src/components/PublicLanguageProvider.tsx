"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicLocale } from "@/lib/public-locale";

export type { PublicLocale } from "@/lib/public-locale";

type LanguageContextType = {
  locale: PublicLocale;
  setLocale: (lang: PublicLocale) => void;
  toggleLocale: () => void;
  tr: <T = string>(frVal: T, enVal: T) => T;
};

const LanguageContext = createContext<LanguageContextType>({
  locale: "fr",
  setLocale: () => {},
  toggleLocale: () => {},
  tr: (frVal) => frVal,
});

const STORAGE_KEY = "japora-lang";

export function PublicLanguageProvider({
  children,
  initialLocale = "fr",
}: {
  children: React.ReactNode;
  initialLocale?: PublicLocale;
}) {
  const [locale, setLocaleState] = useState<PublicLocale>(initialLocale);
  const router = useRouter();

  useEffect(() => {
    let saved: PublicLocale | null = null;
    const match = document.cookie.match(/(?:^|;\s*)japora-lang=(fr|en)/);
    if (match && (match[1] === "fr" || match[1] === "en")) {
      saved = match[1];
    }

    try {
      if (!saved) {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "fr" || stored === "en") {
          saved = stored;
        }
      }
    } catch {
      // Cookie preference remains available when local storage is blocked.
    }

    if (saved && saved !== initialLocale) {
      setLocaleState(saved);
    }
    document.documentElement.lang = saved ?? initialLocale;
  }, [initialLocale]);

  const setLocale = (lang: PublicLocale) => {
    if (lang === locale) return;
    setLocaleState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // The cookie remains the cross-route source of truth.
    }
    document.cookie = `${STORAGE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = lang;
    router.refresh();
  };

  const toggleLocale = () => {
    setLocale(locale === "fr" ? "en" : "fr");
  };

  // Stable between renders (changes only with the language), so it can be a hook dependency.
  const tr = useCallback(
    function tr<T = string>(frVal: T, enVal: T): T {
      return locale === "en" ? enVal : frVal;
    },
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, toggleLocale, tr }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function usePublicLang() {
  return useContext(LanguageContext);
}

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { locale, setLocale } = usePublicLang();

  return (
    <div
      className={`inline-flex items-center rounded-shape-full border border-arctic-300/70 bg-white/80 p-0.5 text-xs font-semibold shadow-xs backdrop-blur-sm ${className}`}
      role="group"
      aria-label={locale === "fr" ? "Sélecteur de langue" : "Language selector"}
    >
      <button
        type="button"
        onClick={() => setLocale("fr")}
        aria-pressed={locale === "fr"}
        className={`rounded-shape-full px-2.5 py-1 text-[11px] font-bold transition-all ${
          locale === "fr"
            ? "bg-arctic-900 text-arctic-50 shadow-xs"
            : "text-arctic-600 hover:text-arctic-900"
        }`}
      >
        FR
      </button>
      <button
        type="button"
        onClick={() => setLocale("en")}
        aria-pressed={locale === "en"}
        className={`rounded-shape-full px-2.5 py-1 text-[11px] font-bold transition-all ${
          locale === "en"
            ? "bg-arctic-900 text-arctic-50 shadow-xs"
            : "text-arctic-600 hover:text-arctic-900"
        }`}
      >
        EN
      </button>
    </div>
  );
}

