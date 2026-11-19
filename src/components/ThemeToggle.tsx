"use client";

import { useEffect, useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * Light/dark toggle. Flips the `.dark` class on <html>, persists to
 * localStorage (read by the no-FOUC script in layout.tsx) and a cookie so the
 * server can match on first paint if needed. Defaults to system preference.
 *
 * Sun/moon are inline SVGs (no emoji, per the icon discipline) and the control
 * is a 44px touch target with an aria-label and aria-pressed state.
 */
export default function ThemeToggle({ className = "" }: { className?: string }) {
  const { tr } = usePublicLang();
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("japora-theme", next ? "dark" : "light");
      document.cookie = `japora-theme=${next ? "dark" : "light"};path=/;max-age=31536000;samesite=lax`;
    } catch {
      /* storage blocked — ignore */
    }
    setDark(next);
  }

  const isDark = dark ?? false;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? tr("Passer au thème clair", "Switch to light theme") : tr("Passer au thème sombre", "Switch to dark theme")}
      aria-pressed={isDark}
      title={isDark ? tr("Mode clair", "Light mode") : tr("Mode sombre", "Dark mode")}
      className={
        "grid h-9 w-9 place-items-center rounded-full border border-arctic-400/45 text-arctic-700 " +
        "transition-colors duration-short hover:border-brand/60 hover:text-brand-dark " +
        className
      }
      style={{ background: "var(--aurora-surface)" }}
    >
      {/* Render both; CSS-free swap by which class is active. */}
      {isDark ? (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z" />
        </svg>
      )}
    </button>
  );
}
