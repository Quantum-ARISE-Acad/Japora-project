/**
 * Japora maintenance cron — housekeeping that keeps the system healthy at scale.
 * Schedule hourly (see vercel.json) with the same shared-secret auth as the
 * daily summary: `?key=CRON_SECRET` or `X-Cron-Key`.
 *
 * Does three bounded, idempotent jobs:
 *   1. Retry failed outbound WhatsApp sends (transient provider errors) — plain
 *      text only (interactive/template payloads can't be faithfully replayed).
 *      Each failed row is re-sent then marked "retried" so it's tried once.
 *   2. Delete expired one-time codes (OtpCode past expiresAt).
 *   3. Delete campaign attribution touches older than the attribution window
 *      (they can no longer credit an order, so they're dead weight).
 *   4. Drain the spine bus outbox — the scheduled half of the guarantee that a
 *      catalogue fact reaches its consumers even when every write-path kick was
 *      killed with its serverless function. The report carries `remaining` and
 *      `dead` so an unreachable spine shows up as a number somebody reads,
 *      rather than as eight products quietly waiting.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendWhatsApp } from "@/lib/whatsapp";
import { drainOutbox } from "@/lib/bus";

const RETRY_LOOKBACK_MS = 24 * 60 * 60 * 1000; // only retry recent failures
const RETRY_BATCH = 50; // bound the fan-out per run
const TOUCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // mirrors campaigns.ts
const OUTBOX_BATCH = 200; // bound the bus drain per run, like every job here

async function retryFailedSends(): Promise<{ retried: number; failedAgain: number }> {
  const since = new Date(Date.now() - RETRY_LOOKBACK_MS);
  const failed = await prisma.whatsAppMessage.findMany({
    where: {
      direction: "OUT",
      status: "failed",
      broadcastId: null,
      createdAt: { gte: since },
      NOT: { body: { startsWith: "[" } }, // skip [interactive]/[template:…]
    },
    orderBy: { createdAt: "asc" },
    take: RETRY_BATCH,
    select: { id: true, vendorId: true, contact: true, body: true, orderId: true },
  });

  let retried = 0;
  let failedAgain = 0;
  for (const m of failed) {
    try {
      const r = await sendWhatsApp({
        vendorId: m.vendorId,
        to: m.contact,
        body: m.body,
        orderId: m.orderId,
      });
      if (r.status === "failed") failedAgain++;
      else retried++;
    } catch (e) {
      failedAgain++;
      logger.warn("cron.maintenance.retry_threw", { id: m.id, error: String(e) });
    }
    // Mark the original as handled so we don't retry it forever.
    await prisma.whatsAppMessage.update({ where: { id: m.id }, data: { status: "retried" } });
  }
  return { retried, failedAgain };
}

async function handle(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const provided = req.nextUrl.searchParams.get("key") || req.headers.get("x-cron-key");
  if (!expected || provided !== expected) {
    logger.warn("cron.maintenance.unauthorized", { hasProvided: Boolean(provided) });
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const [sends, expiredOtp, oldTouches, bus] = await Promise.all([
    retryFailedSends(),
    prisma.otpCode.deleteMany({ where: { expiresAt: { lt: now } } }),
    prisma.campaignTouch.deleteMany({
      where: { createdAt: { lt: new Date(now.getTime() - TOUCH_WINDOW_MS) } },
    }),
    drainOutbox({ limit: OUTBOX_BATCH }),
  ]);

  const result = {
    ok: true,
    retriedSends: sends.retried,
    failedAgain: sends.failedAgain,
    expiredOtpCodes: expiredOtp.count,
    prunedTouches: oldTouches.count,
    bus,
  };
  logger.info("cron.maintenance.done", result);
  if (bus.dead || bus.blocked) {
    // Separate line, at a level that pages: `bus.dead` means a fact has been
    // given up on, and `bus.blocked` means nothing is even being attempted.
    // Both are invisible inside a success payload nobody reads twice.
    logger.error("cron.maintenance.bus_backlog", {
      dead: bus.dead,
      blocked: bus.blocked,
      remaining: bus.remaining,
      disabled: bus.disabled,
    });
  }
  return Response.json(result);
}

export const GET = handle;
export const POST = handle;
