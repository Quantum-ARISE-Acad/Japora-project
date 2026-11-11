/**
 * Public share-asset endpoint.
 *
 * GET /api/products/:id/asset/:format where format in [status, ig, tiktok].
 * Renders an SVG poster for the product (price card, image, shop watermark)
 * so vendors can download and drop it straight into WhatsApp Status / IG /
 * TikTok. No auth — the product just needs to exist and not be soft-deleted.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  renderInstagramSquare,
  renderStatusCard,
  renderTikTokVertical,
  isAssetFormat,
  type AssetFormat,
  type AssetOpts,
} from "@/lib/assets";
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

export async function GET(_req: NextRequest, { params }: Params) {
  const { id, format } = await params;

  if (!isAssetFormat(format)) {
    return NextResponse.json(
      { error: "Unknown format. Use one of: status, ig, tiktok." },
      { status: 400 },
    );
  }

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        vendor: {
          select: {
            shopName: true,
            shopSlug: true,
            currency: true,
            tagline: true,
            deletedAt: true,
            isPublic: true,
          },
        },
      },
    });

    if (!product || !product.vendor || product.vendor.deletedAt) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const opts: AssetOpts = {
      productName: product.name,
      priceLabel: formatMoney(product.priceCents, product.vendor.currency),
      shopName: product.vendor.shopName,
      shopUrl: `japora.market/c/${product.vendor.shopSlug}`,
      imageUrl: product.imageUrl || undefined,
      tagline: product.vendor.tagline || undefined,
    };

    const svg = render(format, opts);
    const filename = `japora-${slugify(product.name)}-${format}.svg`;

    return new NextResponse(svg, {
      status: 200,
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (e) {
    logger.error("asset.render_failed", {
      productId: id,
      format,
      error: String(e),
    });
    return NextResponse.json({ error: "Failed to render asset" }, { status: 500 });
  }
}
