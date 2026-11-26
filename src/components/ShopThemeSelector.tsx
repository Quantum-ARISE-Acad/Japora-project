"use client";

import { useEffect, useState, useRef } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph from "@/components/Glyph";

export type ShopThemeId = "arctic" | "sunset" | "emerald" | "midnight" | "indigo";

export interface ShopTheme {
  id: ShopThemeId;
  name: string;
  badge: string;
}

export const SHOP_THEMES: ShopTheme[] = [
  { id: "arctic", name: "Arctic Glass", badge: "Défaut" },
  { id: "sunset", name: "Sunset Terracotta", badge: "Chaleur" },
  { id: "emerald", name: "Emerald Market", badge: "Nature" },
  { id: "midnight", name: "Midnight Luxe", badge: "Sombre" },
  { id: "indigo", name: "Royal Indigo", badge: "Élégant" },
];

export default function ShopThemeSelector({
  shopSlug,
}: {
  shopSlug: string;
}) {
  const { tr } = usePublicLang();
  const [currentTheme, setCurrentTheme] = useState<ShopThemeId>("arctic");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(`japora_shop_theme_${shopSlug}`) as ShopThemeId;
    if (saved && SHOP_THEMES.some((t) => t.id === saved)) {
      setCurrentTheme(saved);
      applyTheme(saved);
    }
  }, [shopSlug]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function applyTheme(themeId: ShopThemeId) {
    const root = document.getElementById("shop-root") || document.body;
    root.setAttribute("data-shop-theme", themeId);
  }

  function handleSelect(themeId: ShopThemeId) {
    setCurrentTheme(themeId);
    applyTheme(themeId);
    localStorage.setItem(`japora_shop_theme_${shopSlug}`, themeId);
    setOpen(false);
  }

  const active = SHOP_THEMES.find((t) => t.id === currentTheme) || SHOP_THEMES[0];

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-ghost btn-sm font-semibold"
        title={tr("Personnaliser le thème visuel de la boutique", "Customise the shop's visual theme")}
        aria-label={tr("Changer le thème de la boutique", "Change the shop theme")}
      >
        <span className="hidden sm:inline">{active.name}</span>
        <Glyph name="chevron-down" size={12} className="text-arctic-600" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-shape-xl border border-arctic-400/40 bg-white/95 p-1.5 shadow-xl backdrop-blur-md a-scale-in dark:bg-arctic-900/95">
          <div className="px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-arctic-600 border-b border-arctic-200/50 dark:border-arctic-800">
            {tr("Thème de la boutique", "Shop theme")}
          </div>
          <div className="mt-1 space-y-0.5">
            {SHOP_THEMES.map((theme) => {
              const isSelected = theme.id === currentTheme;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => handleSelect(theme.id)}
                  className={`flex w-full items-center justify-between rounded-shape-lg px-2.5 py-2 text-xs transition ${
                    isSelected
                      ? "bg-brand/15 font-semibold text-brand-dark dark:text-brand"
                      : "text-arctic-700 hover:bg-arctic-100/80 dark:text-arctic-300 dark:hover:bg-arctic-800/80"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span>{theme.name}</span>
                  </div>
                  {isSelected && <Glyph name="check" size={14} className="text-brand-dark" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
