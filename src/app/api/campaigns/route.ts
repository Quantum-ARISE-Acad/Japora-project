import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { listCampaigns, createCampaign } from "@/lib/campaigns";
import { logger } from "@/lib/logger";

/** GET /api/campaigns — the vendor's campaigns with click/order/revenue stats. */
export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaigns = await listCampaigns(vendor.id);
  return NextResponse.json({ campaigns });
}

/** POST /api/campaigns — mint a new CTWA campaign + trackable link. */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Give your campaign a name." }, { status: 400 });

  // Accept spend in major currency units (e.g. "5000" CFA) → cents.
  const spendMajor = Number(b.spend);
  const spendCents = Number.isFinite(spendMajor) && spendMajor > 0 ? Math.round(spendMajor * 100) : 0;

  try {
    const campaign = await createCampaign(vendor.id, {
      name,
      productId: b.productId ? String(b.productId) : null,
      headline: b.headline ? String(b.headline) : "",
      body: b.body ? String(b.body) : "",
      cta: b.cta ? String(b.cta) : "Shop now",
      spendCents,
    });
    return NextResponse.json({ ok: true, campaign });
  } catch (e) {
    logger.error("campaign.create_failed", { vendorId: vendor.id, error: String(e) });
    return NextResponse.json({ error: "Could not create campaign." }, { status: 500 });
  }
}
