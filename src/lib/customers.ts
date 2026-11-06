/**
 * Japora CRM — Customer ledger helpers.
 *
 * The Customer model denormalises per-vendor aggregates (orderCount,
 * totalSpentCents, lastOrderAt) so the dashboard list view stays a single
 * indexed scan. `upsertFromOrder` is the one true write-path: it is meant to
 * run inside the order-create transaction so the customer row and the order
 * commit (or roll back) together.
 *
 * Identity is (vendorId, phone) — we deliberately keep the same human across
 * vendors as separate rows so each vendor's notes / spend stay private.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { isValidPhone, normalizePhone } from "./otp";
import { isCustomerVip, VIP_QUALIFYING_ORDER_COUNT } from "./customer-segments";
export { isCustomerVip, VIP_QUALIFYING_ORDER_COUNT } from "./customer-segments";

/** Subset of PrismaClient/Tx that exposes the calls we use. */
type Tx = Prisma.TransactionClient | typeof prisma;

export const REACTIVATION_STALE_DAYS = 30;
export const REACTIVATION_STALE_MS = REACTIVATION_STALE_DAYS * 24 * 60 * 60 * 1000;
export const QUALIFYING_ORDER_STATUSES = ["PAID", "DELIVERED"] as const;
export const VALID_MARKETING_CONSENT_BASES = new Set([
  "manual",
  "checkout",
  "signup",
  "customer_request",
  "replied_yes",
  "dashboard",
  "follower_signup",
]);

export type ReactivationCandidate = {
  marketingConsent?: boolean | null;
  marketingConsentBasis?: string | null;
  marketingConsentRevokedAt?: Date | string | number | null;
  optedOut?: boolean | null;
  qualifyingOrderCount?: number | null;
  orderCount?: number | null;
  totalSpentCents?: number | null;
  lastOrderAt?: Date | string | number | null;
  lastCartAt?: Date | string | number | null;
  lastSeenAt?: Date | string | number | null;
  deletedAt?: Date | string | number | null;
};

function toEpochMillis(value: Date | string | number | null | undefined): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function countQualifyingPurchases(
  orders: Array<{ status?: string | null; deletedAt?: Date | string | number | null }> = [],
): number {
  return orders.filter((order) => {
    if (order.deletedAt) return false;
    return QUALIFYING_ORDER_STATUSES.includes(order.status as (typeof QUALIFYING_ORDER_STATUSES)[number]);
  }).length;
}

export function normalizeCustomerMarketingConsentBasis(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const basis = value.trim();
  if (!basis || basis.length > 255) return null;
  const normalized = basis.toLowerCase();
  return VALID_MARKETING_CONSENT_BASES.has(normalized) ? normalized : null;
}

export function customerMarketingConsentGranted(candidate: Pick<ReactivationCandidate, "marketingConsent" | "marketingConsentRevokedAt" | "optedOut"> = {}): boolean {
  if (candidate.marketingConsent !== true) return false;
  if (candidate.optedOut === true) return false;
  if (candidate.marketingConsentRevokedAt != null) return false;
  return true;
}

