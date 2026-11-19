import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { getVendorFunnel } from "@/lib/funnel";
import { buildDailyRevenueSeries, buildDailyRevenueWindow, buildLocalHourBuckets } from "@/lib/analytics";
import { getServerTr } from "@/lib/public-locale";


/** English names of the conversion steps (the French ones come from src/lib/funnel.ts). */
const FUNNEL_EN: Record<string, string> = {
  visit: "1. Shop visits",
  product_view: "2. Product pages viewed",
  cart: "3. Added to cart",
  ussd_intent: "4. USSD payment intents (T-Money / Flooz)",
  confirmed_order: "5. Sessions with a paid order",
};
export default async function AnalyticsPage() {
  const tr = await getServerTr();
  const vendor = await requireVendor();
  const currency = vendor.currency || "XOF";
  const now = new Date();
  const dailyWindow = buildDailyRevenueWindow(now, vendor.tzOffsetMinutes);
  const allOrdersWhere = { vendorId: vendor.id, deletedAt: null };
  const paidOrdersWhere = {
    ...allOrdersWhere,
    status: { in: ["PAID", "DELIVERED"] },
  };

  // Keep lifetime totals in the database; fetch detailed rows only for the
  // bounded 14-day charts. This avoids loading every historical order/item.
  const [totalOrders, paidAggregate, sourceGroups, recentOrders, productGroups, funnel] = await Promise.all([
    prisma.order.count({ where: allOrdersWhere }),
    prisma.order.aggregate({
      where: paidOrdersWhere,
      _count: { _all: true },
      _sum: { totalCents: true },
    }),
    prisma.order.groupBy({
      by: ["source"],
      where: allOrdersWhere,
      _count: { _all: true },
    }),
    prisma.order.findMany({
      where: {
        ...allOrdersWhere,
        createdAt: { gte: dailyWindow.from, lt: dailyWindow.toExclusive },
      },
      select: { status: true, createdAt: true, totalCents: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName", "unitPriceCents"],
      where: {
        order: {
          is: {
            ...paidOrdersWhere,
          },
        },
      },
      _sum: { quantity: true },
    }),
    getVendorFunnel(vendor.id, { from: dailyWindow.from, to: new Date(dailyWindow.toExclusive.getTime() - 1) }),
  ]);

  const paidCount = paidAggregate._count._all;
  const totalRevenue = paidAggregate._sum.totalCents ?? 0;
  const avgOrder = paidCount > 0 ? Math.round(totalRevenue / paidCount) : 0;
  const sourceCounts = new Map(sourceGroups.map((group) => [group.source, group._count._all]));
  const sources = {
    catalog: sourceCounts.get("catalog") ?? 0,
    whatsapp: sourceCounts.get("whatsapp") ?? 0,
    manual: sourceCounts.get("manual") ?? 0,
    other: sourceGroups
      .filter((group) => !["catalog", "whatsapp", "manual"].includes(group.source))
      .reduce((sum, group) => sum + group._count._all, 0),
  };

  const conversionRate = funnel.totalVisits > 0
    ? funnel.overallConversionRatePct.toFixed(1)
    : "0.0";

  const recentPaidOrders = recentOrders.filter((order) => order.status === "PAID" || order.status === "DELIVERED");
  const dailyData = buildDailyRevenueSeries(recentPaidOrders, dailyWindow);
  const chartRevenue = dailyData.reduce((sum, day) => sum + day.revenueCents, 0);
  const maxDayRev = Math.max(1, ...dailyData.map((day) => day.revenueCents));

  // Peak hours use the same bounded period and merchant-local clock as revenue.
  const hourBuckets = buildLocalHourBuckets(recentOrders, vendor.tzOffsetMinutes);
  const hourSlots = Array.from({ length: 12 }, (_, index) => hourBuckets[index * 2] + hourBuckets[index * 2 + 1]);
  const maxHourCount = Math.max(1, ...hourSlots);

  // Lifetime top products are aggregated by product and historical unit price.
  const productStats = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const group of productGroups) {
    const quantity = group._sum.quantity ?? 0;
    // Keep distinct active products separate even when their names match.
    // Deleted/unlinked historical items have no productId, so use their name
    // and historical unit price as the best available stable key.
    const key = group.productId ?? `historical:${group.productName}:${group.unitPriceCents}`;
    const existing = productStats.get(key);
    const revenue = group.unitPriceCents * quantity;
    if (existing) {
      existing.qty += quantity;
      existing.revenue += revenue;
    } else {
      productStats.set(key, { name: group.productName, qty: quantity, revenue });
    }
  }
  const topProducts = [...productStats.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const maxProdRev = Math.max(1, ...topProducts.map((p) => p.revenue));

  return (
    <div className="space-y-7 a-fade-in">
      <div>
        <h1 className="a-headline-md text-arctic-900">{tr("Analytics & Performance", "Analytics & performance")}</h1>
        <p className="a-body-md mt-1 text-arctic-600">
          {tr("Suivez la croissance de", "Follow the growth of")} {vendor.shopName} {tr(": revenus, conversion, canaux de vente et heures de pointe.", ": revenue, conversion, sales channels and peak hours.")}
        </p>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">{tr("Chiffre d'affaires", "Revenue")}</div>
          <div className="text-2xl font-black text-arctic-900">{formatMoney(totalRevenue, currency)}</div>
          <div className="text-[11px] text-emerald-600 font-medium">{tr("Valeur des commandes payées ou livrées · depuis l’ouverture", "Value of paid or delivered orders · since opening")}</div>
        </div>

        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">{tr("Commandes payées / livrées", "Paid / delivered orders")}</div>
          <div className="text-2xl font-black text-arctic-900">{paidCount}</div>
          <div className="text-[11px] text-arctic-500 font-medium">{tr("Depuis l'ouverture ·", "Since opening ·")} {totalOrders} {tr("commande", "order")}{totalOrders > 1 ? "s" : ""} {tr("au total", "in total")}</div>
        </div>

        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">{tr("Panier moyen", "Average basket")}</div>
          <div className="text-2xl font-black text-arctic-900">{formatMoney(avgOrder, currency)}</div>
          <div className="text-[11px] text-arctic-500 font-medium">{tr("Depuis l'ouverture · valeur moyenne par commande payée ou livrée", "Since opening · average value per paid or delivered order")}</div>
        </div>

        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">{tr("Taux de conversion", "Conversion rate")}</div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{conversionRate}%</div>
          <div className="text-[11px] text-arctic-500 font-medium">14 derniers jours · visites suivies → session avec commande payée</div>
        </div>
      </div>

      {/* 14-day revenue chart */}
      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-arctic-900">{tr("Commandes payées ou livrées · 14 derniers jours", "Paid or delivered orders · last 14 days")}</h2>
            <p className="text-xs text-arctic-500">{tr("Valeur des commandes payées ou livrées, par date de création", "Value of paid or delivered orders, by creation date")}</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            {formatMoney(chartRevenue, currency)} {tr("sur 14 jours", "over 14 days")}
          </span>
        </div>

        <div
          className="grid grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1.5 h-36 pt-4 border-t border-arctic-300/30"
          aria-label={tr("Valeur des commandes payées ou livrées, par date de création sur les 14 derniers jours, selon le fuseau horaire de la boutique", "Value of paid or delivered orders, by creation date over the last 14 days, in the shop's time zone")}
        >
          {dailyData.map((d, i) => {
            const pct = d.revenueCents > 0 ? Math.max(2, Math.round((d.revenueCents / maxDayRev) * 100)) : 0;
            return (
              <div
                key={d.dateKey}
                className="flex flex-col items-center gap-1.5 h-full justify-end group"
                title={tr(`${d.label} · ${d.orderCount} commande${d.orderCount > 1 ? "s" : ""} payée${d.orderCount > 1 ? "s" : ""} · ${formatMoney(d.revenueCents, currency)}`, `${d.label} · ${d.orderCount} paid order${d.orderCount > 1 ? "s" : ""} · ${formatMoney(d.revenueCents, currency)}`)}
                aria-label={tr(`${d.label}: ${d.orderCount} commande(s) payée(s), ${formatMoney(d.revenueCents, currency)}`, `${d.label}: ${d.orderCount} paid order(s), ${formatMoney(d.revenueCents, currency)}`)}
              >
                <div className="relative flex flex-col items-center w-full">
                  {d.revenueCents > 0 && (
                    <span className="absolute -top-7 text-[10px] font-mono text-arctic-800 bg-white px-1 rounded shadow-xs opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                      {formatMoney(d.revenueCents, currency)}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-medium ${pct > 0 ? (i === 13 ? "bg-emerald-600" : "bg-arctic-300/80 hover:bg-arctic-400") : "bg-transparent"}`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-arctic-500 truncate">{d.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Conversion Funnel & Sources Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Real 5-Stage Funnel */}
        <section className="card p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-arctic-900">{tr("Parcours de conversion (5 étapes)", "Conversion path (5 steps)")}</h2>
              <p className="text-xs text-arctic-500">14 derniers jours · sessions uniques suivies</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              {funnel.totalVisits} {tr("visite", "visit")}{funnel.totalVisits > 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3 pt-1">
            {funnel.stages.map((st, idx) => {
              const colors = [
                "bg-blue-500",
                "bg-indigo-500",
                "bg-purple-500",
                "bg-amber-500",
                "bg-emerald-600",
              ];
              const barColor = colors[idx] || "bg-emerald-600";

              return (
                <div key={st.stage} className="space-y-1">
                  <div className="flex items-center justify-between text-xs font-semibold text-arctic-800">
                    <span className="truncate pr-2">{tr(st.label, FUNNEL_EN[st.stage] ?? st.label)}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span>{st.count}</span>
                      <span className="text-[11px] font-mono text-arctic-500">({st.conversionFromVisitPct}%)</span>
                    </div>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-arctic-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-medium ${barColor}`}
                      style={{ width: `${Math.max(st.count > 0 ? 4 : 0, Math.min(100, st.conversionFromVisitPct))}%` }}
                    />
                  </div>

                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-arctic-200/60 flex items-center justify-between text-xs text-arctic-600">
            <span>{tr("Commandes USSD payées / intentions USSD :", "Paid USSD orders / USSD intents:")}</span>
            <span className="font-bold text-emerald-700">{funnel.ussdIntentToConfirmedPct}%</span>
          </div>
        </section>

        {/* Channels */}
        <section className="card p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-arctic-900">{tr("Origine des commandes", "Order sources")}</h2>
            <p className="text-xs text-arctic-500">{tr("Depuis l'ouverture de la boutique", "Since the shop opened")}</p>
          </div>
          <div className="space-y-3 pt-2">
            {[
              { label: tr("Catalogue web public", "Public web catalog"), count: sources.catalog || 0, color: "bg-emerald-600" },
              { label: tr("Discussion WhatsApp", "WhatsApp chat"), count: sources.whatsapp || 0, color: "bg-teal-500" },
              { label: tr("Saisie manuelle vendeur", "Entered by the vendor"), count: sources.manual || 0, color: "bg-arctic-600" },
              { label: tr("Autre ou non classée", "Other or unclassified"), count: sources.other, color: "bg-violet-500" },
            ].map((src) => {
              const pct = totalOrders > 0 ? Math.round((src.count / totalOrders) * 100) : 0;
              return (
                <div key={src.label} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-semibold text-arctic-800">{src.label}</span>
                    <span className="text-arctic-600">{src.count} ({pct}%)</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-arctic-100 overflow-hidden">
                    <div className={`h-full ${src.color} rounded-full`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* Top products and Peak hours */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Top products */}
        <section className="card p-6 space-y-4">
          <h2 className="text-base font-bold text-arctic-900">{tr("Top 5 produits · depuis l'ouverture", "Top 5 products · since opening")}</h2>
          {topProducts.length === 0 ? (
            <p className="text-xs text-arctic-500 italic">{tr("Aucune commande enregistrée pour le moment.", "No orders recorded yet.")}</p>
          ) : (
            <div className="space-y-3 pt-2">
              {topProducts.map((p, idx) => {
                const pct = Math.min(100, Math.round((p.revenue / maxProdRev) * 100));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-arctic-800 truncate">{p.name}</span>
                      <span className="text-arctic-600 font-mono">
                        {p.qty} {tr("vendus ·", "sold ·")} {formatMoney(p.revenue, currency)}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-arctic-100 overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Peak ordering hours */}
        <section className="card p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-base font-bold text-arctic-900">{tr("Commandes créées · 14 derniers jours", "Orders created · last 14 days")}</h2>
            <span className="text-xs text-arctic-500">{tr("Toutes les commandes créées · heure locale · 0h–23h", "All orders created · local time · 0h–23h")}</span>
          </div>

          <div className="grid grid-cols-12 items-end gap-1 h-28 pt-4 border-t border-arctic-300/30">
            {/* Show every 2 hours */}
            {Array.from({ length: 12 }, (_, i) => {
              const h = i * 2;
              const count = hourSlots[i];
              const pct = count > 0 ? Math.max(2, Math.round((count / maxHourCount) * 100)) : 0;
              return (
                <div key={h} className="flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="relative w-full flex flex-col items-center">
                    {count > 0 && (
                      <span className="absolute -top-5 text-[9px] font-bold text-arctic-700 opacity-0 group-hover:opacity-100 transition">
                        {count}
                      </span>
                    )}
                    <div
                      className={`w-full rounded-t-sm transition-all ${pct > 0 ? "bg-brand/70 group-hover:bg-brand" : "bg-transparent"}`}
                      style={{ height: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-arctic-500">{h}h</span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
