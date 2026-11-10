"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

export type PublicLocale = "fr" | "en";

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

export function PublicLanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<PublicLocale>("fr");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as PublicLocale | null;
      if (saved === "fr" || saved === "en") {
        setLocaleState(saved);
        document.documentElement.lang = saved;
        return;
      }
      // Match cookie if present
      const match = document.cookie.match(/(?:^|;\s*)japora-lang=(fr|en)/);
      if (match && (match[1] === "fr" || match[1] === "en")) {
        setLocaleState(match[1]);
        document.documentElement.lang = match[1];
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  const setLocale = (lang: PublicLocale) => {
    setLocaleState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
      document.cookie = `${STORAGE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = lang;
    } catch {
      // ignore
    }
  };

  const toggleLocale = () => {
    setLocale(locale === "fr" ? "en" : "fr");
  };

  const tr = <T = string,>(frVal: T, enVal: T): T => {
    return locale === "en" ? enVal : frVal;
  };

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
      aria-label="Language switcher / Sélecteur de langue"
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

