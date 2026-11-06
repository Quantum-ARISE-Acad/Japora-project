/**
 * Campaign creative endpoint — the "auto-built Ad" half of the CTWA studio.
 *
 * GET /api/campaigns/:id/asset/:format (status | ig | tiktok). Auth-scoped to
 * the owning vendor. Renders a ready-to-run ad poster using the campaign's
 * product image + price, with the campaign headline as the hook and the
 * trackable /go link as the call to action. Download → upload as a Facebook /
 * Instagram "Click to WhatsApp" ad creative (or post anywhere), and every click
 * routes through /go/<refCode> for attribution.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import {
  renderInstagramSquare,
  renderStatusCard,
  renderTikTokVertical,
  isAssetFormat,
  type AssetFormat,
  type AssetOpts,
} from "@/lib/assets";
import { goPath } from "@/lib/campaigns";
import { formatMoney, slugify } from "@/lib/utils";
import { logger } from "@/lib/logger";

type Params = { params: Promise<{ id: string; format: string }> };

function render(format: AssetFormat, opts: AssetOpts): string {
  switch (format) {
    case "status":
      return renderStatusCard(opts);
    case "ig":
      return renderInstagramSquare(opts);
    case "tiktok":
      return renderTikTokVertical(opts);
  }
}

function baseHost(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL || "https://japora.market";
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

export async function GET(_req: NextRequest, { params }: Params) {
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, format } = await params;
  if (!isAssetFormat(format)) {
    return NextResponse.json({ error: "Unknown format. Use: status, ig, tiktok." }, { status: 400 });
  }

  try {
    const campaign = await prisma.campaign.findFirst({
      where: { id, vendorId: vendor.id, deletedAt: null },
    });
    if (!campaign) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });

    let productName = campaign.name;
    let priceLabel = campaign.cta || "Shop now";
    let imageUrl: string | undefined;
    if (campaign.productId) {
      const product = await prisma.product.findFirst({
        where: { id: campaign.productId, vendorId: vendor.id },
        select: { name: true, priceCents: true, imageUrl: true },
      });
      if (product) {
        productName = product.name;
        priceLabel = formatMoney(product.priceCents, vendor.currency);
        imageUrl = product.imageUrl || undefined;
      }
    }

    const opts: AssetOpts = {
      productName: campaign.headline || productName,
      priceLabel,
      shopName: vendor.shopName,
      shopUrl: `${baseHost()}${goPath(campaign.refCode)}`,
      imageUrl,
      tagline: campaign.cta || "Order on WhatsApp",
    };

    const svg = render(format, opts);
    const filename = `japora-ad-${slugify(campaign.name)}-${format}.svg`;
    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch (e) {
    logger.error("campaign.asset_failed", { campaignId: id, format, error: String(e) });
    return NextResponse.json({ error: "Failed to render creative" }, { status: 500 });
  }
}
