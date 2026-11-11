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
  const code = ref.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const cookieName = `jp_campaign_seen_${code}`;
  const alreadyCounted = Boolean(req.cookies.get(cookieName)?.value);
  const hit = await recordClick(ref, { countClick: !alreadyCounted });

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
  const response = NextResponse.redirect(waUrl, { status: 302 });
  if (!alreadyCounted) {
    response.cookies.set(cookieName, "1", {
      httpOnly: true,
      secure: req.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: `/go/${code}`,
      maxAge: 30 * 24 * 60 * 60,
    });
  }
  return response;
}
