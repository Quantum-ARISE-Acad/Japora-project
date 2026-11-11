import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { outboxBacklog } from "@/lib/bus";

/**
 * Health check for uptime probes (Railway, Fly, k8s liveness/readiness,
 * UptimeRobot, Better Uptime, etc.). Returns 200 if the DB is reachable,
 * 503 if not — that's the signal a load balancer needs to drop the instance.
 *
 * It also reports the spine bus backlog, because this is the one endpoint an
 * operator already polls and a silently-undelivered event is otherwise visible
 * to nobody. It does NOT change the status code on a backlog: a queue that
 * cannot reach the spine is not an instance a load balancer should drop, and
 * conflating the two would take the app down for a bus outage.
 */
export async function GET() {
  const startedAt = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    // Never allowed to fail the probe: the backlog is information about the bus,
    // and the probe is a question about this instance.
    const bus = await outboxBacklog().catch(() => null);
    return NextResponse.json({
      status: "ok",
      db: "ok",
      bus,
      uptime: Math.round(process.uptime()),
      checkedAt: new Date().toISOString(),
      latencyMs: Date.now() - startedAt,
    });
  } catch (e) {
    logger.error("health.db_check_failed", { error: String(e) });
    return NextResponse.json(
      {
        status: "degraded",
        db: "down",
        uptime: Math.round(process.uptime()),
        checkedAt: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
