"use client";

import { useEffect } from "react";

/**
 * Belt-and-suspenders theme application. The inline no-FOUC script in layout.tsx
 * sets `.dark` before paint, but React controls the <html> className, so a
 * hydration re-render can occasionally drop it. This effect re-asserts the
 * class from the persisted choice (or system preference) on every page mount,
 * and keeps it in sync if another tab toggles. Renders nothing.
 */
export default function ThemeSync() {
  useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem("japora-theme");
        const dark = stored
          ? stored === "dark"
          : window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", dark);
      } catch {
        /* storage blocked — leave whatever the inline script set */
      }
    };
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);
  return null;
}
