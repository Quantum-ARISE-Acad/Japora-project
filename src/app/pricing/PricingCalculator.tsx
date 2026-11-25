"use client";

import { useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

const PRESETS = [1500, 5000, 15000, 35000, 75000];

export default function PricingCalculator() {
  const { tr } = usePublicLang();
  const [orderAmountXof, setOrderAmountXof] = useState<number>(15000);

  // Compute fee following computeCommissionCents rules:
  // free under 2,000 XOF; 3% otherwise; capped at 1,000 XOF
  const isFreeUnderFloor = orderAmountXof < 2000;
  const rawFee = Math.round(orderAmountXof * 0.03);
  const feeXof = isFreeUnderFloor ? 0 : Math.min(rawFee, 1000);
  const isCapped = !isFreeUnderFloor && rawFee >= 1000;
  const vendorKeepsXof = Math.max(0, orderAmountXof - feeXof);
  const effectivePct =
    orderAmountXof > 0 ? ((feeXof / orderAmountXof) * 100).toFixed(1) : "0.0";

  const fmt = (n: number) =>
    new Intl.NumberFormat("fr-FR").format(Math.round(n)) + " FCFA";

  return (
    <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8 shadow-elev-2">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
        <div>
          <span className="a-eyebrow">{tr("Simulateur de commission en direct", "Live commission calculator")}</span>
          <h2 className="a-title-lg mt-1 font-display text-arctic-900">
            {tr("Calculez exactement ce que vous gardez sur chaque vente", "Calculate exactly what you keep from every sale")}
          </h2>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800">
          {tr("Frais Mobile Money inclus", "Mobile Money fees included")}
        </span>
      </div>

      {/* Presets + Slider */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="order-amount-range"
            className="text-xs font-semibold text-arctic-700"
          >
            {tr("Montant de la commande client :", "Customer order amount:")}
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setOrderAmountXof(p)}
                className={`rounded-full px-3 py-1 text-xs font-bold transition-all ${
                  orderAmountXof === p
                    ? "bg-arctic-900 text-white shadow-xs"
                    : "border border-arctic-300/70 bg-white/80 text-arctic-800 hover:border-brand"
                }`}
              >
                {fmt(p)}
              </button>
            ))}
          </div>
        </div>

        <input
          id="order-amount-range"
          type="range"
          min={500}
          max={100000}
          step={500}
          value={orderAmountXof}
          onChange={(e) => setOrderAmountXof(Number(e.target.value))}
          className="h-6 w-full cursor-pointer appearance-none bg-transparent accent-arctic-900 [&::-moz-range-track]:h-2 [&::-moz-range-track]:rounded-shape-sm [&::-moz-range-track]:bg-arctic-200 [&::-webkit-slider-runnable-track]:h-2 [&::-webkit-slider-runnable-track]:rounded-shape-sm [&::-webkit-slider-runnable-track]:bg-arctic-200"
        />

        <div className="flex justify-between text-[11px] text-arctic-600">
          <span>{tr("500 FCFA (Petite commande)", "500 XOF (Small order)")}</span>
          <span>{tr("35 000 FCFA (Seuil du plafond)", "35,000 XOF (Cap threshold)")}</span>
          <span>100 000 FCFA</span>
        </div>
      </div>

      {/* Results Breakdown */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-shape-lg border border-arctic-200/80 bg-white/80 p-4">
          <div className="text-xs text-arctic-600">{tr("Prix payé par le client", "Price paid by customer")}</div>
          <div className="a-num mt-1 font-display text-2xl font-bold text-arctic-900">
            {fmt(orderAmountXof)}
          </div>
          <div className="mt-1 text-[11px] text-arctic-600">
            {tr("Via T-Money, Flooz, Wave ou Orange", "Via T-Money, Flooz, Wave, or Orange")}
          </div>
        </div>

        <div className="rounded-shape-lg border border-arctic-200/80 bg-white/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-arctic-600">{tr("Frais Japora tout compris", "All-in Japora fee")}</span>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand-dark">
              {effectivePct}%
            </span>
          </div>
          <div className="a-num mt-1 font-display text-2xl font-bold text-brand-dark">
            {fmt(feeXof)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-arctic-600">
            {/* Rule 6: SVG, not emoji — and BRAND_VOICE names the party
                popper as the exclamation mark it is. The sentence carries the news. */}
            {isFreeUnderFloor
              ? tr("Gratuit sous 2 000 FCFA.", "Free under 2,000 XOF.")
              : isCapped
              ? tr("Plafonné à 1 000 FCFA.", "Capped at 1,000 XOF.")
              : tr("3 % tout compris, frais opérateur inclus.", "3% all-in, operator fees included.")}
          </div>
        </div>

        <div className="rounded-shape-lg border border-emerald-500/35 bg-emerald-500/10 p-4">
          <div className="text-xs font-semibold text-emerald-900">
            {tr("Net reversé au commerçant", "Net paid to merchant")}
          </div>
          <div className="a-num mt-1 font-display text-2xl font-extrabold text-emerald-800">
            {fmt(vendorKeepsXof)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-800">
            {tr("En mode Starter (paiement direct) :", "With Starter (direct payment):")} {fmt(orderAmountXof)}
          </div>
        </div>
      </div>
    </div>
  );
}

