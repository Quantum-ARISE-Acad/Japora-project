"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, waMeLink } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Row = {
  id: string;
  amountCents: number;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  note: string;
  createdAt: string;
  customer: { id: string; name: string; phone: string } | null;
  order: { id: string; customerName: string; totalCents: number } | null;
};

const STATUS_BADGE: Record<string, string> = {
  OPEN: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  PAID: "bg-emerald-100 text-emerald-800",
  WRITTEN_OFF: "bg-arctic-300 text-arctic-700",
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function isOverdue(iso: string | null, status: string): boolean {
  if (!iso) return false;
  if (status === "PAID" || status === "WRITTEN_OFF") return false;
  return new Date(iso).getTime() < Date.now();
}

function displayName(r: Row): string {
  return r.customer?.name || r.order?.customerName || "Walk-in";
}

function reminderText(r: Row, shopName: string, currency: string): string {
  const name = displayName(r).split(" ")[0] || "there";
  const due = r.dueDate ? ` (due ${fmtDate(r.dueDate)})` : "";
  return `Hi ${name}, gentle reminder from ${shopName}: a balance of ${formatMoney(
    r.amountCents,
    currency,
  )} is outstanding${due}. When can we expect it? Thanks!`;
}

export default function ReceivablesClient({
  initialRows,
  outstandingCents,
  currency,
  shopName,
}: {
  initialRows: Row[];
  outstandingCents: number;
  currency: string;
  shopName: string;
}) {
  const router = useRouter();
  const { tr } = usePublicLang();
  const [rows, setRows] = useState(initialRows);
  const [busy, setBusy] = useState<string | null>(null);

  // Group rows by customer (or order fallback) so a single buyer's debts
  // sit together — matches the way vendors mentally model their notebook.
  const grouped = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; rows: Row[] }>();
    for (const r of rows) {
      const key = r.customer?.id ?? `order:${r.order?.id ?? r.id}`;
      const name = displayName(r);
      const phone = r.customer?.phone || "";
      const bucket = map.get(key) ?? { name, phone, rows: [] };
      bucket.rows.push(r);
      map.set(key, bucket);
    }
    return Array.from(map.values());
  }, [rows]);

  async function markPaid(r: Row) {
    setBusy(r.id);
    const res = await fetch(`/api/receivables/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "paid" }),
    });
    setBusy(null);
    if (res.ok) {
      setRows((rs) =>
        rs.map((row) =>
          row.id === r.id
            ? { ...row, status: "PAID", paidAt: new Date().toISOString(), amountCents: 0 }
            : row,
        ),
      );
      router.refresh();
    }
  }

  async function writeOff(r: Row) {
    if (!confirm(`Write off ${formatMoney(r.amountCents, currency)} from ${displayName(r)}?`)) return;
    setBusy(r.id);
    const res = await fetch(`/api/receivables/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "write_off" }),
    });
    setBusy(null);
    if (res.ok) {
      setRows((rs) =>
        rs.map((row) => (row.id === r.id ? { ...row, status: "WRITTEN_OFF" } : row)),
      );
      router.refresh();
    }
  }

  async function sendReminder(r: Row) {
    const phone = r.customer?.phone;
    if (!phone) {
      alert("No phone on file for this customer.");
      return;
    }
    const body = reminderText(r, shopName, currency);
    // Server-side send if the WhatsApp provider is configured; fall back to
    // the wa.me deep link so the vendor can always send manually.
    try {
      await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: phone, body }),
      });
    } catch {
      // Non-fatal — we still open the deep link below.
    }
    window.open(waMeLink(phone, body), "_blank", "noreferrer");
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">
            {tr("Créances clients", "Receivables")}
          </h1>
          <p className="text-sm text-arctic-600">
            {tr(
              "Suivez les soldes impayés et relancez vos clients en un clic sur WhatsApp.",
              "The structured version of your credit notebook.",
            )}
          </p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
            {tr("Total impayé", "Total outstanding")}
          </div>
          <div className="text-2xl font-bold text-amber-900">
            {formatMoney(outstandingCents, currency)}
          </div>
        </div>
      </div>

      {grouped.length === 0 ? (
        <div className="glass glass-edge rounded-shape-lg p-6">
          <AuroraIsoscout
            variant="receivables"
            title={tr("Aucune créance en cours", "No open tabs")}
            body={tr(
              "Une créance apparaît ici lorsqu'une commande est expédiée avant paiement complet (vente à crédit, acompte, etc.).",
              "A receivable lands here whenever an order ships unpaid (credit sale, M-Pesa pending, etc.). You can also add one manually from above.",
            )}
          />
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map((g, i) => (
            <section
              key={i}
              className="overflow-hidden rounded-xl border border-arctic-400/30 bg-white"
            >
              <header className="flex items-center justify-between border-b border-arctic-400/20 bg-arctic-100/55 px-4 py-2">
                <div>
                  <div className="font-semibold text-arctic-900">{g.name}</div>
                  {g.phone && (
                    <a
                      href={waMeLink(g.phone)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-brand-dark hover:underline"
                    >
                      {g.phone}
                    </a>
                  )}
                </div>
                <div className="text-sm font-semibold text-arctic-800">
                  {formatMoney(
                    g.rows
                      .filter((r) => r.status === "OPEN" || r.status === "PARTIAL")
                      .reduce((s, r) => s + r.amountCents, 0),
                    currency,
                  )}{" "}
                  {tr("ouvert", "open")}
                </div>
              </header>

              <table className="w-full text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-arctic-600">
                  <tr>
                    <th className="px-4 py-2">{tr("Statut", "Status")}</th>
                    <th className="px-4 py-2 text-right">{tr("Montant dû", "Amount due")}</th>
                    <th className="px-4 py-2">{tr("Échéance", "Due")}</th>
                    <th className="px-4 py-2">Note</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => {
                    const overdue = isOverdue(r.dueDate, r.status);
                    return (
                      <tr key={r.id} className="border-t border-arctic-400/20">
                        <td className="px-4 py-2">
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[r.status] || "bg-arctic-200/65 text-arctic-800"}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums font-semibold">
                          {formatMoney(r.amountCents, currency)}
                        </td>
                        <td
                          className={`px-4 py-2 ${overdue ? "font-semibold text-red-600" : "text-arctic-700"}`}
                        >
                          {fmtDate(r.dueDate)}
                          {overdue && tr(" (en retard)", " (overdue)")}
                        </td>
                        <td className="px-4 py-2 text-arctic-600">{r.note || "—"}</td>
                        <td className="px-4 py-2">
                          <div className="flex justify-end gap-2">
                            {(r.status === "OPEN" || r.status === "PARTIAL") && (
                              <>
                                <button
                                  onClick={() => sendReminder(r)}
                                  className="rounded-lg border border-arctic-400/30 px-2.5 py-1 text-xs font-semibold text-arctic-800 hover:bg-arctic-100/55"
                                >
                                  {tr("Relancer", "Remind")}
                                </button>
                                <button
                                  onClick={() => markPaid(r)}
                                  disabled={busy === r.id}
                                  className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-dark disabled:opacity-50"
                                >
                                  {tr("Marquer payé", "Mark paid")}
                                </button>
                                <button
                                  onClick={() => writeOff(r)}
                                  disabled={busy === r.id}
                                  className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                                >
                                  {tr("Annuler dette", "Write off")}
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
