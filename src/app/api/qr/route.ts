import { NextRequest, NextResponse } from "next/server";
import { renderQrSvg } from "@/lib/qr";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

/**
 * GET /api/qr?data=<url>&download=1
 *
 * Returns an SVG QR for any URL. Public (a QR is a link) but rate-limited per
 * IP so it can't be used as a free render farm. Capped at same-origin-ish use
 * by length limit + the rate limiter.
 *
 * Cache for a day — QR for a given URL never changes.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `qr:${ip}`, limit: 60, windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequests(rl);

  const data = req.nextUrl.searchParams.get("data") || "";
  const download = req.nextUrl.searchParams.get("download") === "1";
  const filename = req.nextUrl.searchParams.get("name") || "japora-qr";

  if (!data || data.length > 1024) {
    return NextResponse.json({ error: "Provide a `data` value (≤1024 chars)." }, { status: 400 });
  }

  try {
    const svg = await renderQrSvg(data);
    const headers: Record<string, string> = {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400, immutable",
    };
    if (download) {
      headers["Content-Disposition"] = `attachment; filename="${filename}.svg"`;
    }
    return new Response(svg, { status: 200, headers });
  } catch (e) {
    logger.error("qr.render_failed", { error: e instanceof Error ? e.message : String(e) });
    return NextResponse.json({ error: "Could not generate QR." }, { status: 500 });
  }
}
