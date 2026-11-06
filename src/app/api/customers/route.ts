import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { listForVendor, qualifyingOrderCountsForCustomers } from "@/lib/customers";

export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q") || undefined;
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    200,
    Math.max(1, parseInt(sp.get("pageSize") || "50", 10) || 50),
  );

  const res = await listForVendor(vendor.id, { q, page, pageSize });
  const qualifyingOrderCounts = await qualifyingOrderCountsForCustomers(vendor.id, res.customers.map((c) => c.id));
  return NextResponse.json({
    ...res,
    customers: res.customers.map((customer) => ({
      ...customer,
      qualifyingOrderCount: qualifyingOrderCounts.get(customer.id) ?? 0,
    })),
  });
}