export async function resolveCustomerForCartSession(
  tx: Tx,
  vendorId: string,
  sessionId: string,
  input: { customerId?: string | null; customerPhone?: string | null } = {},
): Promise<{
  customerId: string;
  customerPhone: string;
  customerName: string;
  marketingConsent: boolean | null;
  marketingConsentRevokedAt: Date | string | number | null;
} | null> {
  const cleanSessionId = (sessionId || "").trim();
  if (!cleanSessionId) return null;

  const candidateId = typeof input.customerId === "string" ? input.customerId.trim() : "";
  const candidatePhone = typeof input.customerPhone === "string" ? normalizePhone(input.customerPhone) : "";

  let customer = null;
  if (candidateId) {
    customer = await tx.customer.findFirst({
      where: { id: candidateId, vendorId, deletedAt: null },
      select: {
        id: true,
        name: true,
        phone: true,
        marketingConsent: true,
        marketingConsentRevokedAt: true,
      },
    });
  }

  if (!customer && candidatePhone && isValidPhone(candidatePhone)) {
    customer = await tx.customer.findUnique({
      where: { vendorId_phone: { vendorId, phone: candidatePhone } },
      select: {
        id: true,
        name: true,
        phone: true,
        marketingConsent: true,
        marketingConsentRevokedAt: true,
      },
    });
  }

  if (!customer) {
    const tracked = await tx.funnelEvent.findFirst({
      where: {
        vendorId,
        sessionId: cleanSessionId,
        stage: "cart",
      },
      orderBy: { createdAt: "desc" },
      select: { customerId: true, customerPhone: true },
    });

    if (tracked?.customerId) {
      customer = await tx.customer.findFirst({
        where: { id: tracked.customerId, vendorId, deletedAt: null },
        select: {
          id: true,
          name: true,
          phone: true,
          marketingConsent: true,
          marketingConsentRevokedAt: true,
        },
      });
    } else if (tracked?.customerPhone && isValidPhone(tracked.customerPhone)) {
      customer = await tx.customer.findUnique({
        where: { vendorId_phone: { vendorId, phone: tracked.customerPhone } },
        select: {
          id: true,
          name: true,
          phone: true,
          marketingConsent: true,
          marketingConsentRevokedAt: true,
        },
      });
    }
  }

  if (!customer || !customer.phone || !isValidPhone(customer.phone)) return null;

  return {
    customerId: customer.id,
    customerPhone: customer.phone,
    customerName: customer.name || "Customer",
    marketingConsent: customer.marketingConsent ?? null,
    marketingConsentRevokedAt: customer.marketingConsentRevokedAt ?? null,
  };
}

export async function linkCartSessionToCustomer(
  tx: Tx,
  vendorId: string,
  sessionId: string,
  input: { customerId?: string | null; customerPhone?: string | null } = {},
): Promise<{ customerId: string; customerPhone: string } | null> {
  const cleanSessionId = (sessionId || "").trim();
  if (!cleanSessionId) return null;

  const identity = await resolveCustomerForCartSession(tx, vendorId, cleanSessionId, input);
  if (!identity) return null;

  const cartEvent = await tx.funnelEvent.findFirst({
    where: { vendorId, sessionId: cleanSessionId, stage: "cart" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });

  if (cartEvent) {
    await tx.funnelEvent.update({
      where: { id: cartEvent.id },
      data: {
        customerId: identity.customerId,
        customerPhone: identity.customerPhone,
      },
    });
  }

  return {
    customerId: identity.customerId,
    customerPhone: identity.customerPhone,
  };
}

export async function setCustomerMarketingConsent(
  tx: Tx,
  vendorId: string,
  customerId: string,
  input: { marketingConsent: boolean; marketingConsentBasis?: string | null; now?: Date | string | number },
): Promise<Awaited<ReturnType<typeof prisma.customer.update>>> {
  if (typeof input.marketingConsent !== "boolean") {
    throw new Error("marketingConsent must be boolean");
  }

  const customer = await tx.customer.findFirst({
    where: { id: customerId, vendorId, deletedAt: null },
  });
  if (!customer) throw new Error("customer_not_found");

  const basis = input.marketingConsent
    ? normalizeCustomerMarketingConsentBasis(input.marketingConsentBasis ?? customer.marketingConsentBasis ?? "manual")
    : normalizeCustomerMarketingConsentBasis(input.marketingConsentBasis ?? customer.marketingConsentBasis ?? "manual") ?? "manual";

  if (input.marketingConsent && !basis) {
    throw new Error("valid_consent_basis_required");
  }

  const now = input.now ? new Date(input.now) : new Date();
  const update = await tx.customer.update({
    where: { id: customerId },
    data: {
      marketingConsent: input.marketingConsent,
      marketingConsentBasis: basis,
      marketingConsentAt: input.marketingConsent ? now : customer.marketingConsentAt ?? null,
      marketingConsentRevokedAt: input.marketingConsent ? null : now,
    },
  });

  return update;
}

export function customerReactivationEligibility(
  candidate: ReactivationCandidate = {},
  now: Date | number = Date.now(),
): boolean {
  if (candidate.deletedAt) return false;
  if (!customerMarketingConsentGranted(candidate)) return false;

  const referenceTime = toEpochMillis(now) ?? Date.now();
  const lastOrderAt = toEpochMillis(candidate.lastOrderAt);
  const lastCartAt = toEpochMillis(candidate.lastCartAt);
  const lastSeenAt = toEpochMillis(candidate.lastSeenAt);
  const lastActivity = [lastOrderAt, lastCartAt, lastSeenAt]
    .filter((value): value is number => value != null)
    .sort((a, b) => b - a)[0];

  if (lastActivity == null) return false;
  return referenceTime - lastActivity >= REACTIVATION_STALE_MS;
}

export const isCustomerEligibleForReactivation = customerReactivationEligibility;
export const isReactivationEligible = customerReactivationEligibility;

export type UpsertFromOrderInput = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  totalCents: number;
};

