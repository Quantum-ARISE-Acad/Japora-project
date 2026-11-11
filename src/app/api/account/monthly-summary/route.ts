import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { computeMonth, defaultPeriod, renderHtml } from "@/lib/bookkeeping";
import { logger } from "@/lib/logger";

/**
 * GET /api/account/monthly-summary?year=YYYY&month=MM
 *
 * Returns a printable HTML document — the vendor's confirmed-revenue
 * bookkeeping summary for the given calendar month. Used for tax filings,
 * micro-loan applications, and accountant hand-offs. Defaults to the most
 * recently *completed* month when params are missing or invalid.
 */
export async function GET(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const yearRaw = url.searchParams.get("year");
  const monthRaw = url.searchParams.get("month");

  const fallback = defaultPeriod();
  let year = Number(yearRaw);
  let month = Number(monthRaw);
  if (!Number.isFinite(year) || year < 2000 || year > 2100) year = fallback.year;
  if (!Number.isFinite(month) || month < 1 || month > 12) month = fallback.month;

  const summary = await computeMonth(vendor.id, year, month);
  const html = renderHtml(summary, vendor);

  logger.info("bookkeeping.summary_rendered", {
    vendorId: vendor.id,
    year,
    month,
    orderCount: summary.orderCount,
    revenueCents: summary.revenueCents,
  });

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Vendor-private — don't let intermediaries cache it.
      "Cache-Control": "private, no-store",
    },
  });
}
