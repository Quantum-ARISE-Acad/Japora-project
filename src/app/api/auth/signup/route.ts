import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, validateEmail, validatePassword } from "@/lib/auth";
import { createSession } from "@/lib/session";
import { setUnifiedCookie } from "@/lib/unified-auth";
import { slugify } from "@/lib/utils";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import { logger } from "@/lib/logger";
import { issueVerificationEmail } from "@/lib/verification";
import { sendEmail } from "@/lib/email";
import { welcomeEmail } from "@/lib/email-templates";
import { appUrl } from "@/lib/token";
import { newVendorTrialDates } from "@/lib/billing";
import { ensureReferralCode, recordSignupReferral } from "@/lib/referral";
import { joinByCode } from "@/lib/cooperative";
import { recordVendorActivity, type VendorAccountProfile } from "@/lib/clerk-vendor-sync";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const rl = rateLimit({ key: `signup:${ip}`, limit: 3, windowMs: 60 * 60_000 });
  if (!rl.allowed) {
    logger.warn("auth.signup.rate_limited", { ip });
    return tooManyRequests(rl, "Too many signups from this network. Try again later.");
  }

  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const ownerName = String(body.name || "").trim();
  const shopName = String(body.shopName || ownerName || "").trim();
  const whatsappNumber = String(body.whatsappNumber || "").replace(/[^0-9]/g, "");
  const momoNumber = String(body.momoNumber || whatsappNumber || "").replace(/[^0-9]/g, "");
  const currency = String(body.currency || "XOF").trim().toUpperCase().slice(0, 3) || "XOF";
  const language = String(body.language || "fr").trim() || "fr";
  const category = String(body.category || "fashion").trim() || "fashion";
  const region = String(body.region || "lome").trim() || "lome";
  const clerkId = typeof body.clerkId === "string" && body.clerkId.trim() ? body.clerkId.trim() : undefined;

  if (!validateEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  const pwCheck = validatePassword(password);
  if (!pwCheck.ok) {
    return NextResponse.json({ error: pwCheck.reason }, { status: 400 });
  }
  if (!shopName) {
    return NextResponse.json({ error: "Enter your shop name." }, { status: 400 });
  }

  const existing = await prisma.vendor.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
  }

  // Derive a unique catalog slug from the shop name.
  const base = slugify(shopName);
  let shopSlug = base;
  let n = 1;
  while (await prisma.vendor.findUnique({ where: { shopSlug } })) {
    shopSlug = `${base}-${n++}`;
  }

  const now = new Date();
  const initialProfile: VendorAccountProfile = {
    ownerName: ownerName || shopName,
    email,
    clerkId,
    authProvider: clerkId ? "clerk_email" : "local",
    lastLoginAt: now.toISOString(),
    loginCount: 1,
    createdAt: now.toISOString(),
  };

  const vendor = await prisma.vendor.create({
    data: {
      ...(clerkId ? { clerkId } : {}),
      email,
      passwordHash: await hashPassword(password),
      shopName,
      shopSlug,
      whatsappNumber: whatsappNumber || "15556449932",
      momoNumber,
      currency,
      language,
      category,
      region,
      emailVerifiedAt: now,
      onboardedAt: now,
      uiPrefs: {
        accountProfile: initialProfile,
        shopTheme: "arctic",
      } as never,
      ...newVendorTrialDates(),
    },
  });

  await recordVendorActivity({
    vendorId: vendor.id,
    type: "auth.account.created",
    subjectType: "vendor",
    subjectId: vendor.id,
    data: {
      email: vendor.email,
      ownerName: initialProfile.ownerName,
      shopName: vendor.shopName,
      shopSlug: vendor.shopSlug,
      currency: vendor.currency,
      language: vendor.language,
      category: vendor.category,
      region: vendor.region,
    },
  });

  await createSession({ vendorId: vendor.id, email: vendor.email });
  await setUnifiedCookie({
    sub: vendor.email,
    email: vendor.email,
    name: vendor.shopName,
    role: "VENDOR",
    originApp: "japora",
  });
  logger.info("auth.signup.success", { vendorId: vendor.id, shopSlug });

  // Mint a stable vendor referral code so settings can render the share link
  // on first visit. Idempotent — safe if it already exists.
  try {
    await ensureReferralCode(vendor.id);
  } catch (e) {
    logger.error("auth.signup.referral_code_failed", { vendorId: vendor.id, error: String(e) });
  }

  // Honour ?ref=CODE / body.ref attribution. Self-referrals + unknown codes
  // are no-ops inside recordSignupReferral.
  const refCode =
    req.nextUrl.searchParams.get("ref") ||
    (typeof body.ref === "string" ? body.ref : "") ||
    "";
  if (refCode) {
    try {
      await recordSignupReferral(vendor.id, refCode);
      logger.info("auth.signup.referral_recorded", { vendorId: vendor.id, refCode });
    } catch (e) {
      logger.error("auth.signup.referral_failed", {
        vendorId: vendor.id,
        refCode,
        error: String(e),
      });
    }
  }

  // Cooperative capture (?coop=CODE / body.coop) — onboard straight into a
  // market association if they arrived from a /join link.
  const coopCode =
    req.nextUrl.searchParams.get("coop") ||
    (typeof body.coop === "string" ? body.coop : "") ||
    "";
  if (coopCode) {
    try {
      await joinByCode(vendor.id, coopCode);
      logger.info("auth.signup.coop_joined", { vendorId: vendor.id, coopCode });
    } catch (e) {
      logger.warn("auth.signup.coop_failed", { vendorId: vendor.id, error: String(e) });
    }
  }

  // Fire-and-forget welcome + verification emails. We don't await these so
  // signup stays snappy; the email layer persists records so failures are
  // observable in the EmailMessage table.
  Promise.all([
    issueVerificationEmail(vendor),
    (async () => {
      const rendered = welcomeEmail({
        shopName: vendor.shopName,
        catalogUrl: appUrl(`/c/${vendor.shopSlug}`),
      });
      await sendEmail({
        vendorId: vendor.id,
        to: vendor.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        template: "welcome",
      });
    })(),
  ]).catch((e) => logger.error("auth.signup.email_failed", { error: String(e) }));

  return NextResponse.json({ ok: true, shopSlug: vendor.shopSlug });
}
