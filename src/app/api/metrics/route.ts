import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/metrics — business counters in Prometheus text format for the
 * stand's Grafana screen (QR/catalog traffic, WhatsApp messages, paid orders).
 *
 * Prometheus scrapes it on the internal `monitoring` network; Caddy answers 404
 * for this path on the public domain. When METRICS_TOKEN is set, a matching
 * `Authorization: Bearer` header is also required.
 *
 * Values are recomputed from the database on each scrape, so they are gauges:
 * they survive restarts and can only drop if rows are deleted.
 */
function authorized(req: NextRequest): boolean {
  const token = process.env.METRICS_TOKEN;
  if (!token) return true;
  const header = req.headers.get("authorization") || "";
  const provided = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(token);
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

function line(name: string, value: number, labels?: Record<string, string>): string {
  const l = labels
    ? `{${Object.entries(labels).map(([k, v]) => `${k}="${v.replace(/["\\\n]/g, "_")}"`).join(",")}}`
    : "";
  return `${name}${l} ${Number.isFinite(value) ? value : 0}`;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return new NextResponse("Unauthorized\n", { status: 401 });

  try {
    const [visits, clicks, messages, orders] = await Promise.all([
      prisma.funnelEvent.count({ where: { stage: "visit" } }),
      prisma.campaign.aggregate({ _sum: { clicks: true } }),
      prisma.whatsAppMessage.groupBy({ by: ["direction"], _count: { _all: true } }),
      prisma.order.groupBy({ by: ["status"], where: { deletedAt: null }, _count: { _all: true } }),
    ]);

    const out: string[] = [
      "# HELP japora_catalog_visits_total Catalogue visits (QR scans and shared links).",
      "# TYPE japora_catalog_visits_total gauge",
      line("japora_catalog_visits_total", visits),
      "# HELP japora_campaign_link_clicks_total Clicks on trackable QR/flyer campaign links (/go/<ref>).",
      "# TYPE japora_campaign_link_clicks_total gauge",
      line("japora_campaign_link_clicks_total", clicks._sum.clicks ?? 0),
      "# HELP japora_whatsapp_messages_total WhatsApp messages stored, by direction (IN or OUT).",
      "# TYPE japora_whatsapp_messages_total gauge",
    ];
    const byDirection = new Map(messages.map((m) => [m.direction, m._count._all]));
    for (const direction of ["IN", "OUT"]) out.push(line("japora_whatsapp_messages_total", byDirection.get(direction) ?? 0, { direction }));

    out.push("# HELP japora_orders_total Orders (not deleted), by status.", "# TYPE japora_orders_total gauge");
    for (const o of orders) out.push(line("japora_orders_total", o._count._all, { status: o.status }));

    const paid = orders.filter((o) => o.status === "PAID" || o.status === "DELIVERED").reduce((n, o) => n + o._count._all, 0);
    out.push(
      "# HELP japora_orders_paid_total Orders paid (status PAID or DELIVERED).",
      "# TYPE japora_orders_paid_total gauge",
      line("japora_orders_paid_total", paid),
      "# HELP japora_metrics_up 1 when the database answered this scrape.",
      "# TYPE japora_metrics_up gauge",
      line("japora_metrics_up", 1),
    );

    return new NextResponse(out.join("\n") + "\n", {
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    logger.error("metrics.failed", { error: String(e) });
    return new NextResponse("# TYPE japora_metrics_up gauge\njapora_metrics_up 0\n", {
      status: 503,
      headers: { "Content-Type": "text/plain; version=0.0.4; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
