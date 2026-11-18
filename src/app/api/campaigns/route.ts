import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { listCampaigns, createCampaign, getCampaign } from "@/lib/campaigns";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { recordVendorActivity } from "@/lib/clerk-vendor-sync";
import {
  getVendorMetaCampaignMap,
  getVendorMetaConfig,
  launchMetaAdPipeline,
  type MetaAdObjective,
  type MetaCtaType,
  type MetaPlacementId,
} from "@/lib/meta-marketing";

/** GET /api/campaigns — the vendor's campaigns with click/order/revenue stats + Meta Marketing API details. */
export async function GET() {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [campaigns, metaMap, metaConfig] = await Promise.all([
    listCampaigns(vendor.id),
    getVendorMetaCampaignMap(vendor.id),
    getVendorMetaConfig(vendor.id),
  ]);

  const enriched = campaigns.map((c) => ({
    ...c,
    metaDetails: metaMap[c.id] ?? null,
  }));

  return NextResponse.json({
    campaigns: enriched,
    metaConfig: {
      ...metaConfig,
      hasAccessToken: Boolean(metaConfig.accessToken),
      maskedToken: metaConfig.accessToken
        ? `${metaConfig.accessToken.slice(0, 8)}••••••••${metaConfig.accessToken.slice(-4)}`
        : "",
    },
  });
}

/** POST /api/campaigns — mint a new CTWA / Meta Marketing API campaign + 4-step Graph API pipeline. */
export async function POST(req: NextRequest) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const b = await req.json().catch(() => null);
  if (!b) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const name = String(b.name || "").trim();
  if (!name) return NextResponse.json({ error: "Veuillez donner un nom à votre campagne." }, { status: 400 });

  // Accept dailyBudget or spend in major currency units (e.g. "5000" CFA) -> cents
  const dailyBudgetMajor = Number(b.dailyBudget ?? b.spend ?? 25);
  const dailyBudgetCents =
    Number.isFinite(dailyBudgetMajor) && dailyBudgetMajor > 0
      ? Math.round(dailyBudgetMajor * 100)
      : 2500;
  const durationDays = Math.max(1, Math.min(90, Number(b.durationDays) || 7));
  const spendMajor = Number(b.spend);
  const spendCents =
    Number.isFinite(spendMajor) && spendMajor > 0
      ? Math.round(spendMajor * 100)
      : dailyBudgetCents * durationDays;

  const productId = b.productId ? String(b.productId) : null;
  let productRecord: {
    id: string;
    name: string;
    priceCents: number;
    imageUrl: string | null;
    stock: number;
  } | null = null;

  if (productId) {
    productRecord = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id },
      select: {
        id: true,
        name: true,
        priceCents: true,
        imageUrl: true,
        stock: true,
      },
    });
  }

  try {
    const created = await createCampaign(vendor.id, {
      name,
      productId: productRecord?.id ?? null,
      headline: b.headline ? String(b.headline) : productRecord?.name || name,
      body: b.body ? String(b.body) : "",
      cta: b.cta ? String(b.cta) : "Commander sur WhatsApp",
      spendCents,
    });

    const objective: MetaAdObjective =
      b.objective === "OUTCOME_TRAFFIC" ||
      b.objective === "OUTCOME_SALES" ||
      b.objective === "OUTCOME_ENGAGEMENT" ||
      b.objective === "OUTCOME_AWARENESS"
        ? b.objective
        : "LINK_CLICKS";

    const initialMetaStatus: "ACTIVE" | "PAUSED" =
      b.initialStatus === "PAUSED" ? "PAUSED" : "ACTIVE";

    const placements: MetaPlacementId[] = Array.isArray(b.placements) && b.placements.length > 0
      ? (b.placements as MetaPlacementId[])
      : ["whatsapp_status", "whatsapp_ctwa", "facebook_feed", "instagram_feed"];

    const countries: string[] = Array.isArray(b.countries) && b.countries.length > 0
      ? b.countries.map(String)
      : ["TG", "BJ", "CI", "SN"];

    const ageMin = Math.max(18, Math.min(65, Number(b.ageMin) || 18));
    const ageMax = Math.max(ageMin, Math.min(65, Number(b.ageMax) || 55));
    const interests: string[] = Array.isArray(b.interests)
      ? b.interests.map(String).filter(Boolean)
      : [];

    const ctaType: MetaCtaType =
      b.ctaType === "SHOP_NOW" ||
      b.ctaType === "WHATSAPP_MESSAGE" ||
      b.ctaType === "ORDER_NOW" ||
      b.ctaType === "LEARN_MORE" ||
      b.ctaType === "BUY_NOW"
        ? b.ctaType
        : "WHATSAPP_MESSAGE";

    const destinationType: "whatsapp" | "shop_product" =
      b.destinationType === "shop_product" ? "shop_product" : "whatsapp";

    const origin = req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || "https://japora.shop";
    const destinationUrl =
      destinationType === "shop_product" && vendor.shopSlug
        ? `${origin}/c/${vendor.shopSlug}${productRecord ? `?product=${productRecord.id}&ref=${created.refCode}` : `?ref=${created.refCode}`}`
        : `${origin}/go/${created.refCode}`;

    const metaDetails = await launchMetaAdPipeline({
      vendorId: vendor.id,
      campaignId: created.id,
      name: created.name,
      objective,
      status: initialMetaStatus,
      dailyBudgetCents,
      durationDays,
      placements,
      countries,
      ageMin,
      ageMax,
      interests,
      headline: created.headline || created.name,
      body: created.body || `Découvrez ${productRecord?.name || created.name} sur notre boutique Japora !`,
      ctaLabel: created.cta || "Commander",
      ctaType,
      destinationType,
      destinationUrl,
      product: productRecord,
    });

    // Reload updated campaign (in case initial active status incremented metrics)
    const refreshed = (await getCampaign(vendor.id, created.id)) ?? created;

    await recordVendorActivity({
      vendorId: vendor.id,
      type: "marketing.campaign.created",
      subjectType: "campaign",
      subjectId: created.id,
      data: {
        name: created.name,
        refCode: created.refCode,
        metaCampaignId: metaDetails.metaCampaignId,
        objective: metaDetails.objective,
        placements: metaDetails.placements,
        status: metaDetails.status,
      },
    });

    return NextResponse.json({
      ok: true,
      campaign: {
        ...refreshed,
        metaDetails,
      },
    });
  } catch (e) {
    logger.error("campaign.create_failed", { vendorId: vendor.id, error: String(e) });
    return NextResponse.json({ error: "Impossible de créer la campagne publicitaire." }, { status: 500 });
  }
}
