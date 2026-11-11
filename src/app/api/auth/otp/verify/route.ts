import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { verifyOtp, isValidPhone, normalizePhone } from "@/lib/otp";
import { hashPassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { slugify } from "@/lib/utils";
import { newVendorTrialDates } from "@/lib/billing";
import { ensureReferralCode, recordSignupReferral } from "@/lib/referral";
import { joinByCode } from "@/lib/cooperative";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";

/**
 * POST /api/auth/otp/verify  { phone, code, shopName?, ref? }
 *
 * Verifies the code, then logs in an existing phone-vendor or creates a new
 * one and signs them in. New OTP vendors get:
 *   - phone identity (+ phoneVerifiedAt)
 *   - a placeholder email (wa_<phone>@japora.local) so the rest of the app's
 *     email-keyed code keeps working; they can set a real one in settings
 *   - XOF default currency (Togo-first) + a 30-day trial + a referral code
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `otp.verify:${ip}`, limit: 20, windowMs: 15 * 60_000 });
  if (!rl.allowed) return tooManyRequests(rl);

  const body = await req.json().catch(() => null);
  const phone = normalizePhone(String(body?.phone || ""));
  const code = String(body?.code || "").trim();
  const shopNameInput = String(body?.shopName || "").trim();
  const ref = typeof body?.ref === "string" ? body.ref.trim() : "";
  const coop = typeof body?.coop === "string" ? body.coop.trim() : "";

  if (!isValidPhone(phone) || !/^\d{4,8}$/.test(code)) {
    return NextResponse.json({ error: "Enter the code we sent you." }, { status: 400 });
  }

  const check = await verifyOtp(phone, code);
  if (!check.ok) return NextResponse.json({ error: check.reason }, { status: 400 });

  // Existing phone vendor → log in.
  const existing = await prisma.vendor.findFirst({ where: { phone } });
  if (existing && !existing.deletedAt) {
    await prisma.vendor.update({
      where: { id: existing.id },
      data: { phoneVerifiedAt: existing.phoneVerifiedAt ?? new Date() },
    });
    if (coop) await joinByCode(existing.id, coop).catch(() => {});
    await createSession({ vendorId: existing.id, email: existing.email });
    logger.info("otp.login", { vendorId: existing.id });
    return NextResponse.json({ ok: true, isNew: false, shopSlug: existing.shopSlug });
  }

  // New vendor.
  const shopName = shopNameInput || "My Shop";
  const base = slugify(shopName);
  let shopSlug = base;
  let n = 1;
  while (await prisma.vendor.findUnique({ where: { shopSlug } })) {
    shopSlug = `${base}-${n++}`;
  }
  const placeholderEmail = `wa_${phone}@japora.local`;
  const randomPw = await hashPassword(randomBytes(18).toString("hex"));

  const vendor = await prisma.vendor.create({
    data: {
      email: placeholderEmail,
      passwordHash: randomPw,
      phone,
      phoneVerifiedAt: new Date(),
      shopName,
      shopSlug,
      whatsappNumber: phone,
      currency: "XOF", // Togo-first default
      onboardedAt: new Date(),
      ...newVendorTrialDates(),
    },
  });

  await ensureReferralCode(vendor.id).catch(() => {});
  if (ref) await recordSignupReferral(vendor.id, ref).catch(() => {});
  if (coop) await joinByCode(vendor.id, coop).catch(() => {});

  await createSession({ vendorId: vendor.id, email: vendor.email });
  logger.info("otp.signup", { vendorId: vendor.id, shopSlug });
  return NextResponse.json({ ok: true, isNew: true, shopSlug });
}
