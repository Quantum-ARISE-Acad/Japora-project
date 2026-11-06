import { NextRequest, NextResponse } from "next/server";
import { recordClick, prefillText } from "@/lib/campaigns";
import { logger } from "@/lib/logger";
import { publicOrigin } from "@/lib/public-origin";

/**
 * GET /go/<refCode> — the trackable CTWA link.
 *
 * Counts the click, then 302s the customer straight into WhatsApp with a
 * pre-filled message carrying the campaign ref tag. When they send it, the
 * webhook records the attribution touch (see src/lib/campaigns.ts). Unknown or
 * archived codes fall back to the marketing site so a stale flyer link never
 * dead-ends.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ ref: string }> }) {
  const { ref } = await ctx.params;
  const hit = await recordClick(ref);

  if (!hit || !hit.vendorPhone) {
    logger.warn("go.unknown_ref", { ref });
    return NextResponse.redirect(new URL("/", publicOrigin(req)));
  }

  const text = prefillText({
    shopName: hit.shopName,
    productName: hit.productName,
    refCode: hit.refCode,
  });
  const waUrl = `https://wa.me/${hit.vendorPhone}?text=${encodeURIComponent(text)}`;
  return NextResponse.redirect(waUrl, { status: 302 });
}
