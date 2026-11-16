import { requireVendor } from "@/lib/auth";
import { computeMonth, defaultPeriod } from "@/lib/bookkeeping";
import { getDashboardLocale, trServer } from "@/lib/dashboard-lang";
import BookkeepingClient from "./BookkeepingClient";

export default async function BookkeepingPage() {
  const vendor = await requireVendor();
  const locale = await getDashboardLocale(vendor.language);
  const tr = <T = string,>(frVal: T, enVal: T): T => trServer(locale, frVal, enVal);

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;
  const last = defaultPeriod(now);

  // Compute both periods in parallel — both are scoped to this vendor so
  // there's no cross-tenant leakage risk and Postgres handles the load fine.
  const [currentSummary, lastSummary] = await Promise.all([
    computeMonth(vendor.id, currentYear, currentMonth),
    computeMonth(vendor.id, last.year, last.month),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-arctic-900">
          {tr("Comptabilité & Rapports", "Bookkeeping & Reports")}
        </h1>
        <p className="text-sm text-arctic-600">
          {tr(
            "Bilans mensuels de revenus à imprimer, enregistrer en PDF ou transmettre à votre comptable ou banquier.",
            "Monthly revenue summaries you can print, save as PDF, or hand to your accountant or loan officer.",
          )}
        </p>
      </div>
      <BookkeepingClient
        currency={vendor.currency || "USD"}
        currentSummary={{
          year: currentSummary.period.year,
          month: currentSummary.period.month,
          label: currentSummary.period.label,
          orderCount: currentSummary.orderCount,
          revenueCents: currentSummary.revenueCents,
          avgOrderValueCents: currentSummary.avgOrderValueCents,
          openReceivablesCents: currentSummary.openReceivablesCents,
          topProducts: currentSummary.topProducts,
        }}
        lastSummary={{
          year: lastSummary.period.year,
          month: lastSummary.period.month,
          label: lastSummary.period.label,
          orderCount: lastSummary.orderCount,
          revenueCents: lastSummary.revenueCents,
          avgOrderValueCents: lastSummary.avgOrderValueCents,
          openReceivablesCents: lastSummary.openReceivablesCents,
          topProducts: lastSummary.topProducts,
        }}
      />
    </div>
  );
}
