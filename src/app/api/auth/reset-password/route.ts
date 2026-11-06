import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validatePassword } from "@/lib/auth";
import { hashToken } from "@/lib/token";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `reset:${ip}`, limit: 10, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return tooManyRequests(rl, "Too many attempts. Try again later.");
  }

  const body = await req.json().catch(() => null);
  const token = String(body?.token || "").trim();
  const password = String(body?.password || "");

  if (!token) return NextResponse.json({ error: "Missing token." }, { status: 400 });
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) return NextResponse.json({ error: pwCheck.reason }, { status: 400 });

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  await prisma.$transaction([
    prisma.vendor.update({
      where: { id: record.vendorId },
      data: { passwordHash: await hashPassword(password) },
    }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Invalidate every other pending reset token for this vendor.
    prisma.passwordResetToken.updateMany({
      where: { vendorId: record.vendorId, usedAt: null, NOT: { id: record.id } },
      data: { usedAt: new Date() },
    }),
  ]);

  logger.info("auth.reset.success", { vendorId: record.vendorId });
  return NextResponse.json({ ok: true });
}
