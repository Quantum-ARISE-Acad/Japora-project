import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { setUnifiedCookie } from "@/lib/unified-auth";
import { envLimit, getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `login:${ip}`, limit: envLimit("LOGIN_RATE_LIMIT", 5), windowMs: 15 * 60_000 });
  if (!rl.allowed) {
    logger.warn("auth.login.rate_limited", { ip });
    return tooManyRequests(rl, "Too many sign-in attempts. Try again in a few minutes.");
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();
  const password = String(body?.password || "");

  if (!email || !password) {
    return NextResponse.json({ error: "Email et mot de passe requis." }, { status: 400 });
  }

  const vendor = await prisma.vendor.findUnique({ where: { email } });
  if (!vendor || vendor.deletedAt || !(await verifyPassword(password, vendor.passwordHash))) {
    logger.info("auth.login.failed", { ip, email });
    return NextResponse.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  }

  await createSession({ vendorId: vendor.id, email: vendor.email });
  await setUnifiedCookie({
    sub: vendor.email,
    email: vendor.email,
    name: vendor.shopName || undefined,
    phone: vendor.phone || vendor.whatsappNumber || undefined,
    role: "VENDOR",
    originApp: "japora",
  });

  logger.info("auth.login.success", { vendorId: vendor.id });
  return NextResponse.json({ ok: true });
}

