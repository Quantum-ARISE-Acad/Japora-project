import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { listCampaigns, createCampaign } from "@/lib/campaigns";
import { logger } from "@/lib/logger";
import { normalizeAdPlatform } from "@/lib/ad-copy";
import { prisma } from "@/lib/db";

/** GET /api/campaigns — the vendor's campaigns with click/order/revenue stats. */
export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter." }, { status: 401 });
  const campaigns = await listCampaigns(vendor.id);
  return NextResponse.json({ campaigns });
}

/** POST /api/campaigns — mint a new CTWA campaign + trackable link. */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Veuillez vous connecter." }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "La demande est invalide." }, { status: 400 });

  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Saisissez un nom pour la campagne." }, { status: 400 });

  // Accept spend in major currency units (e.g. "5000" CFA) → cents.
  const spendMajor = Number(b.spend);
  const spendCents = Number.isFinite(spendMajor) && spendMajor > 0 ? Math.round(spendMajor * 100) : 0;
  if (spendCents > 2_147_483_647) {
    return NextResponse.json({ error: "Le budget déclaré dépasse la limite autorisée." }, { status: 400 });
  }

  const productId = b.productId ? String(b.productId) : null;
  if (productId) {
    const product = await prisma.product.findFirst({ where: { id: productId, vendorId: vendor.id, isActive: true }, select: { id: true } });
    if (!product) return NextResponse.json({ error: "Le produit sélectionné est indisponible dans cette boutique." }, { status: 400 });
  }

  const targetRegion = typeof b.targetRegion === "string" ? b.targetRegion.trim().slice(0, 120) : "";

  try {
    const campaign = await createCampaign(vendor.id, {
      name,
      productId,
      platform: normalizeAdPlatform(b.platform),
      targetRegion,
      headline: b.headline ? String(b.headline) : "",
      body: b.body ? String(b.body) : "",
      cta: b.cta ? String(b.cta) : "Commander sur WhatsApp",
      spendCents,
    });
    return NextResponse.json({ ok: true, campaign });
  } catch (e) {
    logger.error("campaign.create_failed", { vendorId: vendor.id, error: String(e) });
    return NextResponse.json({ error: "Impossible de créer la campagne." }, { status: 500 });
  }
}
