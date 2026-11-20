import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { digitsOnly } from "@/lib/utils";
import { getClientIp, rateLimit, tooManyRequests, envLimit } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

/**
 * POST /api/follow  { shopSlug, phone, name? }
 *
 * Public — a customer opts in to a shop's "new drop" alerts. Idempotent per
 * (vendor, phone); re-following clears any prior unsubscribe. Rate-limited.
 */
export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `follow:${ip}`, limit: envLimit("FOLLOW_RATE_LIMIT", 20), windowMs: 60_000 });
  if (!rl.allowed) return tooManyRequests(rl);

  const body = await req.json().catch(() => null);
  const shopSlug = String(body?.shopSlug || "").trim();
  const phone = digitsOnly(String(body?.phone || ""));
  const name = String(body?.name || "").trim().slice(0, 80);

  if (!shopSlug) return NextResponse.json({ error: tr("Boutique manquante.", "Missing shop.") }, { status: 400 });
  if (phone.length < 8 || phone.length > 15) {
    return NextResponse.json({ error: tr("Entrez un numéro WhatsApp valide.", "Enter a valid WhatsApp number.") }, { status: 400 });
  }

  const vendor = await prisma.vendor.findFirst({
    where: { shopSlug, deletedAt: null },
    select: { id: true, shopName: true },
  });
  if (!vendor) return NextResponse.json({ error: tr("Boutique introuvable.", "Shop not found.") }, { status: 404 });

  await prisma.follower.upsert({
    where: { vendorId_phone: { vendorId: vendor.id, phone } },
    update: { name: name || undefined, unsubscribedAt: null, optInAt: new Date() },
    create: { vendorId: vendor.id, phone, name },
  });

  logger.info("follow.opt_in", { vendorId: vendor.id });
  return NextResponse.json({ ok: true, message: `You'll hear from ${vendor.shopName} when new stock drops.` });
}
