/**
 * Japora vendor-to-vendor referral program. Each vendor gets one stable 8-char
 * referralCode they can share. When a referee signs up with ?ref=CODE the
 * integration agent (signup route) calls recordSignupReferral, then on their
 * first PAID order markQualified upgrades the referral state.
 */

import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { logger } from "./logger";

// Crockford-ish alphabet — drop confusables (0/O, 1/I/L) so referral codes
// are readable when shouted across a market stall.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 8;
const MAX_RETRIES = 6;

function generateCode(): string {
  const buf = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

/**
 * Ensure a vendor has a referralCode. Idempotent — returns the existing code
 * if already set. Retries on the very unlikely collision (8 chars over a
 * 30-char alphabet ≈ 6.5e11 possibilities).
 */
export async function ensureReferralCode(vendorId: string): Promise<string> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { referralCode: true },
  });
  if (!vendor) throw new Error("vendor_not_found");
  if (vendor.referralCode) return vendor.referralCode;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode();
    try {
      const updated = await prisma.vendor.update({
        where: { id: vendorId },
        data: { referralCode: code },
        select: { referralCode: true },
      });
      logger.info("referral.code_minted", { vendorId, code });
      return updated.referralCode as string;
    } catch (err) {
      // Unique constraint collision → try again with a new code.
      const msg = String((err as { message?: string })?.message || "");
      if (!msg.includes("Unique") && !msg.includes("P2002")) throw err;
      logger.warn("referral.code_collision_retry", { vendorId, attempt });
    }
  }
  throw new Error("referral_code_exhausted");
}

/**
 * Record that refereeVendorId signed up with `code`. No-op if the code is
 * unknown, self-referral, or the referee already has a referrer.
 */
export async function recordSignupReferral(refereeVendorId: string, code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;

  const referrer = await prisma.vendor.findUnique({
    where: { referralCode: normalized },
    select: { id: true },
  });
  if (!referrer) {
    logger.warn("referral.unknown_code", { refereeVendorId, code: normalized });
    return null;
  }
  if (referrer.id === refereeVendorId) {
    logger.warn("referral.self_referral_blocked", { vendorId: refereeVendorId });
    return null;
  }

  // Refuse to overwrite an existing claim — Referral.refereeVendorId is
  // unique, but we also pin Vendor.referredByVendorId to keep the join cheap.
  const existing = await prisma.referral.findUnique({
    where: { refereeVendorId },
  });
  if (existing) return existing;

  const [referral] = await prisma.$transaction([
    prisma.referral.create({
      data: {
        referrerVendorId: referrer.id,
        refereeVendorId,
        status: "pending",
      },
    }),
    prisma.vendor.update({
      where: { id: refereeVendorId },
      data: { referredByVendorId: referrer.id },
    }),
  ]);

  logger.info("referral.signup_recorded", {
    referrerVendorId: referrer.id,
    refereeVendorId,
  });
  return referral;
}

/**
 * Move a referral to "qualified" on the referee's first PAID order. Designed
 * to be called from the payment webhook — no-op if no referral row exists
 * or it has already been qualified/rewarded.
 */
export async function markQualified(refereeVendorId: string) {
  const referral = await prisma.referral.findUnique({
    where: { refereeVendorId },
  });
  if (!referral) return null;
  if (referral.status !== "pending") return referral;

  const updated = await prisma.referral.update({
    where: { refereeVendorId },
    data: { status: "qualified" },
  });
  logger.info("referral.qualified", {
    referrerVendorId: updated.referrerVendorId,
    refereeVendorId,
  });
  return updated;
}

/** How many of a vendor's referrals have reached qualified/rewarded. */
export async function rewardCount(vendorId: string): Promise<number> {
  return prisma.referral.count({
    where: {
      referrerVendorId: vendorId,
      status: { in: ["qualified", "rewarded"] },
    },
  });
}

/** Convenience: full referral roster for a vendor, newest first. */
export async function listReferrals(vendorId: string) {
  const rows = await prisma.referral.findMany({
    where: { referrerVendorId: vendorId },
    orderBy: { createdAt: "desc" },
  });
  if (rows.length === 0) return [];

  const refereeIds = rows.map((r) => r.refereeVendorId);
  const referees = await prisma.vendor.findMany({
    where: { id: { in: refereeIds } },
    select: { id: true, shopName: true, email: true, createdAt: true },
  });
  const byId = new Map(referees.map((v) => [v.id, v]));
  return rows.map((r) => ({
    id: r.id,
    status: r.status,
    createdAt: r.createdAt,
    rewardedAt: r.rewardedAt,
    referee: byId.get(r.refereeVendorId) ?? null,
  }));
}
