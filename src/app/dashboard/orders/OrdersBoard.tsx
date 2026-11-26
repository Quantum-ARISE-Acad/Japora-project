"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney, parseSizes, waMeLink, type OrderStatus } from "@/lib/utils";
import Glyph from "@/components/Glyph";
import { usePublicLang } from "@/components/PublicLanguageProvider";

type Item = {
  id: string;
  productName: string;
  size: string;
  quantity: number;
  unitPriceCents: number;
};

type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  totalCents: number;
  note: string;
  source: string;
  createdAt: string;
  items: Item[];
};

type ProductOption = {
  id: string;
  name: string;
  priceCents: number;
  sizes: string;
  stock: number;
};

function parseDealMetadata(note: string, source: string) {
  const raw = note || "";
  const m = raw.match(/^\[DEAL_(PENDING|ACCEPTED|REJECTED)(?:\|orig:(\d+)\|prop:(\d+))?\]\s*/);
  if (!m) {
    return {
      isDeal: source === "whatsapp_deal",
      dealState: "PENDING" as const,
      originalCents: undefined,
      proposedCents: undefined,
      cleanNote: raw,
    };
  }
  return {
    isDeal: true,
    dealState: m[1] as "PENDING" | "ACCEPTED" | "REJECTED",
    originalCents: m[2] ? parseInt(m[2], 10) : undefined,
    proposedCents: m[3] ? parseInt(m[3], 10) : undefined,
    cleanNote: raw.slice(m[0].length).trim(),
  };
}

const COLUMNS: { key: OrderStatus; titleFr: string; titleEn: string; dot: string; tint: string }[] = [
  { key: "NEW",       titleFr: "Nouvelles",  titleEn: "New",       dot: "bg-blue-500",   tint: "bg-blue-50" },
  { key: "CONFIRMED", titleFr: "Confirmées", titleEn: "Confirmed", dot: "bg-aurora-warning",  tint: "bg-aurora-warning-bg" },
  { key: "PAID",      titleFr: "Payées",     titleEn: "Paid",      dot: "bg-brand",      tint: "bg-arctic-100/60" },
  { key: "DELIVERED", titleFr: "Livrées",    titleEn: "Delivered", dot: "bg-arctic-500", tint: "bg-arctic-200/65" },
];

function actionsFor(
  status: string,
  isDeal = false,
  tr: <T = string>(fr: T, en: T) => T = (fr) => fr,
): { label: string; to: OrderStatus; primary?: boolean; danger?: boolean }[] {
  switch (status) {
    case "NEW":
      return isDeal
        ? [
            { label: tr("Valider le Deal", "Approve Deal"), to: "CONFIRMED", primary: true },
            { label: tr("Refuser le Deal", "Reject Deal"), to: "CANCELLED", danger: true },
          ]
        : [
            { label: tr("Confirmer", "Confirm"), to: "CONFIRMED", primary: true },
            { label: tr("Annuler", "Cancel"), to: "CANCELLED" },
          ];
    case "CONFIRMED":
      return [
        { label: tr("Marquer payée", "Mark paid"), to: "PAID", primary: true },
        { label: tr("← Nouvelle", "← New"), to: "NEW" },
        { label: tr("Annuler", "Cancel"), to: "CANCELLED" },
      ];
    case "PAID":
      return [
        { label: tr("Marquer livrée", "Mark delivered"), to: "DELIVERED", primary: true },
        { label: tr("← Confirmée", "← Confirmed"), to: "CONFIRMED" },
      ];
    case "DELIVERED":
      return [{ label: tr("↩ Réouvrir", "↩ Reopen"), to: "PAID" }];
    case "CANCELLED":
      return [{ label: tr("Restaurer", "Restore"), to: "NEW", primary: true }];
    default:
      return [];
  }
}

