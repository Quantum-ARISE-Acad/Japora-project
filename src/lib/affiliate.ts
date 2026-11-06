/**
 * Japora affiliate program — vendors mint codes for influencers / resellers.
 * Attribution is recorded per order, idempotent on orderId so re-running a
 * webhook does not double-count commission. Commission percentages are
 * stored on the Affiliate row so a vendor can rate-tier different partners.
 */

import { prisma } from "./db";
import { logger } from "./logger";

const CODE_RE = /^[A-Z0-9_-]{3,32}$/;

/** Normalises raw input → uppercase / trimmed / no whitespace. */
export function normalizeCode(raw: string): string {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function isValidCode(code: string): boolean {
  return CODE_RE.test(code);
}

/** Clamp commission pct to a sensible 0..0.5 range (50% max). */
export function clampPct(pct: number): number {
  if (!Number.isFinite(pct)) return 0.1;
  if (pct < 0) return 0;
  if (pct > 0.5) return 0.5;
  return pct;
}

export type CreateAffiliateInput = {
  code: string;
  name: string;
  commissionPct: number;
};

/**
 * Create a new affiliate code for a vendor. Code uniqueness is global
 * (DB-level), so duplicates surface a thrown Error("code_taken").
 */
export async function createAffiliate(
  vendorId: string,
  { code, name, commissionPct }: CreateAffiliateInput,
) {
  const normalized = normalizeCode(code);
  if (!isValidCode(normalized)) throw new Error("invalid_code");
  const cleanName = String(name || "").trim();
  if (!cleanName) throw new Error("invalid_name");

  const existing = await prisma.affiliate.findUnique({ where: { code: normalized } });
  if (existing) throw new Error("code_taken");

  const affiliate = await prisma.affiliate.create({
    data: {
      vendorId,
      code: normalized,
      name: cleanName,
      commissionPct: clampPct(commissionPct),
    },
  });
  logger.info("affiliate.created", { vendorId, affiliateId: affiliate.id, code: normalized });
  return affiliate;
}

/**
 * List vendor's affiliates with aggregated attribution totals. The sum is
 * computed in-app from a single groupBy so we do not need a stored counter
 * to stay accurate (Affiliate.totalEarnedCents is a cache, not source of
 * truth).
 */
export async function listForVendor(vendorId: string) {
  const affiliates = await prisma.affiliate.findMany({
    where: { vendorId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (affiliates.length === 0) return [];

  const ids = affiliates.map((a) => a.id);
  const groups = await prisma.affiliateAttribution.groupBy({
    by: ["affiliateId"],
    where: { affiliateId: { in: ids } },
    _sum: { commissionCents: true },
    _count: { _all: true },
  });
  const byId = new Map<string, { totalCents: number; orderCount: number }>();
  for (const g of groups) {
    byId.set(g.affiliateId, {
      totalCents: g._sum.commissionCents ?? 0,
      orderCount: g._count._all ?? 0,
    });
  }
  return affiliates.map((a) => ({
    ...a,
    sumCommissionCents: byId.get(a.id)?.totalCents ?? 0,
    attributionCount: byId.get(a.id)?.orderCount ?? 0,
  }));
}

export async function findByCode(code: string) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return prisma.affiliate.findFirst({
    where: { code: normalized, deletedAt: null },
  });
}

/**
 * Idempotent attribution: if a row already exists for the orderId we skip
 * the write and return the existing record. Otherwise we compute
 * commissionCents from the order total and the affiliate's stored pct, then
 * bump the cached total on the Affiliate row in a transaction.
 */
export async function recordAttribution(orderId: string, affiliateCode: string) {
  const code = normalizeCode(affiliateCode);
  if (!orderId || !code) return null;

  const existing = await prisma.affiliateAttribution.findFirst({ where: { orderId } });
  if (existing) return existing;

  const affiliate = await findByCode(code);
  if (!affiliate) {
    logger.warn("affiliate.attribution_skipped_unknown_code", { orderId, code });
    return null;
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    logger.warn("affiliate.attribution_skipped_unknown_order", { orderId });
    return null;
  }

  const commissionCents = Math.max(
    0,
    Math.floor((order.totalCents ?? 0) * clampPct(affiliate.commissionPct)),
  );

  const [attribution] = await prisma.$transaction([
    prisma.affiliateAttribution.create({
      data: {
        orderId,
        affiliateId: affiliate.id,
        commissionCents,
        status: "pending",
      },
    }),
    prisma.affiliate.update({
      where: { id: affiliate.id },
      data: { totalEarnedCents: { increment: commissionCents } },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { affiliateId: affiliate.id },
    }),
  ]);

  logger.info("affiliate.attribution_recorded", {
    orderId,
    affiliateId: affiliate.id,
    commissionCents,
  });
  return attribution;
}
