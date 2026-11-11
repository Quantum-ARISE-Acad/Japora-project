"use client";

import { useState, useRef, useEffect } from "react";
import {
  CURRENCY_LIST,
  CurrencyCode,
  normalizeCurrency,
  SUPPORTED_CURRENCIES,
} from "@/lib/currency";

export default function ShopCurrencySelector({
  selectedCurrency,
  onCurrencyChange,
  baseCurrency,
}: {
  selectedCurrency: string;
  onCurrencyChange: (code: string) => void;
  baseCurrency: string;
}) {
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
        className="btn-ghost gap-1.5 px-3 py-1.5 text-xs font-semibold"
        title="Changer la devise d'affichage des prix"
        aria-label="Sélectionner une devise"
      >
        <span>{current.flag}</span>
        <span>{current.code}</span>
        <span className="text-[10px] opacity-60">▾</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-shape-xl border border-arctic-400/40 bg-white/95 p-1.5 shadow-xl backdrop-blur-md a-scale-in dark:bg-arctic-900/95">
          <div className="flex items-center justify-between px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wider text-arctic-500 border-b border-arctic-200/50 dark:border-arctic-800">
            <span>Devise d'affichage</span>
            <span className="text-[10px] lowercase text-arctic-400">auto-converti</span>
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
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{curr.flag}</span>
                    <div className="text-left">
                      <span className="font-semibold">{curr.code}</span>
                      <span className="ml-1 text-arctic-500 text-[11px]">
                        ({curr.symbol})
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {isBase && (
                      <span className="rounded bg-arctic-200/80 px-1 py-0.5 text-[9px] font-bold text-arctic-700 dark:bg-arctic-800 dark:text-arctic-300">
                        Boutique
                      </span>
                    )}
                    {isSelected && <span className="text-brand font-bold">✓</span>}
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