/**
 * Upsert a customer record from an incoming order. Returns the customer id,
 * or null when the order has no phone (we use phone as the dedup key).
 *
 * Must be called inside the same transaction as the order create so the
 * aggregates stay consistent under concurrent checkouts.
 */
export async function upsertFromOrder(
  tx: Tx,
  vendorId: string,
  { customerName, customerPhone, customerEmail, totalCents }: UpsertFromOrderInput,
): Promise<string | null> {
  const phone = (customerPhone || "").trim();
  if (!phone) return null;

  const name = (customerName || "").trim() || "Customer";
  const email = (customerEmail || "").trim() || undefined;
  const spend = Math.max(0, Math.floor(totalCents || 0));
  const now = new Date();

  const existing = await tx.customer.findUnique({
    where: { vendorId_phone: { vendorId, phone } },
  });

  if (existing) {
    await tx.customer.update({
      where: { id: existing.id },
      data: {
        // Keep the freshest name we saw, but never wipe to blank.
        name: name || existing.name,
        email: email || existing.email,
        orderCount: { increment: 1 },
        totalSpentCents: { increment: spend },
        lastOrderAt: now,
      },
    });
    return existing.id;
  }

  const created = await tx.customer.create({
    data: {
      vendorId,
      name,
      phone,
      email: email || null,
      orderCount: 1,
      totalSpentCents: spend,
      lastOrderAt: now,
    },
  });
  return created.id;
}

export type ListForVendorOpts = {
  q?: string;
  page?: number;
  pageSize?: number;
};

export type CustomerListPage = {
  customers: Awaited<ReturnType<typeof prisma.customer.findMany>>;
  total: number;
  page: number;
  pageSize: number;
};

/**
 * Paginated vendor-scoped customer list, freshest-touched first. Search `q`
 * matches name / phone / email substrings.
 */
export async function listForVendor(
  vendorId: string,
  { q, page = 1, pageSize = 50 }: ListForVendorOpts = {},
): Promise<CustomerListPage> {
  const safePage = Math.max(1, page);
  const safeSize = Math.min(200, Math.max(1, pageSize));
  const term = (q || "").trim();

  // PostgreSQL distingue les majuscules, SQLite non ; `mode` n'existe que sur PostgreSQL.
  const caseInsensitive = process.env.DATABASE_URL?.startsWith("postgres")
    ? { mode: "insensitive" as const }
    : {};

  const where: Prisma.CustomerWhereInput = {
    vendorId,
    deletedAt: null,
    ...(term
      ? {
          OR: [
            { name: { contains: term, ...caseInsensitive } },
            { phone: { contains: term, ...caseInsensitive } },
            { email: { contains: term, ...caseInsensitive } },
          ],
        }

      : {}),
  };

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: [{ lastOrderAt: "desc" }, { createdAt: "desc" }],
      skip: (safePage - 1) * safeSize,
      take: safeSize,
    }),
    prisma.customer.count({ where }),
  ]);

  return { customers, total, page: safePage, pageSize: safeSize };
}

/** Counts only orders that qualify for the broadcast VIP segment. */
export async function qualifyingOrderCountsForCustomers(
  vendorId: string,
  customerIds: string[],
): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();
  const rows = await prisma.order.groupBy({
    by: ["customerId"],
    where: {
      vendorId,
      customerId: { in: customerIds },
      deletedAt: null,
      status: { in: [...QUALIFYING_ORDER_STATUSES] },
    },
    _count: { _all: true },
  });
  return new Map(rows.flatMap((row) => row.customerId ? [[row.customerId, row._count._all] as const] : []));
}
