/**
 * Japora Daily Hustle Summary cron — runs 18:00 UTC via vercel.json.
 *
 * Auth is a shared secret: ?key=CRON_SECRET or X-Cron-Key header. Mismatch
 * returns 401 so an external scheduler (or accidental browse) can't trigger
 * the fan-out. Iterates every active vendor and sends a per-vendor summary.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendDailySummary } from "@/lib/hustle";
import { isAuthorizedCron } from "@/lib/cron-auth";

async function handle(req: NextRequest) {
  const auth = isAuthorizedCron(req);

  if (!auth.ok) {
    logger.warn("cron.daily_summary.unauthorized", {
      hasProvided: auth.hasProvided,
      hasExpected: auth.hasExpected,
    });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const vendors = await prisma.vendor.findMany({
    where: { deletedAt: null, emailVerifiedAt: { not: null } },
    select: {
      id: true,
      email: true,
      shopName: true,
      whatsappNumber: true,
    },
  });

  let sent = 0;
  let failed = 0;
  let totalOrders = 0;
  let totalRevenueCents = 0;

  for (const v of vendors) {
    try {
      const s = await sendDailySummary(v);
      sent += 1;
      totalOrders += s.counts.orders;
      totalRevenueCents += s.counts.revenueCents;
    } catch (e) {
      failed += 1;
      logger.error("cron.daily_summary.vendor_failed", {
        vendorId: v.id,
        error: String(e),
      });
    }
  }

  logger.info("cron.daily_summary.completed", {
    vendorCount: vendors.length,
    sent,
    failed,
    totalOrders,
    totalRevenueCents,
  });

  return Response.json({
    ok: true,
    vendorCount: vendors.length,
    sent,
    failed,
    totalOrders,
    totalRevenueCents,
  });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
