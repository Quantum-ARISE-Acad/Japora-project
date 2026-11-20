"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, waMeLink, digitsOnly } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";
import { isCustomerInactiveFor30Days, isCustomerVip } from "@/lib/customer-segments";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Row = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  orderCount: number;
  qualifyingOrderCount: number;
  totalSpentCents: number;
  lastOrderAt: string | null;
  createdAt: string;
};

type RecentOrder = {
  id: string;
  status: string;
  totalCents: number;
  paidCents: number;
  createdAt: string;
  source: string;
};

function timeAgo(iso: string | null, locale: "fr" | "en"): string {
  if (!iso) return locale === "fr" ? "jamais" : "never";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return locale === "fr" ? "à l’instant" : "just now";
  if (m < 60) return locale === "fr" ? `il y a ${m} min` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return locale === "fr" ? `il y a ${h} h` : `${h}h ago`;
  const d = Math.round(h / 24);
  return locale === "fr" ? `il y a ${d} j` : `${d}d ago`;
}

export default function CustomersClient({
  initialRows,
  total,
  initialQuery,
  currency,
  shopName,
}: {
  initialRows: Row[];
  total: number;
  initialQuery: string;
  currency: string;
  shopName: string;
}) {
  const router = useRouter();
  const { locale, tr } = usePublicLang();
  const [query, setQuery] = useState(initialQuery);
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Row | null>(null);
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [draftNotes, setDraftNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Debounced re-query against the API; falls back to a full refresh when
  // the query is cleared so the page-level data stays canonical.
  useEffect(() => {
    if (query === initialQuery) return;
    const handle = setTimeout(async () => {
      const params = new URLSearchParams();
      if (query) params.set("q", query);
      const res = await fetch(`/api/customers?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setRows(
        (data.customers || []).map((c: Row & { lastOrderAt: string | null }) => ({
          ...c,
          lastOrderAt: c.lastOrderAt ? new Date(c.lastOrderAt).toISOString() : null,
          createdAt: new Date(c.createdAt).toISOString(),
        })),
      );
    }, 200);
    return () => clearTimeout(handle);
  }, [query, initialQuery]);

  async function openDrawer(row: Row) {
    setSelected(row);
    setDraftNotes(row.notes);
    setRecent([]);
    const res = await fetch(`/api/customers/${row.id}`);
    if (res.ok) {
      const data = await res.json();
      setRecent(data.orders || []);
    }
  }

  async function saveNotes() {
    if (!selected) return;
    setSaving(true);
    const res = await fetch(`/api/customers/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: draftNotes }),
    });
    setSaving(false);
    if (res.ok) {
      setRows((rs) =>
        rs.map((r) => (r.id === selected.id ? { ...r, notes: draftNotes } : r)),
      );
      setSelected({ ...selected, notes: draftNotes });
    }
  }

  const [segmentFilter, setSegmentFilter] = useState<"all" | "vip" | "recent" | "inactive">("all");
  const [sortBy, setSortBy] = useState<"spent" | "orders" | "recent">("spent");

  const visible = useMemo(() => {
    let list = [...rows];

    if (segmentFilter === "vip") {
      list = list.filter((r) => isCustomerVip({ qualifyingOrderCount: r.qualifyingOrderCount }));
    } else if (segmentFilter === "recent") {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      list = list.filter((r) => r.lastOrderAt && new Date(r.lastOrderAt).getTime() >= thirtyDaysAgo);
    } else if (segmentFilter === "inactive") {
      list = list.filter((r) => isCustomerInactiveFor30Days(r.lastOrderAt));
    }

    if (sortBy === "spent") {
      list.sort((a, b) => b.totalSpentCents - a.totalSpentCents);
    } else if (sortBy === "orders") {
      list.sort((a, b) => b.orderCount - a.orderCount);
    } else if (sortBy === "recent") {
      list.sort((a, b) => {
        const timeA = a.lastOrderAt ? new Date(a.lastOrderAt).getTime() : 0;
        const timeB = b.lastOrderAt ? new Date(b.lastOrderAt).getTime() : 0;
        return timeB - timeA;
      });
    }

    return list;
  }, [rows, segmentFilter, sortBy]);

  function exportCSV() {
    const headers = locale === "fr"
      ? ["Nom", "Téléphone", "E-mail", "Commandes", "Total dépensé", "Dernière commande", "Notes"]
      : ["Name", "Phone", "Email", "Orders", "Total spent", "Last order", "Notes"];
    const csvRows = visible.map((c) => [
      `"${c.name.replace(/"/g, '""')}"`,
      `"${c.phone}"`,
      `"${c.email || ""}"`,
      c.orderCount,
      `${(c.totalSpentCents / 100).toFixed(2)} ${currency}`,
      c.lastOrderAt
        ? new Date(c.lastOrderAt).toLocaleDateString(locale === "fr" ? "fr-FR" : "en-US")
        : tr("Jamais", "Never"),
      `"${(c.notes || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...csvRows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${locale === "fr" ? "clients" : "customers"}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">{tr("Clients", "Customers")}</h1>
          <p className="text-sm text-arctic-600">
            {total} {locale === "fr" ? (total === 1 ? "acheteur enregistré." : "acheteurs enregistrés.") : (total === 1 ? "buyer" : "buyers")} {tr("Cliquez sur une ligne pour voir les détails.", "on record. Select a row to view details.")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportCSV}
            className="btn-ghost gap-1.5 text-xs font-semibold"
            title={tr("Exporter la liste des clients en CSV", "Export customers as CSV")}
          >
            📥 {tr("Exporter CSV", "Export CSV")}
          </button>
        </div>
      </div>

      {/* Toolbar filters */}
      <div className="customers-filter-track mb-4 flex flex-wrap items-center justify-between gap-3 rounded-shape-lg border border-arctic-300/40 bg-white p-3">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={tr("Rechercher un nom, téléphone ou e-mail…", "Search name, phone, or email…")}
          className="input min-w-[220px] flex-1 text-sm"
        />

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-arctic-100 p-0.5">
            <button
              type="button"
              onClick={() => setSegmentFilter("all")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                segmentFilter === "all" ? "bg-arctic-800 text-white" : "customers-filter-inactive text-arctic-700 hover:text-arctic-900"
              }`}
            >
              {tr("Tous", "All")} ({rows.length})
            </button>
            <button
              type="button"
              onClick={() => setSegmentFilter("vip")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                segmentFilter === "vip" ? "bg-amber-600 text-white" : "customers-filter-inactive text-arctic-700 hover:text-arctic-900"
              }`}
            >
              ⭐ VIP (≥3 {tr("cmd", "orders")})
            </button>
            <button
              type="button"
              onClick={() => setSegmentFilter("recent")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                segmentFilter === "recent" ? "bg-emerald-600 text-white" : "customers-filter-inactive text-arctic-700 hover:text-arctic-900"
              }`}
            >
              {tr("Récents (30 j)", "Recent (30d)")}
            </button>
            <button
              type="button"
              onClick={() => setSegmentFilter("inactive")}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                segmentFilter === "inactive" ? "bg-rose-600 text-white" : "customers-filter-inactive text-arctic-700 hover:text-arctic-900"
              }`}
            >
              {tr("Inactifs (≥30 j)", "Inactive (≥30d)")}
            </button>
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="input !w-auto text-xs font-medium"
          >
            <option value="spent">{tr("Tri : total dépensé", "Sort: total spent")}</option>
            <option value="orders">{tr("Tri : nombre de commandes", "Sort: order count")}</option>
            <option value="recent">{tr("Tri : dernière commande", "Sort: last order")}</option>
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-arctic-400/30 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-arctic-100/55 text-left text-xs font-semibold uppercase tracking-wide text-arctic-600">
            <tr>
              <th className="px-4 py-3">{tr("Nom", "Name")}</th>
              <th className="px-4 py-3">{tr("Téléphone", "Phone")}</th>
              <th className="px-4 py-3 text-right">{tr("Commandes", "Orders")}</th>
              <th className="px-4 py-3 text-right">{tr("Total dépensé", "Total spent")}</th>
              <th className="px-4 py-3">{tr("Dernière commande", "Last order")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6">
                  <AuroraIsoscout
                    variant="customers"
                    title={tr("Aucun client pour le moment", "No customers yet")}
                    body={tr(
                      "Ils apparaîtront automatiquement après la première commande. Partagez votre catalogue : le bot créera une fiche client à chaque nouveau numéro.",
                      "They'll appear automatically after the first order. Share your catalog link and the bot will create a customer record for each new phone number.",
                    )}
                  />
                </td>
              </tr>
            ) : (
              visible.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => openDrawer(r)}
                  className="cursor-pointer border-t border-arctic-400/20 hover:bg-arctic-100/55"
                >
                  <td className="px-4 py-3 font-medium text-arctic-900">{r.name}</td>
                  <td className="px-4 py-3 text-arctic-700">
                    {r.phone ? (
                      <a
                        href={waMeLink(r.phone)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-brand-dark hover:underline"
                      >
                        {r.phone}
                      </a>
                    ) : (
                      <span className="text-arctic-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.orderCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {formatMoney(r.totalSpentCents, currency)}
                  </td>
                  <td className="px-4 py-3 text-arctic-600">{timeAgo(r.lastOrderAt, locale)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected && (
        <>
          <div
            className="fixed inset-0 z-30 bg-arctic-900/40"
            onClick={() => setSelected(null)}
          />
          <aside className="fixed right-0 top-0 z-40 flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="a-title-lg text-arctic-900">{selected.name}</h2>
                <p className="text-xs text-arctic-600">
                  {tr("Client de", "Customer of")} {shopName} · {selected.orderCount} {tr("commande", "order")}
                  {selected.orderCount === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-arctic-500 hover:text-arctic-800"
                aria-label={tr("Fermer", "Close")}
              >
                ✕
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-lg bg-arctic-100/55 p-3 text-sm">
              <div>
                <dt className="text-xs text-arctic-600">{tr("Téléphone", "Phone")}</dt>
                <dd className="font-medium text-arctic-900">{selected.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-arctic-600">{tr("Total dépensé", "Total spent")}</dt>
                <dd className="font-semibold text-arctic-900">
                  {formatMoney(selected.totalSpentCents, currency)}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-arctic-600">{tr("E-mail", "Email")}</dt>
                <dd className="font-medium text-arctic-900">{selected.email || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-arctic-600">{tr("Dernière commande", "Last order")}</dt>
                <dd className="font-medium text-arctic-900">
                  {timeAgo(selected.lastOrderAt, locale)}
                </dd>
              </div>
            </dl>

            <div className="flex gap-2">
              {selected.phone && (
                <a
                  href={waMeLink(
                    selected.phone,
                    tr(
                      `Bonjour ${selected.name}, c’est ${shopName}.`,
                      `Hi ${selected.name}, this is ${shopName}.`,
                    ),
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-lg bg-brand px-3 py-2 text-center text-sm font-semibold text-white hover:bg-brand-dark"
                >
                  {tr("Envoyer un WhatsApp", "Send WhatsApp")}
                </a>
              )}
              <button
                onClick={() => router.push(`/dashboard/orders?phone=${digitsOnly(selected.phone)}`)}
                className="flex-1 rounded-lg border border-arctic-400/30 px-3 py-2 text-sm font-semibold text-arctic-800 hover:bg-arctic-100/55"
              >
                {tr("Voir les commandes", "View orders")}
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-arctic-600">
                {tr("Notes", "Notes")}
              </label>
              <textarea
                value={draftNotes}
                onChange={(e) => setDraftNotes(e.target.value)}
                rows={5}
                className="mt-1 w-full rounded-lg border border-arctic-400/30 p-2 text-sm focus:border-brand focus:outline-none"
                placeholder={tr("Tailles préférées, consignes de livraison…", "Preferred sizes, delivery notes, allergies…")}
              />
              <button
                onClick={saveNotes}
                disabled={saving || draftNotes === selected.notes}
                className="mt-2 w-full rounded-lg bg-arctic-800 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? tr("Enregistrement…", "Saving…") : tr("Enregistrer les notes", "Save notes")}
              </button>
            </div>

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-arctic-600">
                {tr("Commandes récentes", "Recent orders")}
              </h3>
              {recent.length === 0 ? (
                <p className="mt-2 text-sm text-arctic-500">{tr("Aucune commande associée pour le moment.", "No orders linked yet.")}</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-sm">
                  {recent.map((o) => (
                    <li
                      key={o.id}
                      className="flex items-center justify-between rounded-lg border border-arctic-400/20 px-3 py-2"
                    >
                      <span className="font-mono text-xs text-arctic-600">
                        {o.id.slice(-6)}
                      </span>
                      <span className="text-xs text-arctic-600">{o.status}</span>
                      <span className="font-semibold">
                        {formatMoney(o.totalCents, currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
