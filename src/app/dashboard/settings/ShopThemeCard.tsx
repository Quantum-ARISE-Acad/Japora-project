"use client";

import { useEffect, useState } from "react";
import { SHOP_THEMES, type ShopThemeId } from "@/components/ShopThemeSelector";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import {
  PaletteIcon,
  ArcticIcon,
  SunsetIcon,
  EmeraldIcon,
  MidnightIcon,
  RoyalIcon,
} from "@/components/Icons";

interface ShopThemeCardProps {
  shopSlug: string;
}

function ThemeIcon({ id }: { id: string }) {
  switch (id) {
    case "arctic":
      return <ArcticIcon size={22} className="text-sky-500" />;
    case "sunset":
      return <SunsetIcon size={22} className="text-amber-600" />;
    case "emerald":
      return <EmeraldIcon size={22} className="text-emerald-600" />;
    case "midnight":
      return <MidnightIcon size={22} className="text-indigo-400" />;
    case "indigo":
      return <RoyalIcon size={22} className="text-indigo-600" />;
    default:
      return <PaletteIcon size={22} className="text-brand-500" />;
  }
}

export default function ShopThemeCard({ shopSlug }: ShopThemeCardProps) {
  const { tr } = usePublicLang();
  const [currentTheme, setCurrentTheme] = useState<ShopThemeId>("arctic");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    try {
      const stored = (localStorage.getItem(`japora_vendor_theme_${shopSlug}`) ||
        localStorage.getItem(`japora_shop_theme_${shopSlug}`) ||
        "arctic") as ShopThemeId;
      setCurrentTheme(stored);
    } catch {}
  }, [shopSlug]);

  const handleSelectTheme = async (themeId: ShopThemeId) => {
    setCurrentTheme(themeId);
    setSaving(true);
    setSaved(false);

    try {
      localStorage.setItem(`japora_vendor_theme_${shopSlug}`, themeId);
      localStorage.setItem(`japora_shop_theme_${shopSlug}`, themeId);

      // Save to vendor UI preferences via settings endpoint
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopTheme: themeId }),
      }).catch(() => {});

      setSaved(true);
      setTimeout(() => setSaved(false), 2400);
    } catch (e) {
      console.warn("Could not save theme", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="glass glass-edge rounded-shape-xl p-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-arctic-200/50 pb-4 dark:border-arctic-800">
        <div>
          <div className="flex items-center gap-2.5">
            <PaletteIcon size={22} className="text-brand-600 dark:text-brand-400" />
            <h2 className="a-title-lg font-bold text-arctic-900">
              {tr("Thème Visuel Officiel de Votre Boutique", "Official Storefront Visual Theme")}
            </h2>
          </div>
          <p className="mt-1 text-xs text-arctic-600">
            {tr(
              "Ce thème s'applique directement à tous les visiteurs et clients qui accèdent à votre vitrine publique.",
              "This theme applies directly to all visitors and customers browsing your public storefront.",
            )}
          </p>
        </div>

        {saved && (
          <span className="inline-flex items-center gap-1 rounded-shape-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
            {tr("✓ Thème appliqué à la boutique", "✓ Theme applied to storefront")}
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHOP_THEMES.map((theme) => {
          const isSelected = theme.id === currentTheme;
          return (
            <button
              key={theme.id}
              type="button"
              onClick={() => handleSelectTheme(theme.id)}
              disabled={saving}
              className={`flex flex-col justify-between rounded-shape-lg border p-4 text-left transition-all duration-short ${
                isSelected
                  ? "border-brand-500 bg-brand-500/10 shadow-sm ring-2 ring-brand-500/30"
                  : "border-arctic-200/80 bg-white/60 hover:border-arctic-400 hover:bg-white dark:border-arctic-800 dark:bg-arctic-900/40"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="p-2 rounded-lg bg-arctic-100/70 dark:bg-arctic-800/60">
                  <ThemeIcon id={theme.id} />
                </div>
                {isSelected ? (
                  <span className="rounded-shape-full bg-brand-500 text-white px-2 py-0.5 text-[10px] font-bold">
                    {tr("Actif", "Active")}
                  </span>
                ) : (
                  <span className="text-[10px] text-arctic-500 uppercase font-semibold">
                    {theme.badge}
                  </span>
                )}
              </div>

              <div className="mt-3">
                <div className="font-bold text-sm text-arctic-900">{theme.name}</div>
                <div className="text-[11px] text-arctic-600 mt-0.5">
                  {theme.id === "arctic" && tr("Verre givré clair et moderne (Par défaut)", "Clean modern frosted glass (Default)")}
                  {theme.id === "sunset" && tr("Tons chauds ocre et terracotta d'Afrique", "Warm African ochre and terracotta tones")}
                  {theme.id === "emerald" && tr("Vert émeraude vibrant et style marché frais", "Vibrant emerald green and fresh market style")}
                  {theme.id === "midnight" && tr("Thème sombre luxueux avec contrastes dorés", "Luxurious dark theme with golden contrasts")}
                  {theme.id === "indigo" && tr("Indigo royal profond et finitions prestige", "Deep royal indigo and prestige finishes")}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
