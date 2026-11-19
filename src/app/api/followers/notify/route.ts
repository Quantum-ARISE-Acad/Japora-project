import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { sendWhatsApp } from "@/lib/whatsapp";
import { checkBroadcastQuota } from "@/lib/broadcast";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

/**
 * POST /api/followers/notify  { message }
 *
 * Authed. Sends a "new drop" message to all of the vendor's active followers
 * via WhatsApp (stub logs in dev; real Cloud API in live — production should
 * use a Marketing-category template for out-of-window sends). Throttled.
 */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) return NextResponse.json({ error: tr("Veuillez vous connecter.", "Please sign in.") }, { status: 401 });

  const rl = rateLimit({ key: `followers.notify:${vendor.id}`, limit: 6, windowMs: 60 * 60_000 });
  if (!rl.allowed) return tooManyRequests(rl, "You've sent a few blasts recently. Try again later.");

  const body = await req.json().catch(() => ({}));
  const message = String(body?.message || "").trim().slice(0, 1000);
  if (!message) return NextResponse.json({ error: tr("Écrivez d'abord un message.", "Write a message first.") }, { status: 400 });

  const followers = await prisma.follower.findMany({
    where: { vendorId: vendor.id, unsubscribedAt: null },
    select: { phone: true },
  });
  if (followers.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, message: "No followers yet." });
  }

  // Monthly free-broadcast quota (a follower blast is a paid Marketing template).
  const quota = await checkBroadcastQuota(
    vendor.id,
    followers.length,
    vendor.subscriptionStatus === "active",
  );
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You've used ${quota.used} of ${quota.cap} free broadcast messages this month. Upgrade to keep blasting, or it resets next month.`,
        used: quota.used,
        cap: quota.cap,
        remaining: quota.remaining,
      },
      { status: 402 },
    );
  }

  let sent = 0;
  for (const f of followers) {
    try {
      await sendWhatsApp({ vendorId: vendor.id, to: f.phone, body: message });
      sent++;
    } catch (e) {
      logger.warn("followers.notify.send_failed", { vendorId: vendor.id, error: String(e) });
    }
  }

  // Record it as a broadcast so it counts toward the monthly quota.
  await prisma.broadcast.create({
    data: {
      vendorId: vendor.id,
      body: message,
      segment: "all",
      targetCount: followers.length,
      sentCount: sent,
      status: "sent",
      sentAt: new Date(),
    },
  }).catch((e) => logger.warn("followers.notify.record_failed", { error: String(e) }));

  logger.info("followers.notify", { vendorId: vendor.id, sent, total: followers.length });
  return NextResponse.json({ ok: true, sent, total: followers.length, remaining: quota.remaining - sent });
}
