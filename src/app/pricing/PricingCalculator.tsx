"use client";

import { useState } from "react";

const PRESETS = [1500, 5000, 15000, 35000, 75000];

export default function PricingCalculator() {
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
          <span className="a-eyebrow">Simulateur de Commission en Direct</span>
          <h2 className="a-title-lg mt-1 font-display text-arctic-900">
            Calculez exactement ce que vous gardez sur chaque vente
          </h2>
        </div>
        <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800">
          Frais Mobile Money inclus
        </span>
      </div>

      {/* Presets + Slider */}
      <div className="mt-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="order-amount-range"
            className="text-xs font-semibold text-arctic-700"
          >
            Montant de la commande client :
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
          className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-arctic-200 accent-arctic-900"
        />

        <div className="flex justify-between text-[11px] text-arctic-500">
          <span>500 FCFA (Petite commande)</span>
          <span>35 000 FCFA (Seuil du plafond)</span>
          <span>100 000 FCFA</span>
        </div>
      </div>

      {/* Results Breakdown */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-shape-lg border border-arctic-200/80 bg-white/80 p-4">
          <div className="text-xs text-arctic-600">Prix payé par le client</div>
          <div className="a-num mt-1 font-display text-2xl font-bold text-arctic-900">
            {fmt(orderAmountXof)}
          </div>
          <div className="mt-1 text-[11px] text-arctic-500">
            Via T-Money, Flooz, Wave ou Orange
          </div>
        </div>

        <div className="rounded-shape-lg border border-arctic-200/80 bg-white/80 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs text-arctic-600">Frais Japora tout compris</span>
            <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold text-brand-dark">
              {effectivePct}%
            </span>
          </div>
          <div className="a-num mt-1 font-display text-2xl font-bold text-brand-dark">
            {fmt(feeXof)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-arctic-600">
            {isFreeUnderFloor
              ? "🎉 0 FCFA sous 2 000 FCFA !"
              : isCapped
              ? "🔒 Plafonné au maximum de 1 000 FCFA"
              : "3% standard (frais opérateur inclus)"}
          </div>
        </div>

        <div className="rounded-shape-lg border border-emerald-500/35 bg-emerald-500/10 p-4">
          <div className="text-xs font-semibold text-emerald-900">
            Net reversé au commerçant
          </div>
          <div className="a-num mt-1 font-display text-2xl font-extrabold text-emerald-800">
            {fmt(vendorKeepsXof)}
          </div>
          <div className="mt-1 text-[11px] font-medium text-emerald-800">
            ✓ En mode Starter (paiement direct) : {fmt(orderAmountXof)}
          </div>
        </div>
      </div>
    </div>
  );
}

