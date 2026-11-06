import { requireVendor } from "@/lib/auth";
import { listForVendor, qualifyingOrderCountsForCustomers } from "@/lib/customers";
import CustomersClient from "./CustomersClient";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string; page?: string }>;
}) {
  const vendor = await requireVendor();
  const sp = (await searchParams) ?? {};
  const q = (sp.q || "").trim();
  const page = Math.max(1, parseInt(sp.page || "1", 10) || 1);

  const { customers, total } = await listForVendor(vendor.id, {
    q,
    page,
    pageSize: 100,
  });
  const qualifyingOrderCounts = await qualifyingOrderCountsForCustomers(vendor.id, customers.map((c) => c.id));

  // Trim to DTOs so we don't ship Date objects / extra columns into the client.
  const rows = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    email: c.email ?? "",
    notes: c.notes,
    orderCount: c.orderCount,
    qualifyingOrderCount: qualifyingOrderCounts.get(c.id) ?? 0,
    totalSpentCents: c.totalSpentCents,
    lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <CustomersClient
      initialRows={rows}
      total={total}
      initialQuery={q}
      currency={vendor.currency}
      shopName={vendor.shopName}
    />
  );
}
