"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import ProductPlaceholder from "@/components/ProductPlaceholder";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export type AnalyticsOrderItem = {
  productId: string | null;
  productName: string;
  quantity: number;
  unitPriceCents: number;
};

export type AnalyticsOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  status: string;
  totalCents: number;
  source: string;
  createdAt: string;
  items: AnalyticsOrderItem[];
};

export type AnalyticsProduct = {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  isActive: boolean;
  imageUrl: string;
  collectionName: string | null;
};

export type AnalyticsCustomer = {
  id: string;
  name: string;
  phone: string;
  totalSpentCents: number;
  orderCount: number;
  lastOrderAt: string | null;
};

export type AnalyticsFunnelEvent = {
  stage: string;
  sessionId: string;
  productId: string | null;
  orderId: string | null;
  createdAt: string;
};

export type AnalyticsWhatsAppMetrics = {
  inboundCount: number;
  outboundCount: number;
  botRepliesCount: number;
  topIntents: { intent: string; count: number }[];
};

export type AnalyticsCampaignSummary = {
  id: string;
  name: string;
  clicks: number;
  orders: number;
  revenueCents: number;
};

type PeriodKey = "7d" | "30d" | "90d" | "all";

const PERIODS: { key: PeriodKey; labelFr: string; labelEn: string; days: number | null }[] = [
  { key: "7d", labelFr: "7 jours", labelEn: "7 days", days: 7 },
  { key: "30d", labelFr: "30 jours", labelEn: "30 days", days: 30 },
  { key: "90d", labelFr: "90 jours", labelEn: "90 days", days: 90 },
  { key: "all", labelFr: "Tout l'historique", labelEn: "All time", days: null },
];

const SOURCE_LABELS: Record<string, { labelFr: string; labelEn: string; color: string }> = {
  catalog: { labelFr: "Catalogue en ligne", labelEn: "Online catalog", color: "bg-emerald-600" },
  whatsapp: { labelFr: "Bot & Chat WhatsApp", labelEn: "WhatsApp Bot & Chat", color: "bg-teal-500" },
  whatsapp_deal: { labelFr: "Négociation IA WhatsApp", labelEn: "WhatsApp AI Deal", color: "bg-sky-500" },
  manual: { labelFr: "Saisie manuelle vendeur", labelEn: "Manual merchant entry", color: "bg-amber-500" },
};

const STATUS_META: Record<string, { labelFr: string; labelEn: string; badge: string; bar: string }> = {
  NEW: {
    labelFr: "Nouvelles",
    labelEn: "New",
    badge: "bg-blue-100 text-blue-800",
    bar: "bg-blue-500",
  },
  CONFIRMED: {
    labelFr: "Confirmées",
    labelEn: "Confirmed",
    badge: "bg-amber-100 text-amber-800",
    bar: "bg-amber-500",
  },
  PAID: {
    labelFr: "Payées",
    labelEn: "Paid",
    badge: "bg-emerald-100 text-emerald-800",
    bar: "bg-emerald-600",
  },
  DELIVERED: {
    labelFr: "Livrées",
    labelEn: "Delivered",
    badge: "bg-teal-100 text-teal-800",
    bar: "bg-teal-600",
  },
  CANCELLED: {
    labelFr: "Annulées",
    labelEn: "Cancelled",
    badge: "bg-red-100 text-red-700",
    bar: "bg-red-500",
  },
};

