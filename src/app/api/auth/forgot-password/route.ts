import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateToken, appUrl } from "@/lib/token";
import { sendEmail } from "@/lib/email";
import { passwordResetEmail } from "@/lib/email-templates";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `forgot:${ip}`, limit: 5, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    return tooManyRequests(rl, "Too many reset requests. Try again later.");
  }

  const body = await req.json().catch(() => null);
  const email = String(body?.email || "").trim().toLowerCase();

  // Always return the same response — don't leak which emails exist.
  const generic = NextResponse.json({
    ok: true,
    message: "If an account exists for that email, a reset link is on its way.",
  });

  if (!email) return generic;

  const vendor = await prisma.vendor.findUnique({ where: { email } });
  if (!vendor || vendor.deletedAt) {
    logger.info("auth.forgot.unknown_email", { email });
    return generic;
  }

  const { token, hash } = generateToken();
  await prisma.passwordResetToken.create({
    data: {
      vendorId: vendor.id,
      tokenHash: hash,
      expiresAt: new Date(Date.now() + 60 * 60_000), // 1 hour
    },
  });

  const rendered = passwordResetEmail({
    shopName: vendor.shopName,
    resetUrl: appUrl(`/reset-password/${token}`),
  });
  await sendEmail({
    vendorId: vendor.id,
    to: vendor.email,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    template: "password_reset",
  });

  logger.info("auth.forgot.sent", { vendorId: vendor.id });
  return generic;
}
