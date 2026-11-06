/**
 * Japora "verified shop" trust signal.
 *
 * Informal commerce runs on trust, and a brand-new catalog link looks the same
 * as a scam. A verified badge gives buyers a cheap, honest signal. We grant it
 * on objective criteria a fraudster can't fake cheaply:
 *   - the vendor's WhatsApp number is verified (OTP), and
 *   - they've fulfilled a threshold of real PAID orders.
 *
 * This is Japora's own badge — distinct from (and a stepping stone to) Meta
 * Verified. Granting is idempotent and can be re-run any time (payment webhook,
 * settings load). Manual approval is just setting verifiedAt directly.
 */

import { prisma } from "./db";
import { logger } from "./logger";

export const VERIFY_MIN_PAID_ORDERS = 3;

export type VerificationProgress = {
  verified: boolean;
  verifiedAt: Date | null;
  phoneVerified: boolean;
  paidOrders: number;
  paidOrdersNeeded: number;
};

async function countPaidOrders(vendorId: string): Promise<number> {
  return prisma.order.count({
    where: { vendorId, deletedAt: null, status: { in: ["PAID", "DELIVERED"] } },
  });
}

/** Whether a vendor currently clears the auto-verification criteria. */
export async function meetsCriteria(vendorId: string): Promise<boolean> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { phoneVerifiedAt: true },
  });
  if (!vendor?.phoneVerifiedAt) return false;
  const paid = await countPaidOrders(vendorId);
  return paid >= VERIFY_MIN_PAID_ORDERS;
}

/**
 * Grant the badge if criteria are met and it isn't already set. Returns true if
 * it newly granted. Safe to call repeatedly.
 */
export async function evaluateAndGrant(vendorId: string): Promise<boolean> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { verifiedAt: true },
  });
  if (!vendor) return false;
  if (vendor.verifiedAt) return false;
  if (!(await meetsCriteria(vendorId))) return false;

  await prisma.vendor.update({ where: { id: vendorId }, data: { verifiedAt: new Date() } });
  logger.info("trust.verified", { vendorId });
  return true;
}

/** Progress view for the settings card. */
export async function verificationProgress(vendorId: string): Promise<VerificationProgress> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { verifiedAt: true, phoneVerifiedAt: true },
  });
  const paid = await countPaidOrders(vendorId);
  return {
    verified: Boolean(vendor?.verifiedAt),
    verifiedAt: vendor?.verifiedAt ?? null,
    phoneVerified: Boolean(vendor?.phoneVerifiedAt),
    paidOrders: paid,
    paidOrdersNeeded: Math.max(0, VERIFY_MIN_PAID_ORDERS - paid),
  };
}