function notifyText(o: Order, shopName: string, currency: string): string {
  const total = formatMoney(o.totalCents, currency);
  switch (o.status) {
    case "CONFIRMED": return `Hi ${o.customerName}, your order from ${shopName} is confirmed! Total: ${total}. We'll let you know once it's ready. — ${shopName}`;
    case "PAID":      return `Hi ${o.customerName}, we've received your payment of ${total}. Your order is being prepared. — ${shopName}`;
    case "DELIVERED": return `Hi ${o.customerName}, your order has been delivered. Thank you for shopping with ${shopName}! 💚`;
    case "CANCELLED": return `Hi ${o.customerName}, your order from ${shopName} has been cancelled. Reply if you'd like to reorder.`;
    default:          return `Hi ${o.customerName}, an update on your order from ${shopName} (total ${total}).`;
  }
}

function payLinkText(o: Order, shopName: string, currency: string, payUrl: string): string {
  const total = formatMoney(o.totalCents, currency);
  return `Hi ${o.customerName}, here's your secure payment link for your ${shopName} order (${total}): ${payUrl}\n\nPay by dial code (T-Money / Flooz) — it works on any phone, no app needed.`;
}

function timeAgo(iso: string, locale: "fr" | "en"): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return locale === "fr" ? "à l’instant" : "just now";
  if (m < 60) return locale === "fr" ? `il y a ${m} min` : `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return locale === "fr" ? `il y a ${h} h` : `${h}h ago`;
  const d = Math.round(h / 24);
  return locale === "fr" ? `il y a ${d} j` : `${d}d ago`;
}

export default function OrdersBoard({
  initialOrders,
  products,
  currency,
  shopName,
}: {
  initialOrders: Order[];
  products: ProductOption[];
  currency: string;
  shopName: string;
}) {
  const router = useRouter();
  const { tr } = usePublicLang();
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [showCancelled, setShowCancelled] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);
  const [query, setQuery] = useState("");
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "7d" | "30d">("all");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/orders", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const dto: Order[] = data.orders.map((o: {
          id: string; customerName: string; customerPhone: string; status: string;
          totalCents: number; note: string; source: string; createdAt: string;
          items: Item[];
        }) => ({
          id: o.id, customerName: o.customerName, customerPhone: o.customerPhone,
          status: o.status, totalCents: o.totalCents, note: o.note, source: o.source,
          createdAt: o.createdAt,
          items: o.items.map((i) => ({
            id: i.id, productName: i.productName, size: i.size,
            quantity: i.quantity, unitPriceCents: i.unitPriceCents,
          })),
        }));
        setOrders(dto);
      }
      if (!silent) router.refresh();
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, [router]);

  // Live poll every 4 seconds so WhatsApp orders & deal proposals appear in real-time
  useEffect(() => {
    const interval = setInterval(() => {
      void reload(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [reload]);

  const pendingDeals = useMemo(
    () =>
      orders.filter((o) => {
        if (o.status !== "NEW") return false;
        const dm = parseDealMetadata(o.note, o.source);
        return dm.isDeal;
      }),
    [orders],
  );

  const byStatus = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesQuery = (o: Order) =>
      !q ||
      o.customerName.toLowerCase().includes(q) ||
      o.customerPhone.includes(q) ||
      o.items.some((i) => i.productName.toLowerCase().includes(q));

    const matchesDate = (o: Order) => {
      if (dateFilter === "all") return true;
      const created = new Date(o.createdAt).getTime();
      if (dateFilter === "today") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        return created >= d.getTime();
      }
      if (dateFilter === "7d") return created >= Date.now() - 7 * 86400000;
      if (dateFilter === "30d") return created >= Date.now() - 30 * 86400000;
      return true;
    };

    const m: Record<string, Order[]> = { NEW: [], CONFIRMED: [], PAID: [], DELIVERED: [], CANCELLED: [] };
    for (const o of orders) {
      if (matchesQuery(o) && matchesDate(o)) {
        (m[o.status] ?? (m[o.status] = [])).push(o);
      }
    }
    return m;
  }, [orders, query, dateFilter]);

  function exportCSV() {
    const filteredList = Object.values(byStatus).flat();
    const headers = ["ID", "Date", "Client", "Telephone", "Statut", "Total", "Source", "Articles", "Note"];
    const rows = filteredList.map((o) => [
      o.id.slice(0, 8),
      new Date(o.createdAt).toLocaleString(),
      `"${o.customerName.replace(/"/g, '""')}"`,
      `"${o.customerPhone}"`,
      o.status,
      `${(o.totalCents / 100).toFixed(2)} ${currency}`,
      o.source,
      `"${o.items.map((it) => `${it.productName} (x${it.quantity})`).join("; ").replace(/"/g, '""')}"`,
      `"${(o.note || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `orders_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }


  async function move(order: Order, to: OrderStatus) {
    setOrders((curr) => curr.map((o) => (o.id === order.id ? { ...o, status: to } : o)));
    const res = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: to }),
    });
    if (!res.ok) {
      await reload();
    } else {
      const data = await res.json().catch(() => ({}));
      if (typeof data.note === "string") {
        setOrders((curr) =>
          curr.map((o) => (o.id === order.id ? { ...o, status: to, note: data.note } : o)),
        );
      }
      flash(
        order.id,
        to === "CONFIRMED"
          ? tr("Confirmé et notification WhatsApp envoyée", "Confirmed & WhatsApp notification sent")
          : to === "CANCELLED"
          ? tr("Annulé et client notifié", "Cancelled & customer notified")
          : `${tr("Statut", "Status")} → ${to}`,
      );
      router.refresh();
    }
  }

  async function remove(order: Order) {
    if (!confirm(tr(`Supprimer la commande de ${order.customerName} ?`, `Delete order from ${order.customerName}?`))) return;
    setOrders((curr) => curr.filter((o) => o.id !== order.id));
    await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
    router.refresh();
  }

  async function notifyViaApi(order: Order) {
    if (!order.customerPhone) {
      flash(order.id, tr("Aucun numéro de téléphone enregistré.", "No phone number on file."));
      return;
    }
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: order.customerPhone,
        body: notifyText(order, shopName, currency),
        orderId: order.id,
      }),
    });
    const data = await res.json().catch(() => ({}));
    flash(order.id, `WhatsApp: ${data.provider ?? "?"} → ${data.status ?? "error"}`);
  }

  function flash(id: string, text: string) {
    setToast({ id, text });
    setTimeout(() => setToast((t) => (t?.id === id ? null : t)), 3500);
  }

  const cancelled = byStatus.CANCELLED ?? [];
  const columnTitle = (key: OrderStatus) => tr(
    ({ NEW: "Nouvelle", CONFIRMED: "Confirmée", PAID: "Payée", DELIVERED: "Livrée" } as Partial<Record<OrderStatus, string>>)[key] ?? key,
    ({ NEW: "New", CONFIRMED: "Confirmed", PAID: "Paid", DELIVERED: "Delivered" } as Partial<Record<OrderStatus, string>>)[key] ?? key,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="a-headline-md text-arctic-900">{tr("Commandes et offres WhatsApp", "Orders & WhatsApp deals")}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-arctic-200/70 px-2.5 py-0.5 text-[11px] font-bold text-signal-text border border-emerald-300">
              <span className="h-2 w-2 rounded-full bg-signal-fill animate-pulse" />
              {tr("Synchronisation WhatsApp en direct", "Live WhatsApp sync")}
            </span>
          </div>
          <p className="text-sm text-arctic-600">
            {orders.length} {tr(orders.length === 1 ? "commande" : "commandes", orders.length === 1 ? "order" : "orders")}. {tr("Validez les offres proposées par vos clients sur WhatsApp et suivez les commandes en temps réel.", "Approve customer offers on WhatsApp and track orders in real time.")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void reload(false)}
            disabled={refreshing}
            className="btn-ghost btn-sm font-semibold"
            title={tr("Actualiser les commandes WhatsApp", "Refresh WhatsApp orders")}
          >
            {refreshing ? `${tr("Synchronisation…", "Syncing…")}` : `${tr("Actualiser", "Refresh")}`}
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="btn-ghost btn-sm font-semibold"
            title={tr("Télécharger les commandes filtrées au format CSV", "Download filtered orders as CSV")}
          >
            <Glyph name="import" size={14} /> {tr("Exporter CSV", "Export CSV")}
          </button>
          <button onClick={() => setManualOpen(true)} className="btn-primary">
            + {tr("Ajouter une commande", "Add order")}
          </button>
        </div>
      </div>

      {/* Propositions de Deal en attente de validation */}
      {pendingDeals.length > 0 && (
        <div className="rounded-2xl border-2 border-aurora-warning/40 bg-gradient-to-r from-amber-50 via-white to-emerald-50/40 p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-shape-md bg-aurora-warning text-white">
                <Glyph name="receipt" size={16} />
              </span>
              <div>
                <h2 className="text-sm font-bold text-arctic-900">
                  {pendingDeals.length} {tr(pendingDeals.length > 1 ? "offres en attente de validation" : "offre en attente de validation", pendingDeals.length > 1 ? "offers awaiting your approval" : "offer awaiting your approval")}
                </h2>
                <p className="text-xs text-arctic-600">
                  {tr("En validant l’offre, la commande est confirmée et le client reçoit automatiquement une notification WhatsApp avec son lien de paiement.", "Approving the offer confirms the order and automatically sends the customer a WhatsApp notification with a payment link.")}
                </p>
              </div>
            </div>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {pendingDeals.map((o) => (
              <OrderCard
                key={`deal-${o.id}`}
                o={o}
                currency={currency}
                shopName={shopName}
                onMove={move}
                onDelete={remove}
                onNotify={notifyViaApi}
                toast={toast?.id === o.id ? toast.text : null}
              />
            ))}
          </div>
        </div>
      )}

      <div className="orders-filter-toolbar card flex flex-wrap items-center gap-3 p-3">
        <input
          className="input min-w-[200px] flex-1"
          aria-label={tr("Rechercher une commande", "Search orders")}
          placeholder={tr("Rechercher un client, un téléphone ou un produit…", "Search customer name, phone, or product…")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as "all" | "today" | "7d" | "30d")}
          className="input !w-auto text-xs font-medium"
        >
          <option value="all">{tr("Toutes les dates", "All dates")}</option>
          <option value="today">{tr("Aujourd’hui", "Today")}</option>
          <option value="7d">{tr("7 derniers jours", "Last 7 days")}</option>
          <option value="30d">{tr("30 derniers jours", "Last 30 days")}</option>
        </select>

        <div className="flex flex-wrap gap-1">
          {COLUMNS.map((col) => {
            const active = !hidden.has(col.key);
            const count = byStatus[col.key]?.length || 0;
            return (
              <button
                key={col.key}
                onClick={() =>
                  setHidden((h) => {
                    const c = new Set(h);
                    if (active) c.add(col.key);
                    else c.delete(col.key);
                    return c;
                  })
                }
                className={
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition " +
                  (active
                    ? "bg-arctic-800 text-white hover:bg-arctic-700"
                    : "orders-status-filter-inactive bg-arctic-200/65 text-arctic-600 line-through hover:bg-arctic-300")
                }
              >
                <span>{columnTitle(col.key)}</span>
                <span
                  className={
                    "rounded-full px-1.5 py-0.2 text-[10px] " +
                    (active ? "bg-white/20 text-white" : "bg-arctic-400/30 text-arctic-700")
                  }
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-4"
      >
        {COLUMNS.filter((c) => !hidden.has(c.key)).map((col) => {
          const items = byStatus[col.key] ?? [];
          return (
            <div
              key={col.key}
              className={`flex w-[85vw] shrink-0 snap-start flex-col rounded-xl ${col.tint} p-3 md:w-auto md:shrink`}
            >
              <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 flex items-center justify-between rounded-t-xl bg-inherit px-4 pb-2 pt-3 md:static md:m-0 md:mb-2 md:rounded-none md:bg-transparent md:p-1">
                <div className="flex items-center gap-2 text-sm font-semibold text-arctic-800">
                  <span className={`h-2 w-2 rounded-full ${col.dot}`} />
                  {columnTitle(col.key)}
                </div>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-arctic-700">
                  {items.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {items.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-arctic-600">{tr("Aucune commande ici", "No orders here")}</p>
                )}
                {items.map((o) => (
                  <OrderCard
                    key={o.id}
                    o={o}
                    currency={currency}
                    shopName={shopName}
                    onMove={move}
                    onDelete={remove}
                    onNotify={notifyViaApi}
                    toast={toast?.id === o.id ? toast.text : null}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {cancelled.length > 0 && (
        <div className="card p-4">
          <button
            onClick={() => setShowCancelled((s) => !s)}
            className="flex w-full items-center justify-between text-left text-sm font-semibold text-arctic-800"
          >
            <span>{tr("Annulées", "Cancelled")} ({cancelled.length})</span>
            <span className="text-arctic-600">{showCancelled ? tr("Masquer", "Hide") : tr("Afficher", "Show")}</span>
          </button>
          {showCancelled && (
            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
              {cancelled.map((o) => (
                <OrderCard
                  key={o.id}
                  o={o}
                  currency={currency}
                  shopName={shopName}
                  onMove={move}
                  onDelete={remove}
                  onNotify={notifyViaApi}
                  toast={toast?.id === o.id ? toast.text : null}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {manualOpen && (
        <ManualOrderModal
          products={products}
          currency={currency}
          onClose={() => setManualOpen(false)}
          onCreated={() => {
            setManualOpen(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

function OrderCard({
  o,
  currency,
  shopName,
  onMove,
  onDelete,
  onNotify,
  toast,
}: {
  o: Order;
  currency: string;
  shopName: string;
  onMove: (o: Order, s: OrderStatus) => void;
  onDelete: (o: Order) => void;
  onNotify: (o: Order) => void;
  toast: string | null;
}) {
  const { tr, locale } = usePublicLang();
  const dealMeta = parseDealMetadata(o.note, o.source);
  const actions = actionsFor(o.status, dealMeta.isDeal, tr);
  const waText = notifyText(o, shopName, currency);
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const payUrl = `${base}/pay/${o.id}`;
  const showPayLink = (o.status === "NEW" || o.status === "CONFIRMED") && Boolean(o.customerPhone);
  const refShort = o.id.slice(-6).toUpperCase();

  return (
    <article
      className={
        "rounded-xl border bg-white p-3 shadow-sm " +
        (dealMeta.isDeal && o.status === "NEW"
          ? "border-amber-400 ring-1 ring-amber-300/60"
          : "border-arctic-400/30")
      }
    >
      {dealMeta.isDeal && (
        <div className="mb-2 flex items-center justify-between rounded-lg bg-aurora-warning-bg px-2.5 py-1 text-[11px] font-bold text-aurora-warning-text border border-aurora-warning/30">
          <span>
            <Glyph name="handshake" size={14} /> {o.status === "NEW"
              ? tr("OFFRE PROPOSÉE PAR LE CLIENT", "CUSTOMER OFFER")
              : o.status === "CANCELLED"
                ? tr("OFFRE REFUSÉE", "OFFER REJECTED")
                : tr("OFFRE VALIDÉE", "OFFER APPROVED")}
          </span>
          <span className="font-mono">#{refShort}</span>
        </div>
      )}

      <header className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate font-semibold text-arctic-900">{o.customerName}</div>
          {o.customerPhone && (
            <a
              href={waMeLink(o.customerPhone, waText)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-6 items-center text-xs font-medium text-brand-dark hover:underline"
              title={tr("Ouvrir la conversation WhatsApp", "Open WhatsApp chat")}
            >
              <Glyph name="chat" size={13} className="mr-1 -mt-0.5 text-brand-dark" />{o.customerPhone}
            </a>
          )}
        </div>
        <div className="text-right">
          <div className="font-bold text-arctic-900">{formatMoney(o.totalCents, currency)}</div>
          {dealMeta.isDeal && dealMeta.originalCents && (
            <div className="text-[10px] text-arctic-600 line-through">
              {tr("Catalogue", "Catalog")}: {formatMoney(dealMeta.originalCents, currency)}
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wide text-arctic-600">{timeAgo(o.createdAt, locale)}</div>
        </div>
      </header>

      <ul className="my-2 space-y-0.5 text-xs text-arctic-700">
        {o.items.map((it) => (
          <li key={it.id} className="truncate">
            {it.quantity}× {it.productName}
            {it.size && <span className="text-arctic-600"> ({it.size})</span>}
          </li>
        ))}
      </ul>

      {dealMeta.cleanNote && (
        <p className="my-2 rounded bg-arctic-100/55 px-2 py-1 text-xs italic text-arctic-700">
          {dealMeta.cleanNote}
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {actions.map((a) => (
          <button
            key={a.to}
            onClick={() => onMove(o, a.to)}
            className={
              a.primary
                ? "rounded-shape-sm bg-gold-fill px-2.5 py-1 text-xs font-semibold text-white hover:bg-gold-fill"
                : a.danger
                ? "rounded-shape-sm bg-aurora-error-bg px-2.5 py-1 text-xs font-semibold text-aurora-error-text hover:bg-aurora-error-bg"
                : "rounded-shape-sm bg-arctic-200/65 px-2 py-1 text-xs font-medium text-arctic-800 hover:bg-arctic-300"
            }
          >
            {tr(
              ({
                "Valider le Deal": "Valider l’offre",
                "Refuser le Deal": "Refuser l’offre",
                Confirm: "Confirmer",
                Cancel: "Annuler",
                "Mark paid": "Marquer comme payée",
                "← New": "← Nouvelle",
                "Mark delivered": "Marquer comme livrée",
                "← Confirmed": "← Confirmée",
                "↩ Reopen": "↩ Rouvrir",
                Restore: "Restaurer",
              } as Record<string, string>)[a.label] ?? a.label,
              ({
                "Valider le Deal": "Approve offer",
                "Refuser le Deal": "Reject offer",
                Confirm: "Confirm",
                Cancel: "Cancel",
                "Mark paid": "Mark paid",
                "← New": "← New",
                "Mark delivered": "Mark delivered",
                "← Confirmed": "← Confirmed",
                "↩ Reopen": "↩ Reopen",
                Restore: "Restore",
              } as Record<string, string>)[a.label] ?? a.label,
            )}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1">
          {showPayLink && (
            <a
              href={waMeLink(o.customerPhone, payLinkText(o, shopName, currency, payUrl))}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-shape-sm px-2 py-1 text-xs font-semibold text-brand-dark hover:bg-arctic-200/65"
              title={tr("Envoyer un lien de paiement par WhatsApp", "Send a payment link on WhatsApp")}
            >
              <Glyph name="phone" size={13} /> {tr("Lien de paiement", "Pay link")}
            </a>
          )}
          <button
            onClick={() => onNotify(o)}
            className="inline-flex items-center gap-1 rounded-shape-sm px-2 py-1 text-xs font-medium text-arctic-700 hover:bg-arctic-200/65"
            title={tr("Envoyer une mise à jour WhatsApp", "Send WhatsApp update")}
          >
            <Glyph name="share" size={13} /> {tr("Mise à jour", "Update")}
          </button>
          <button
            onClick={() => onDelete(o)}
            className="inline-flex min-h-6 min-w-6 items-center justify-center rounded-shape-sm px-2 py-1 text-xs font-medium text-aurora-error-text hover:bg-arctic-200/60"
            title={tr("Supprimer la commande", "Delete order")}
            aria-label={tr("Supprimer la commande", "Delete order")}
          >
            <Glyph name="trash" size={14} />
          </button>
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between text-[10px] text-arctic-600">
        <span className="uppercase tracking-wide">via {o.source} • #{refShort}</span>
        {toast && <span className="font-semibold text-signal-text">{toast}</span>}
      </div>
    </article>
  );
}

/* ----------------------------- Manual order modal ----------------------------- */

type DraftLine = { productId: string; size: string; qty: number };

function ManualOrderModal({
  products,
  currency,
  onClose,
  onCreated,
}: {
  products: ProductOption[];
  currency: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { tr } = usePublicLang();
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [pid, setPid] = useState(products[0]?.id ?? "");
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selected = productById.get(pid);
  const sizeOptions = selected ? parseSizes(selected.sizes) : [];

  const total = lines.reduce((sum, l) => {
    const p = productById.get(l.productId);
    return sum + (p?.priceCents ?? 0) * l.qty;
  }, 0);

  function addLine() {
    if (!pid) return;
    setLines((ls) => [...ls, { productId: pid, size, qty: Math.max(1, qty) }]);
    setQty(1);
    setSize("");
  }

  function removeLine(i: number) {
    setLines((ls) => ls.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        source: "manual",
        customerName,
        customerPhone,
        note,
        items: lines.map((l) => ({ productId: l.productId, size: l.size, qty: l.qty })),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || tr("Impossible de créer la commande.", "Could not create order."));
      return;
    }
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-30 grid place-items-center bg-arctic-900/40 p-4">
      <div className="card w-full max-w-lg overflow-hidden flex flex-col max-h-[92dvh]">
        <div className="flex items-center justify-between border-b border-arctic-400/30 px-5 py-3 shrink-0">
          <h2 className="font-bold text-arctic-900">{tr("Nouvelle commande", "New order")}</h2>
          <button
            onClick={onClose}
            aria-label={tr("Fermer", "Close")}
            className="grid min-h-6 min-w-6 place-items-center rounded-shape-sm text-arctic-600 hover:text-arctic-800"
          >
            <Glyph name="close" size={16} />
          </button>
        </div>
        <form onSubmit={submit} className="flex-1 max-h-[82dvh] space-y-4 overflow-y-auto overscroll-contain p-5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ordersboard-1" className="label">{tr("Nom du client", "Customer name")}</label>
              <input id="ordersboard-1" className="input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="ordersboard-2" className="label">{tr("Numéro WhatsApp", "WhatsApp number")}</label>
              <input id="ordersboard-2"
                className="input"
                inputMode="tel"
                placeholder="22893730817"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="ordersboard-3" className="label">{tr("Articles", "Items")}</label>
            {products.length === 0 ? (
              <p className="rounded-lg bg-aurora-warning-bg px-3 py-2 text-sm text-aurora-warning-text">
                {tr("Ajoutez d’abord des produits à votre catalogue.", "Add some products to your catalog first.")}
              </p>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-12 gap-2">
                  <select id="ordersboard-3"
                    className="input col-span-6"
                    value={pid}
                    onChange={(e) => { setPid(e.target.value); setSize(""); }}
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatMoney(p.priceCents, currency)} ({p.stock} {tr("restant(s)", "left")})
                      </option>
                    ))}
                  </select>
                  <select
                    className="input col-span-3"
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                    disabled={sizeOptions.length === 0}
                  >
                    <option value="">{sizeOptions.length === 0 ? "—" : tr("Taille", "Size")}</option>
                    {sizeOptions.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <input
                    className="input col-span-2"
                    type="number"
                    min={1}
                    value={qty}
                    onChange={(e) => setQty(parseInt(e.target.value, 10) || 1)}
                  />
                  <button type="button" onClick={addLine} className="btn-ghost btn-sm col-span-1">
                    +
                  </button>
                </div>

                {lines.length > 0 && (
                  <ul className="divide-y divide-arctic-400/20 rounded-lg border border-arctic-400/30">
                    {lines.map((l, i) => {
                      const p = productById.get(l.productId);
                      if (!p) return null;
                      return (
                        <li key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                          <span className="truncate">
                            {l.qty}× {p.name}
                            {l.size && <span className="text-arctic-600"> ({l.size})</span>}
                          </span>
                          <span className="flex items-center gap-3">
                            <span className="font-semibold">
                              {formatMoney(p.priceCents * l.qty, currency)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeLine(i)}
                              className="text-aurora-error-text hover:text-aurora-error-text"
                            >
                              <Glyph name="close" size={16} />
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="ordersboard-4" className="label">{tr("Note (facultative)", "Note (optional)")}</label>
            <textarea id="ordersboard-4"
              className="input min-h-[60px]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={tr("Consignes de livraison, couleur préférée, etc.", "Delivery instructions, colour preference, etc.")}
            />
          </div>

          <div className="flex items-center justify-between border-t border-arctic-400/30 pt-3">
            <span className="text-sm text-arctic-600">{tr("Total", "Total")}</span>
            <span className="a-title-lg text-arctic-900">{formatMoney(total, currency)}</span>
          </div>

          {error && <p className="rounded-lg bg-aurora-error-bg px-3 py-2 text-sm text-aurora-error-text">{error}</p>}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-ghost">{tr("Annuler", "Cancel")}</button>
            <button className="btn-primary" disabled={saving || lines.length === 0}>
              {saving ? tr("Création…", "Creating…") : tr("Créer la commande", "Create order")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