export default function AnalyticsClient({
  shopName,
  shopSlug,
  currency,
  orders,
  products,
  customers,
  funnelEvents,
  whatsappMetrics,
  campaigns,
  openReceivablesCents,
  openReceivablesCount,
}: {
  shopName: string;
  shopSlug: string;
  currency: string;
  orders: AnalyticsOrder[];
  products: AnalyticsProduct[];
  customers: AnalyticsCustomer[];
  funnelEvents: AnalyticsFunnelEvent[];
  whatsappMetrics: AnalyticsWhatsAppMetrics;
  campaigns: AnalyticsCampaignSummary[];
  openReceivablesCents: number;
  openReceivablesCount: number;
}) {
  const { tr } = usePublicLang();
  const [period, setPeriod] = useState<PeriodKey>("30d");

  const now = useMemo(() => Date.now(), []);
  const dayMs = 24 * 60 * 60 * 1000;

  const selectedDays = PERIODS.find((p) => p.key === period)?.days ?? null;
  const cutoffMs = selectedDays ? now - selectedDays * dayMs : 0;
  const prevCutoffMs = selectedDays ? now - selectedDays * 2 * dayMs : 0;

  // Filtered orders for active period & previous period (for growth %)
  const filteredOrders = useMemo(
    () =>
      selectedDays
        ? orders.filter((o) => new Date(o.createdAt).getTime() >= cutoffMs)
        : orders,
    [orders, selectedDays, cutoffMs],
  );

  const previousOrders = useMemo(
    () =>
      selectedDays
        ? orders.filter((o) => {
            const t = new Date(o.createdAt).getTime();
            return t >= prevCutoffMs && t < cutoffMs;
          })
        : [],
    [orders, selectedDays, prevCutoffMs, cutoffMs],
  );

  const paidOrders = useMemo(
    () =>
      filteredOrders.filter(
        (o) => o.status === "PAID" || o.status === "DELIVERED",
      ),
    [filteredOrders],
  );

  const prevPaidOrders = useMemo(
    () =>
      previousOrders.filter(
        (o) => o.status === "PAID" || o.status === "DELIVERED",
      ),
    [previousOrders],
  );

  const pendingOrders = useMemo(
    () =>
      filteredOrders.filter(
        (o) => o.status === "NEW" || o.status === "CONFIRMED",
      ),
    [filteredOrders],
  );

  const totalRevenue = paidOrders.reduce((s, o) => s + o.totalCents, 0);
  const prevRevenue = prevPaidOrders.reduce((s, o) => s + o.totalCents, 0);
  const pendingRevenue = pendingOrders.reduce((s, o) => s + o.totalCents, 0);
  const avgOrder =
    paidOrders.length > 0 ? Math.round(totalRevenue / paidOrders.length) : 0;

  const revenueGrowthPct =
    selectedDays && prevRevenue > 0
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100)
      : null;

  // Filtered funnel events for period
  const filteredFunnel = useMemo(() => {
    const evs = selectedDays
      ? funnelEvents.filter((e) => new Date(e.createdAt).getTime() >= cutoffMs)
      : funnelEvents;

    const sets: Record<string, Set<string>> = {
      visit: new Set(),
      product_view: new Set(),
      cart: new Set(),
      ussd_intent: new Set(),
      confirmed_order: new Set(),
    };
    const productViews = new Map<string, number>();
    const productCarts = new Map<string, number>();

    for (const ev of evs) {
      if (sets[ev.stage]) {
        const id =
          ev.stage === "confirmed_order" && ev.orderId
            ? ev.orderId
            : ev.sessionId;
        sets[ev.stage].add(id);
      }
      if (ev.stage === "product_view" && ev.productId) {
        productViews.set(ev.productId, (productViews.get(ev.productId) || 0) + 1);
      }
      if (ev.stage === "cart" && ev.productId) {
        productCarts.set(ev.productId, (productCarts.get(ev.productId) || 0) + 1);
      }
    }

    const visits = sets.visit.size;
    const views = sets.product_view.size;
    const carts = sets.cart.size;
    const ussd = sets.ussd_intent.size;
    const confirmed = Math.max(sets.confirmed_order.size, paidOrders.length);

    const stageDefs = [
      { stage: "visit", label: tr("1. Visites de la boutique", "1. Storefront visits"), count: visits },
      { stage: "product_view", label: tr("2. Fiches produits consultées", "2. Product views"), count: views },
      { stage: "cart", label: tr("3. Ajouts au panier", "3. Added to cart"), count: carts },
      {
        stage: "ussd_intent",
        label: tr("4. Intentions de paiement FedaPay", "4. FedaPay checkout intents"),
        count: ussd,
      },
      {
        stage: "confirmed_order",
        label: tr("5. Commandes payées & confirmées", "5. Paid & confirmed orders"),
        count: confirmed,
      },
    ];

    const base = Math.max(visits, views, carts, confirmed, 1);
    const stages = stageDefs.map((s, idx) => {
      const prev = idx > 0 ? stageDefs[idx - 1].count : s.count;
      const dropOff =
        idx > 0 && prev > 0
          ? Math.max(0, Math.round(((prev - Math.min(prev, s.count)) / prev) * 100))
          : 0;
      return {
        ...s,
        pctOfTop: visits > 0 ? Math.min(100, Math.round((s.count / base) * 100)) : s.count > 0 ? 100 : 0,
        dropOff,
      };
    });

    const conversionRate =
      visits > 0
        ? ((confirmed / visits) * 100).toFixed(1)
        : filteredOrders.length > 0
          ? ((paidOrders.length / filteredOrders.length) * 100).toFixed(1)
          : "0.0";

    return {
      visits,
      confirmed,
      conversionRate,
      stages,
      productViews,
      productCarts,
    };
  }, [funnelEvents, selectedDays, cutoffMs, paidOrders.length, filteredOrders.length, tr]);

  // Daily chart data (14 bars for 7d/30d, or 14 buckets for 90d/all)
  const chartDays = selectedDays === 7 ? 7 : 14;
  const dailyData = useMemo(() => {
    return Array.from({ length: chartDays }, (_, i) => {
      const d = new Date(now - (chartDays - 1 - i) * dayMs);
      const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
      const dayEnd = dayStart + dayMs;

      const dayPaid = paidOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      });
      const dayAll = filteredOrders.filter((o) => {
        const t = new Date(o.createdAt).getTime();
        return t >= dayStart && t < dayEnd;
      });

      const rev = dayPaid.reduce((acc, o) => acc + o.totalCents, 0);
      return {
        date: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`,
        rev,
        paidCount: dayPaid.length,
        totalCount: dayAll.length,
      };
    });
  }, [chartDays, now, dayMs, paidOrders, filteredOrders]);

  const maxDayRev = Math.max(1, ...dailyData.map((d) => d.rev));

  // Product performance table (units sold, revenue, views, stock)
  const productPerformance = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        name: string;
        imageUrl: string;
        collectionName: string | null;
        stock: number;
        priceCents: number;
        qtySold: number;
        revenueCents: number;
        views: number;
        carts: number;
      }
    >();

    for (const p of products) {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        imageUrl: p.imageUrl,
        collectionName: p.collectionName,
        stock: p.stock,
        priceCents: p.priceCents,
        qtySold: 0,
        revenueCents: 0,
        views: filteredFunnel.productViews.get(p.id) || 0,
        carts: filteredFunnel.productCarts.get(p.id) || 0,
      });
    }

    for (const o of paidOrders) {
      for (const it of o.items) {
        const key = it.productId || `name:${it.productName}`;
        const existing =
          (it.productId ? map.get(it.productId) : undefined) ||
          [...map.values()].find((x) => x.name === it.productName);

        if (existing) {
          existing.qtySold += it.quantity;
          existing.revenueCents += it.unitPriceCents * it.quantity;
        } else {
          map.set(key, {
            id: key,
            name: it.productName,
            imageUrl: "",
            collectionName: null,
            stock: 0,
            priceCents: it.unitPriceCents,
            qtySold: it.quantity,
            revenueCents: it.unitPriceCents * it.quantity,
            views: 0,
            carts: 0,
          });
        }
      }
    }

    return [...map.values()].sort(
      (a, b) => b.revenueCents - a.revenueCents || b.qtySold - a.qtySold || b.views - a.views,
    );
  }, [products, paidOrders, filteredFunnel.productViews, filteredFunnel.productCarts]);

  // Inventory health
  const outOfStockProducts = products.filter((p) => p.isActive && p.stock <= 0);
  const lowStockProducts = products.filter((p) => p.isActive && p.stock > 0 && p.stock <= 5);
  const totalCatalogValueCents = products
    .filter((p) => p.isActive && p.stock > 0)
    .reduce((acc, p) => acc + p.priceCents * p.stock, 0);

  // Order status breakdown
  const statusCounts = useMemo(() => {
    const counts: Record<string, { count: number; cents: number }> = {
      NEW: { count: 0, cents: 0 },
      CONFIRMED: { count: 0, cents: 0 },
      PAID: { count: 0, cents: 0 },
      DELIVERED: { count: 0, cents: 0 },
      CANCELLED: { count: 0, cents: 0 },
    };
    for (const o of filteredOrders) {
      const k = counts[o.status] ? o.status : "NEW";
      counts[k].count += 1;
      counts[k].cents += o.totalCents;
    }
    return counts;
  }, [filteredOrders]);

  // Channel breakdown
  const sourceCounts = useMemo(() => {
    const map: Record<string, { count: number; cents: number }> = {
      catalog: { count: 0, cents: 0 },
      whatsapp: { count: 0, cents: 0 },
      whatsapp_deal: { count: 0, cents: 0 },
      manual: { count: 0, cents: 0 },
    };
    for (const o of filteredOrders) {
      const k = map[o.source] ? o.source : "catalog";
      map[k].count += 1;
      map[k].cents += o.totalCents;
    }
    return map;
  }, [filteredOrders]);

  // Peak hours
  const hourBuckets = useMemo(() => {
    const b = Array.from({ length: 24 }, () => 0);
    for (const o of filteredOrders) {
      const h = new Date(o.createdAt).getHours();
      b[h]++;
    }
    return b;
  }, [filteredOrders]);
  const maxHourCount = Math.max(1, ...hourBuckets);

  // Repeat vs New customers
  const repeatCustomersCount = customers.filter((c) => c.orderCount >= 2).length;
  const retentionRatePct =
    customers.length > 0 ? Math.round((repeatCustomersCount / customers.length) * 100) : 0;

  // CSV Export
  function exportAnalyticsCsv() {
    const rows: string[][] = [
      ["Date", "Commande ID", "Client", "Telephone", "Statut", "Canal", "Montant", "Devise", "Articles"],
      ...filteredOrders.map((o) => [
        new Date(o.createdAt).toISOString().slice(0, 19).replace("T", " "),
        o.id,
        o.customerName,
        o.customerPhone,
        o.status,
        o.source,
        String(Math.round(o.totalCents / 100)),
        currency,
        o.items.map((i) => `${i.quantity}x ${i.productName}`).join(" | "),
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      rows
        .map((r) =>
          r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","),
        )
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `analytics-${shopSlug}-${period}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="space-y-7 a-fade-in">
      {/* Header + Period Filter + Export */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="a-headline-md text-arctic-900">
            {tr("Analytics & Pilotage de la Boutique", "Store Analytics & Insights")}
          </h1>
          <p className="a-body-md mt-1 text-arctic-600">
            {tr("Performances commerciales en temps réel de", "Real-time commercial performance for")}{" "}
            <strong>{shopName}</strong> :{" "}
            {tr("ventes, produits, conversion, WhatsApp IA et stocks.", "sales, products, conversion, WhatsApp AI, and inventory.")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-shape-full border border-arctic-300/70 bg-arctic-50 p-1">
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`rounded-shape-full px-3 py-1 text-xs font-semibold transition ${
                    active
                      ? "bg-arctic-900 text-arctic-50 shadow-xs"
                      : "text-arctic-700 hover:text-arctic-900"
                  }`}
                >
                  {tr(p.labelFr, p.labelEn)}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={exportAnalyticsCsv}
            className="btn-ghost text-xs !py-2 px-3.5"
          >
            {tr("⬇ Exporter CSV", "⬇ Export CSV")}
          </button>
        </div>
      </div>

      {/* Primary KPI Grid (6 metrics) */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <div className="card p-5 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-wider text-arctic-600 font-semibold">
              {tr("Chiffre d'affaires encaissé", "Collected revenue")}
            </span>
            {revenueGrowthPct !== null && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  revenueGrowthPct >= 0
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {revenueGrowthPct >= 0 ? `+${revenueGrowthPct}%` : `${revenueGrowthPct}%`}
              </span>
            )}
          </div>
          <div className="text-2xl font-black text-arctic-900">
            {formatMoney(totalRevenue, currency)}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium">
            {paidOrders.length} {tr("commande(s) payée(s) / livrée(s)", "paid / delivered order(s)")}
          </div>
        </div>

        <div className="card p-5 space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-arctic-600 font-semibold">
            {tr("En attente d'encaissement", "Pending collection")}
          </div>
          <div className="text-2xl font-black text-amber-700">
            {formatMoney(pendingRevenue + openReceivablesCents, currency)}
          </div>
          <div className="text-[11px] text-arctic-600 font-medium">
            {pendingOrders.length} {tr("cmd en cours", "pending orders")} · {openReceivablesCount}{" "}
            {tr("créance(s) client", "open receivable(s)")}
          </div>
        </div>

        <div className="card p-5 space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-arctic-600 font-semibold">
            {tr("Panier moyen", "Avg. order value")}
          </div>
          <div className="text-2xl font-black text-arctic-900">
            {formatMoney(avgOrder, currency)}
          </div>
          <div className="text-[11px] text-arctic-600 font-medium">
            {tr("Sur", "Across")} {filteredOrders.length} {tr("commande(s) reçue(s)", "received order(s)")}
          </div>
        </div>

        <div className="card p-5 space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-arctic-600 font-semibold">
            {tr("Taux de conversion", "Conversion rate")}
          </div>
          <div className="text-2xl font-black text-emerald-700">
            {filteredFunnel.conversionRate}%
          </div>
          <div className="text-[11px] text-arctic-600 font-medium">
            {filteredFunnel.visits} {tr("visite(s)", "visit(s)")} → {filteredFunnel.confirmed} {tr("achat(s)", "order(s)")}
          </div>
        </div>

        <div className="card p-5 space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-arctic-600 font-semibold">
            {tr("Fidélisation clients", "Customer retention")}
          </div>
          <div className="text-2xl font-black text-arctic-900">
            {retentionRatePct}%
          </div>
          <div className="text-[11px] text-arctic-600 font-medium">
            {repeatCustomersCount} {tr("client(s) récurrent(s) sur", "repeat customer(s) out of")} {customers.length}
          </div>
        </div>

        <div className="card p-5 space-y-1.5">
          <div className="text-xs uppercase tracking-wider text-arctic-600 font-semibold">
            {tr("Activité Assistant WhatsApp", "WhatsApp Assistant activity")}
          </div>
          <div className="text-2xl font-black text-arctic-900">
            {whatsappMetrics.inboundCount + whatsappMetrics.outboundCount}
          </div>
          <div className="text-[11px] text-arctic-600 font-medium">
            {whatsappMetrics.inboundCount} {tr("reçus", "inbound")} · {whatsappMetrics.outboundCount}{" "}
            {tr("envoyés", "outbound")} ({whatsappMetrics.botRepliesCount} {tr("réponses IA", "AI replies")})
          </div>
        </div>
      </div>

      {/* Daily Revenue & Orders Evolution */}
      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-arctic-900">
              {tr(
                `Évolution quotidienne des ventes (${chartDays} derniers jours)`,
                `Daily sales evolution (last ${chartDays} days)`,
              )}
            </h2>
            <p className="text-xs text-arctic-600">
              {tr(
                "Survolez une barre pour voir le chiffre d'affaires et le nombre de commandes du jour",
                "Hover over a bar to see daily revenue and order count",
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
              {formatMoney(totalRevenue, currency)} {tr("encaissés", "collected")}
            </span>
          </div>
        </div>

        <div
          className={`grid items-end gap-2 h-44 pt-6 border-t border-arctic-300/30 ${
            chartDays === 7 ? "grid-cols-7" : "grid-cols-14"
          }`}
        >
          {dailyData.map((d, i) => {
            const pct = d.rev > 0 ? Math.max(10, Math.round((d.rev / maxDayRev) * 100)) : 4;
            const isToday = i === dailyData.length - 1;
            return (
              <div key={d.date} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                <div className="relative flex flex-col items-center w-full h-full justify-end">
                  <div className="pointer-events-none absolute -top-9 rounded-md bg-stone-900 px-2 py-1 text-[10px] font-semibold text-white shadow-md opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-20">
                    {formatMoney(d.rev, currency)} · {d.totalCount} {tr("cmd", "ord")}
                  </div>
                  <div
                    className={`w-full rounded-t-md transition-all duration-medium ${
                      isToday
                        ? "bg-emerald-600"
                        : d.rev > 0
                          ? "bg-brand/80 group-hover:bg-brand"
                          : "bg-arctic-200/80"
                    }`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-arctic-600 truncate">{d.date}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Funnel + Order Statuses + Sales Channels */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* 5-Stage Conversion Funnel */}
        <section className="card p-6 space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-arctic-900">
                {tr("Entonnoir de conversion de la boutique", "Storefront conversion funnel")}
              </h2>
              <p className="text-xs text-arctic-600">
                {tr("Parcours client du catalogue jusqu'au paiement confirmé", "Customer journey from catalog visit to confirmed payment")}
              </p>
            </div>
            <Link
              href={`/c/${shopSlug}`}
              target="_blank"
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              {tr("Voir ma boutique ↗", "View my store ↗")}
            </Link>
          </div>

          <div className="space-y-3 pt-1">
            {filteredFunnel.stages.map((st, idx) => {
              const colors = [
                "bg-blue-500",
                "bg-indigo-500",
                "bg-purple-500",
                "bg-amber-500",
                "bg-emerald-600",
              ];
              return (
                <div key={st.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-arctic-800">
                    <span className="truncate pr-2">{st.label}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-arctic-900">{st.count}</span>
                      {idx > 0 && st.dropOff > 0 && (
                        <span className="text-[10px] text-amber-700">
                          (-{st.dropOff}%)
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-arctic-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-medium ${colors[idx] || "bg-emerald-600"}`}
                      style={{ width: `${Math.max(st.count > 0 ? 6 : 0, st.pctOfTop)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Order Status Breakdown & Channels */}
        <section className="card p-6 space-y-5">
          <div>
            <h2 className="text-base font-bold text-arctic-900">
              {tr("Répartition par statut", "Breakdown by status")}
            </h2>
            <p className="text-xs text-arctic-600">
              {tr("État actuel des commandes sur la période", "Current status of orders in this period")}
            </p>
          </div>

          <div className="space-y-2.5">
            {Object.entries(STATUS_META).map(([statusKey, meta]) => {
              const info = statusCounts[statusKey] || { count: 0, cents: 0 };
              const pct =
                filteredOrders.length > 0
                  ? Math.round((info.count / filteredOrders.length) * 100)
                  : 0;
              return (
                <div key={statusKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${meta.badge}`}>
                      {tr(meta.labelFr, meta.labelEn)}
                    </span>
                    <span className="font-mono text-arctic-700">
                      {info.count} ({pct}%) · {formatMoney(info.cents, currency)}
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-arctic-100 overflow-hidden">
                    <div className={`h-full rounded-full ${meta.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-arctic-200/70 pt-4 space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-arctic-600">
              {tr("Canaux d'acquisition", "Acquisition channels")}
            </h3>
            {Object.entries(SOURCE_LABELS).map(([srcKey, meta]) => {
              const info = sourceCounts[srcKey] || { count: 0, cents: 0 };
              if (info.count === 0 && srcKey === "whatsapp_deal") return null;
              const pct =
                filteredOrders.length > 0
                  ? Math.round((info.count / filteredOrders.length) * 100)
                  : 0;
              return (
                <div key={srcKey} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium text-arctic-800">{tr(meta.labelFr, meta.labelEn)}</span>
                    <span className="text-arctic-600 font-mono">
                      {info.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-arctic-100 overflow-hidden">
                    <div className={`h-full rounded-full ${meta.color}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Product Performance Table & Stock Alerts */}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-6 space-y-4 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-arctic-900">
                {tr("Performance détaillée des produits", "Detailed product performance")}
              </h2>
              <p className="text-xs text-arctic-600">
                {tr("Ventes, revenus générés, consultations et stock restant", "Units sold, revenue generated, views, and remaining stock")}
              </p>
            </div>
            <Link href="/dashboard/products" className="text-xs font-semibold text-brand-dark hover:underline">
              {tr("Gérer les produits →", "Manage products →")}
            </Link>
          </div>

          {productPerformance.length === 0 ? (
            <p className="text-xs text-arctic-600 italic py-4">
              {tr("Aucun produit dans votre catalogue pour le moment.", "No products in your catalog yet.")}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-arctic-200 text-[11px] uppercase tracking-wider text-arctic-600">
                    <th className="pb-2.5 font-semibold">{tr("Produit", "Product")}</th>
                    <th className="pb-2.5 font-semibold text-right">{tr("Vues", "Views")}</th>
                    <th className="pb-2.5 font-semibold text-right">{tr("Vendus", "Sold")}</th>
                    <th className="pb-2.5 font-semibold text-right">{tr("Chiffre d'affaires", "Revenue")}</th>
                    <th className="pb-2.5 font-semibold text-right">{tr("Stock", "Stock")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-arctic-200/60">
                  {productPerformance.slice(0, 8).map((p) => (
                    <tr key={p.id} className="hover:bg-arctic-100/50">
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 shrink-0 overflow-hidden rounded-md border border-arctic-200 bg-arctic-100">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                            ) : (
                              <ProductPlaceholder name={p.name} size="sm" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-semibold text-arctic-900 truncate max-w-[180px]">
                              {p.name}
                            </div>
                            <div className="text-[10px] text-arctic-600">
                              {formatMoney(p.priceCents, currency)}
                              {p.collectionName ? ` · ${p.collectionName}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-arctic-700">{p.views}</td>
                      <td className="py-2.5 text-right font-mono font-bold text-arctic-900">
                        {p.qtySold}
                      </td>
                      <td className="py-2.5 text-right font-mono font-bold text-emerald-700">
                        {formatMoney(p.revenueCents, currency)}
                      </td>
                      <td className="py-2.5 text-right">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            p.stock <= 0
                              ? "bg-red-100 text-red-700"
                              : p.stock <= 5
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {p.stock <= 0 ? tr("Rupture", "Out of stock") : `${p.stock} ${tr("en stock", "in stock")}`}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Stock & Inventory Health */}
        <section className="card p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-arctic-900">
              {tr("Santé du stock & Inventaire", "Stock & Inventory health")}
            </h2>
            <p className="text-xs text-arctic-600">
              {tr("Valeur du stock actif :", "Active inventory value:")}{" "}
              <strong className="text-arctic-900">
                {formatMoney(totalCatalogValueCents, currency)}
              </strong>
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border border-red-200/70 bg-red-50/70 p-3">
              <div className="text-[11px] font-semibold text-red-700">
                {tr("En rupture (0)", "Out of stock (0)")}
              </div>
              <div className="text-xl font-black text-red-800">{outOfStockProducts.length}</div>
            </div>
            <div className="rounded-xl border border-amber-200/70 bg-amber-50/70 p-3">
              <div className="text-[11px] font-semibold text-amber-800">
                {tr("Stock faible (≤ 5)", "Low stock (≤ 5)")}
              </div>
              <div className="text-xl font-black text-amber-900">{lowStockProducts.length}</div>
            </div>
          </div>

          {outOfStockProducts.length === 0 && lowStockProducts.length === 0 ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-800">
              {tr(
                "✓ Tous vos produits actifs disposent d'un stock suffisant.",
                "✓ All active products have sufficient stock.",
              )}
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {[...outOfStockProducts, ...lowStockProducts].slice(0, 8).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between rounded-lg border border-arctic-200/80 bg-arctic-50/70 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-arctic-900 truncate pr-2">{p.name}</span>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      p.stock <= 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {p.stock <= 0 ? tr("0 restant", "0 left") : `${p.stock} ${tr("restants", "left")}`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Top Customers, Peak Hours & Campaigns ROI */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top Customers VIP */}
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-arctic-900">
                {tr("Meilleurs clients (CRM)", "Top customers (CRM)")}
              </h2>
              <p className="text-xs text-arctic-600">
                {tr("Clients classés par chiffre d'affaires cumulé", "Customers ranked by lifetime spend")}
              </p>
            </div>
            <Link href="/dashboard/customers" className="text-xs font-semibold text-brand-dark hover:underline">
              {tr("Voir tous les clients →", "View all customers →")}
            </Link>
          </div>

          {customers.length === 0 ? (
            <p className="text-xs text-arctic-600 italic">
              {tr("Aucun client enregistré pour le moment.", "No customers recorded yet.")}
            </p>
          ) : (
            <div className="space-y-2.5">
              {customers.slice(0, 5).map((c, idx) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border border-arctic-200/70 bg-arctic-50/60 px-3.5 py-2.5 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand/15 font-bold text-brand-dark">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="font-bold text-arctic-900 truncate">{c.name}</div>
                      <div className="text-[11px] text-arctic-600 font-mono">{c.phone}</div>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-emerald-700 font-mono">
                      {formatMoney(c.totalSpentCents, currency)}
                    </div>
                    <div className="text-[10px] text-arctic-600">
                      {c.orderCount} {tr("commande(s)", "order(s)")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Peak Ordering Hours & Campaigns */}
        <section className="card p-6 space-y-5">
          <div>
            <div className="flex justify-between items-center">
              <h2 className="text-base font-bold text-arctic-900">
                {tr("Heures d'affluence des commandes", "Peak ordering hours")}
              </h2>
              <span className="text-xs text-arctic-600">
                {tr("Créneaux 0h – 23h", "0h – 23h slots")}
              </span>
            </div>

            <div className="grid grid-cols-12 items-end gap-1.5 h-28 pt-5 mt-2 border-t border-arctic-300/30">
              {Array.from({ length: 12 }, (_, i) => {
                const h = i * 2;
                const count = (hourBuckets[h] || 0) + (hourBuckets[h + 1] || 0);
                const pct = Math.max(8, Math.round((count / (maxHourCount * 2)) * 100));
                return (
                  <div key={h} className="flex flex-col items-center gap-1 h-full justify-end group">
                    <div className="relative w-full flex flex-col items-center h-full justify-end">
                      {count > 0 && (
                        <span className="absolute -top-5 text-[9px] font-bold text-arctic-800 opacity-0 group-hover:opacity-100 transition">
                          {count}
                        </span>
                      )}
                      <div
                        className="w-full rounded-t-sm bg-brand/75 group-hover:bg-brand transition-all"
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[9px] text-arctic-600">{h}h</span>
                  </div>
                );
              })}
            </div>
          </div>

          {campaigns.length > 0 && (
            <div className="border-t border-arctic-200/70 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-arctic-600">
                  {tr("Campagnes & Liens trackés", "Tracked campaigns & links")}
                </h3>
                <Link href="/dashboard/campaigns" className="text-[11px] font-semibold text-brand-dark hover:underline">
                  {tr("Campagnes →", "Campaigns →")}
                </Link>
              </div>
              {campaigns.slice(0, 3).map((camp) => (
                <div
                  key={camp.id}
                  className="flex items-center justify-between text-xs rounded-lg bg-arctic-50/70 px-3 py-1.5"
                >
                  <span className="font-medium text-arctic-800 truncate pr-2">{camp.name}</span>
                  <span className="font-mono text-arctic-600 shrink-0">
                    {camp.clicks} {tr("clics", "clicks")} · {camp.orders} {tr("cmd", "ord")} ·{" "}
                    {formatMoney(camp.revenueCents, currency)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

