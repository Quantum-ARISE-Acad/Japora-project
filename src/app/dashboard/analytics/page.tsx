import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { getVendorFunnel } from "@/lib/funnel";

export default async function AnalyticsPage() {
  const vendor = await requireVendor();
  const currency = vendor.currency || "USD";

  // Fetch vendor orders
  const orders = await prisma.order.findMany({
    where: { vendorId: vendor.id, deletedAt: null },
    include: { items: true },
    orderBy: { createdAt: "desc" },
  });

  const totalOrders = orders.length;
  const paidOrders = orders.filter((o) => o.status === "PAID" || o.status === "DELIVERED");
  const paidCount = paidOrders.length;
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.totalCents, 0);
  const avgOrder = paidCount > 0 ? Math.round(totalRevenue / paidCount) : 0;

  // 1. Sources breakdown
  const sources: Record<string, number> = { catalog: 0, whatsapp: 0, manual: 0 };
  for (const o of orders) {
    const s = o.source || "catalog";
    sources[s] = (sources[s] || 0) + 1;
  }

  // 2. Real Telemetry Funnel (5 stages)
  const funnel = await getVendorFunnel(vendor.id);
  const conversionRate = funnel.totalVisits > 0
    ? funnel.overallConversionRatePct.toFixed(1)
    : "0.0";

  // 3. Last 14 days daily revenue
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const dailyData = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * dayMs);
    const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const dayEnd = dayStart + dayMs;

    const matched = paidOrders.filter((o) => {
      const time = new Date(o.createdAt).getTime();
      return time >= dayStart && time < dayEnd;
    });

    const rev = matched.reduce((acc, o) => acc + o.totalCents, 0);
    return {
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      rev,
      count: matched.length,
    };
  });
  const maxDayRev = Math.max(1, ...dailyData.map((d) => d.rev));

  // 4. Peak hours (0 to 23h)
  const hourBuckets = Array.from({ length: 24 }, () => 0);
  for (const o of orders) {
    const h = new Date(o.createdAt).getHours();
    hourBuckets[h]++;
  }
  const maxHourCount = Math.max(1, ...hourBuckets);

  // 5. Top products by revenue
  const productStats = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of paidOrders) {
    for (const it of o.items) {
      const existing = productStats.get(it.productName);
      const lineRev = it.unitPriceCents * it.quantity;
      if (existing) {
        existing.qty += it.quantity;
        existing.revenue += lineRev;
      } else {
        productStats.set(it.productName, {
          name: it.productName,
          qty: it.quantity,
          revenue: lineRev,
        });
      }
    }
  }
  const topProducts = [...productStats.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  const maxProdRev = Math.max(1, ...topProducts.map((p) => p.revenue));

  return (
    <div className="space-y-7 a-fade-in">
      <div>
        <h1 className="a-headline-md text-arctic-900">Analytics & Performance</h1>
        <p className="a-body-md mt-1 text-arctic-600">
          Suivez la croissance de {vendor.shopName} : revenus, conversion, canaux de vente et heures de pointe.
        </p>
      </div>

      {/* Primary KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">Chiffre d&apos;affaires</div>
          <div className="text-2xl font-black text-arctic-900">{formatMoney(totalRevenue, currency)}</div>
          <div className="text-[11px] text-emerald-600 font-medium">Commandes encaissées</div>
        </div>

        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">Commandes payées</div>
          <div className="text-2xl font-black text-arctic-900">{paidCount}</div>
          <div className="text-[11px] text-arctic-500 font-medium">Sur {totalOrders} commande{totalOrders > 1 ? "s" : ""} totales</div>
        </div>

        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">Panier moyen</div>
          <div className="text-2xl font-black text-arctic-900">{formatMoney(avgOrder, currency)}</div>
          <div className="text-[11px] text-arctic-500 font-medium">Par commande payée</div>
        </div>

        <div className="card p-5 space-y-1">
          <div className="text-xs uppercase tracking-wider text-arctic-500 font-semibold">Taux de conversion</div>
          <div className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{conversionRate}%</div>
          <div className="text-[11px] text-arctic-500 font-medium">Visites → Achat validé</div>
        </div>
      </div>

      {/* 14-day revenue chart */}
      <section className="card p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-arctic-900">Évolution du chiffre d&apos;affaires (14 derniers jours)</h2>
            <p className="text-xs text-arctic-500">Revenus générés jour par jour</p>
          </div>
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
            {formatMoney(totalRevenue, currency)} total
          </span>
        </div>

        <div className="grid grid-cols-14 items-end gap-1.5 h-36 pt-4 border-t border-arctic-300/30">
          {dailyData.map((d, i) => {
            const pct = Math.max(6, Math.round((d.rev / maxDayRev) * 100));
            return (
              <div key={i} className="flex flex-col items-center gap-1.5 h-full justify-end group">
                <div className="relative flex flex-col items-center w-full">
                  {d.rev > 0 && (
                    <span className="absolute -top-7 text-[10px] font-mono text-arctic-800 bg-white px-1 rounded shadow-xs opacity-0 group-hover:opacity-100 transition whitespace-nowrap z-10">
                      {formatMoney(d.rev, currency)}
                    </span>
                  )}
                  <div
                    className={`w-full rounded-t-sm transition-all duration-medium ${
                      i === 13 ? "bg-emerald-600" : "bg-arctic-300/80 hover:bg-arctic-400"
                    }`}
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-arctic-500 truncate">{d.date}</span>
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
              <h2 className="text-base font-bold text-arctic-900">Entonnoir de conversion (5 étapes)</h2>
              <p className="text-xs text-arctic-500">Télémétrie en temps réel · Sessions uniques</p>
            </div>
            <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700">
              {funnel.totalVisits} visite{funnel.totalVisits > 1 ? "s" : ""}
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
                    <span className="truncate pr-2">{st.label}</span>
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
                  {idx > 0 && st.stepDropOffPct > 0 && (
                    <div className="text-[10px] text-right text-arctic-500">
                      Abandon étape : -{st.stepDropOffPct}%
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-3 pt-3 border-t border-arctic-200/60 flex items-center justify-between text-xs text-arctic-600">
            <span>Efficacité USSD (Intentions → Encaissé) :</span>
            <span className="font-bold text-emerald-700">{funnel.ussdIntentToConfirmedPct}%</span>
          </div>
        </section>

        {/* Channels */}
        <section className="card p-6 space-y-4">
          <h2 className="text-base font-bold text-arctic-900">Origine des commandes</h2>
          <div className="space-y-3 pt-2">
            {[
              { label: "Catalogue web public", count: sources.catalog || 0, color: "bg-emerald-600" },
              { label: "Discussion WhatsApp", count: sources.whatsapp || 0, color: "bg-teal-500" },
              { label: "Saisie manuelle vendeur", count: sources.manual || 0, color: "bg-arctic-600" },
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
          <h2 className="text-base font-bold text-arctic-900">Top 5 produits par chiffre d&apos;affaires</h2>
          {topProducts.length === 0 ? (
            <p className="text-xs text-arctic-500 italic">Aucune commande enregistrée pour le moment.</p>
          ) : (
            <div className="space-y-3 pt-2">
              {topProducts.map((p, idx) => {
                const pct = Math.min(100, Math.round((p.revenue / maxProdRev) * 100));
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-arctic-800 truncate">{p.name}</span>
                      <span className="text-arctic-600 font-mono">
                        {p.qty} vendus · {formatMoney(p.revenue, currency)}
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
            <h2 className="text-base font-bold text-arctic-900">Heures d&apos;affluence des commandes</h2>
            <span className="text-xs text-arctic-500">Créneaux 0h - 23h</span>
          </div>

          <div className="grid grid-cols-12 items-end gap-1 h-28 pt-4 border-t border-arctic-300/30">
            {/* Show every 2 hours */}
            {Array.from({ length: 12 }, (_, i) => {
              const h = i * 2;
              const count = (hourBuckets[h] || 0) + (hourBuckets[h + 1] || 0);
              const pct = Math.max(8, Math.round((count / (maxHourCount * 2)) * 100));
              return (
                <div key={h} className="flex flex-col items-center gap-1 h-full justify-end group">
                  <div className="relative w-full flex flex-col items-center">
                    {count > 0 && (
                      <span className="absolute -top-5 text-[9px] font-bold text-arctic-700 opacity-0 group-hover:opacity-100 transition">
                        {count}
                      </span>
                    )}
                    <div
                      className="w-full rounded-t-sm bg-brand/70 group-hover:bg-brand transition-all"
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
