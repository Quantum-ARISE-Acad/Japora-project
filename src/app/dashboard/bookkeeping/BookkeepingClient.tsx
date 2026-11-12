"use client";

import { useMemo, useState } from "react";
import type { TopProduct } from "@/lib/bookkeeping";

type SummaryCard = {
  year: number;
  month: number;
  label: string;
  orderCount: number;
  revenueCents: number;
  avgOrderValueCents: number;
  openReceivablesCents: number;
  topProducts?: TopProduct[];
};

type Props = {
  currency: string;
  currentSummary: SummaryCard;
  lastSummary: SummaryCard;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatMoney(cents: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "XOF",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toFixed(2)}`;
  }
}

export default function BookkeepingClient({ currency, currentSummary, lastSummary }: Props) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const [pickedYear, setPickedYear] = useState<number>(lastSummary.year);
  const [pickedMonth, setPickedMonth] = useState<number>(lastSummary.month);

  const yearOptions = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
    return years;
  }, [currentYear]);

  const openReport = (year: number, month: number) => {
    const url = `/api/account/monthly-summary?year=${year}&month=${month}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const downloadOrdersCsv = (from?: string, to?: string) => {
    let url = "/api/account/orders-export";
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    window.open(url, "_blank");
  };

  const exportSummaryCSV = (s: SummaryCard) => {
    const headers = ["Métrique", "Valeur"];
    const rows = [
      ["Période", s.label],
      ["Nombre de commandes", String(s.orderCount)],
      ["Chiffre d'affaires", formatMoney(s.revenueCents, currency)],
      ["Panier moyen", formatMoney(s.avgOrderValueCents, currency)],
      ["Créances ouvertes (total)", formatMoney(s.openReceivablesCents, currency)],
      ["", ""],
      ["Top Produits", "Quantité | Revenu"],
      ...(s.topProducts || []).map((p) => [
        `"${p.name.replace(/"/g, '""')}"`,
        `${p.quantity} unités | ${formatMoney(p.revenueCents, currency)}`,
      ]),
    ];

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `comptabilite_${s.year}_${String(s.month).padStart(2, "0")}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderCard = (s: SummaryCard, title: string) => {
    const maxProductRevenue = Math.max(1, ...(s.topProducts || []).map((p) => p.revenueCents));

    return (
      <div className="card flex flex-col p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">{title}</h2>
          <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
            {s.label}
          </span>
        </div>

        {/* KPI Stats */}
        <div className="mt-4 grid grid-cols-3 gap-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-arctic-600">Orders</div>
            <div className="mt-1 text-xl font-bold text-arctic-900">{s.orderCount}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-arctic-600">Revenue</div>
            <div className="mt-1 text-xl font-bold text-arctic-900">{formatMoney(s.revenueCents, currency)}</div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-arctic-600">Avg. order</div>
            <div className="mt-1 text-xl font-bold text-arctic-900">{formatMoney(s.avgOrderValueCents, currency)}</div>
          </div>
        </div>

        {/* Open Receivables warning box */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-50/70 p-3 text-xs">
          <span className="text-arctic-700 font-medium">Créances ouvertes (impayées) :</span>
          <span className="font-bold text-amber-700">{formatMoney(s.openReceivablesCents, currency)}</span>
        </div>

        {/* Top Products sparkbars */}
        {s.topProducts && s.topProducts.length > 0 && (
          <div className="mt-5 space-y-2 border-t border-arctic-300/40 pt-4">
            <div className="text-xs font-semibold text-arctic-800">Top 5 produits vendus</div>
            <div className="space-y-2.5">
              {s.topProducts.slice(0, 5).map((p, idx) => {
                const pct = Math.min(100, Math.round((p.revenueCents / maxProductRevenue) * 100));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="truncate font-medium text-arctic-800">{p.name}</span>
                      <span className="text-arctic-600 font-mono">
                        {p.quantity}x · {formatMoney(p.revenueCents, currency)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-arctic-200/60 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all duration-medium"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mt-auto pt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => exportSummaryCSV(s)}
            className="btn-ghost flex-1 justify-center text-xs"
            title="Exporter le résumé en CSV"
          >
            📥 Résumé CSV
          </button>
          <button
            type="button"
            onClick={() => {
              const start = `${s.year}-${String(s.month).padStart(2, "0")}-01`;
              const nextMonth = s.month === 12 ? 1 : s.month + 1;
              const nextYear = s.month === 12 ? s.year + 1 : s.year;
              const end = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
              downloadOrdersCsv(start, end);
            }}
            className="btn-ghost flex-1 justify-center text-xs border border-emerald-300 text-emerald-800 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300"
            title="Exporter les commandes détaillées du mois pour Excel/Google Sheets"
          >
            📋 Commandes (CSV)
          </button>
          <button
            type="button"
            onClick={() => openReport(s.year, s.month)}
            className="btn-primary flex-1 justify-center text-xs"
          >
            🖨️ Imprimer / PDF
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Global Orders CSV Export for Accounting */}
      <div className="card p-5 border border-arctic-300/80 bg-white dark:bg-arctic-900 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-arctic-900 dark:text-white flex items-center gap-2">
              <span>📊</span> Export comptable complet des commandes (Excel / Google Sheets)
            </h2>
            <p className="mt-1 text-xs text-arctic-600 dark:text-arctic-400">
              Téléchargez l&apos;ensemble de vos commandes ligne par ligne avec statut, client, moyen de paiement et montants au format CSV compatible Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => downloadOrdersCsv()}
            className="btn-primary shrink-0 gap-2 text-xs py-2.5 px-4 !bg-emerald-600 hover:!bg-emerald-700 !text-white font-semibold shadow-sm"
          >
            <span>📥</span> Télécharger toutes les commandes (CSV)
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {renderCard(currentSummary, "This month (in progress)")}
        {renderCard(lastSummary, "Last completed month")}
      </div>

      {/* Month Navigator & Historical Archives */}
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-arctic-900">Archive comptable & rapports passés</h2>
        <p className="mt-1 text-xs text-arctic-600">
          Sélectionnez un mois pour générer le récapitulatif fiscal / bancaire complet avec déclaration imprimable.
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col text-xs font-medium text-arctic-700">
            Année
            <select
              value={pickedYear}
              onChange={(e) => setPickedYear(Number(e.target.value))}
              className="mt-1 rounded-lg border border-arctic-400/45 px-3 py-2 text-sm text-arctic-900"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col text-xs font-medium text-arctic-700">
            Mois
            <select
              value={pickedMonth}
              onChange={(e) => setPickedMonth(Number(e.target.value))}
              className="mt-1 rounded-lg border border-arctic-400/45 px-3 py-2 text-sm text-arctic-900"
            >
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => openReport(pickedYear, pickedMonth)}
            className="rounded-lg bg-arctic-800 px-4 py-2 text-sm font-semibold text-white hover:bg-arctic-900"
          >
            Ouvrir le rapport du mois
          </button>
        </div>
      </div>
    </div>
  );
}
