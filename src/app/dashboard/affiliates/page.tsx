import { requireVendor } from "@/lib/auth";
import { listForVendor } from "@/lib/affiliate";
import AffiliatesClient from "./AffiliatesClient";

export default async function AffiliatesPage() {
  const vendor = await requireVendor();
  const affiliates = await listForVendor(vendor.id);

  const dto = affiliates.map((a) => ({
    id: a.id,
    code: a.code,
    name: a.name,
    commissionPct: a.commissionPct,
    totalEarnedCents: a.totalEarnedCents,
    sumCommissionCents: a.sumCommissionCents,
    attributionCount: a.attributionCount,
    createdAt: a.createdAt.toISOString(),
  }));

  return <AffiliatesClient initialAffiliates={dto} currency={vendor.currency} />;
}
