"use client";

import { useState, useRef, useEffect } from "react";
import {
  CURRENCY_LIST,
  normalizeCurrency,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph from "@/components/Glyph";

export default function ShopCurrencySelector({
  selectedCurrency,
  onCurrencyChange,
  baseCurrency,
}: {
  selectedCurrency: string;
  onCurrencyChange: (code: string) => void;
  baseCurrency: string;
}) {
  const { tr } = usePublicLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const currentCode = normalizeCurrency(selectedCurrency);
  const current = SUPPORTED_CURRENCIES[currentCode];
  const baseCode = normalizeCurrency(baseCurrency);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="btn-ghost btn-sm font-semibold"
        title={tr("Changer la devise d’affichage des prix", "Change the price display currency")}
        aria-label={tr("Sélectionner une devise", "Select a currency")}
      >
        <span className="a-num tracking-[0.06em]">{current.code}</span>
        <Glyph name="chevron-down" size={12} className="text-arctic-600" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-shape-xl border border-arctic-400/40 bg-white/95 p-1.5 shadow-xl backdrop-blur-md a-scale-in dark:bg-arctic-900/95">
          <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-arctic-600 border-b border-arctic-200/50 dark:border-arctic-800">
            <span>{tr("Devise d’affichage", "Display currency")}</span>
            <span className="text-[10px] lowercase text-arctic-400">{tr("conversion auto", "auto-converted")}</span>
          </div>

          <div className="mt-1 max-h-60 overflow-y-auto space-y-0.5">
            {CURRENCY_LIST.map((curr) => {
              const isSelected = curr.code === currentCode;
              const isBase = curr.code === baseCode;
              return (
                <button
                  key={curr.code}
                  type="button"
                  onClick={() => {
                    onCurrencyChange(curr.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-shape-lg px-2.5 py-2 text-xs transition ${
                    isSelected
                      ? "bg-brand/15 font-semibold text-brand-dark dark:text-brand"
                      : "text-arctic-700 hover:bg-arctic-100/80 dark:text-arctic-300 dark:hover:bg-arctic-800/80"
                  }`}
                >
                  <div className="min-w-0 text-left">
                    <span className="a-num font-semibold tracking-[0.06em]">{curr.code}</span>
                    {curr.symbol !== curr.code && (
                      <span className="ml-1.5 text-[11px] text-arctic-600">{curr.symbol}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {isBase && (
                      <span className="rounded bg-arctic-200/80 px-1 py-0.5 text-[9px] font-bold text-arctic-700 dark:bg-arctic-800 dark:text-arctic-300">
                        {tr("Boutique", "Shop currency")}
                      </span>
                    )}
                    {isSelected && <Glyph name="check" size={14} className="text-brand-dark" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
