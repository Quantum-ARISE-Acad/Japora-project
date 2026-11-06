/**
 * Japora bulk WhatsApp broadcasts.
 *
 * A broadcast targets a segment of the vendor's Customer ledger. Recipients
 * are resolved at *send* time (not at draft time) so that any customers that
 * landed in the ledger between draft and dispatch still get the message.
 *
 * Sends are throttled (200 ms between recipients) so we don't get aggressively
 * rate-limited by the underlying WhatsApp provider — the Cloud API will start
 * 429-ing if you hammer it from one phone-number-id. Per-recipient errors are
 * swallowed and logged so a single bad number doesn't abort the whole blast.
 */
import { prisma } from "./db";
import { logger } from "./logger";
import { sendWhatsApp } from "./whatsapp";
import { freeBroadcastRecipientsPerMonth } from "./billing";
import {
  isCustomerVip,
  QUALIFYING_ORDER_STATUSES,
  customerReactivationEligibility,
} from "./customers";
import { isValidPhone, normalizePhone } from "./otp";

export const SEGMENTS = [
  "all",
  "recent",
  "unpaid",
  "wholesale",
  "vip",
  "inactive",
  "reactivation",
] as const;
export type BroadcastSegment = (typeof SEGMENTS)[number];

/* ----------------------- Monthly broadcast quota -------------------------- */

function monthStart(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** Marketing recipients this vendor has already blasted this calendar month. */
export async function broadcastRecipientsUsedThisMonth(vendorId: string): Promise<number> {
  const agg = await prisma.broadcast.aggregate({
    _sum: { sentCount: true },
    where: { vendorId, status: "sent", createdAt: { gte: monthStart() } },
  });
  return agg._sum.sentCount ?? 0;
}

export type BroadcastQuota = {
  allowed: boolean;
  used: number;
  remaining: number;
  cap: number;
  requested: number;
};

/**
 * Can this vendor send a blast of `requested` recipients now? Free vendors get
 * a monthly allowance (then it's Pro/vendor-funded); active subscribers bypass.
 */
export async function checkBroadcastQuota(
  vendorId: string,
  requested: number,
  bypass = false,
): Promise<BroadcastQuota> {
  const cap = freeBroadcastRecipientsPerMonth();
  const used = await broadcastRecipientsUsedThisMonth(vendorId);
  const remaining = Math.max(0, cap - used);
  return { allowed: bypass || requested <= remaining, used, remaining, cap, requested };
}

export function isSegment(value: string): value is BroadcastSegment {
  return (SEGMENTS as readonly string[]).includes(value);
}

const THROTTLE_MS = 200;

type Recipient = {
  id: string;
  name: string;
  phone: string;
};

export function personalizeBroadcastMessage(
  body: string,
  values: { name?: string | null; store?: string | null; product?: string | null },
): string {
  return body.replace(/\{\{\s*(name|store|product)\s*\}\}/gi, (_match, key: string) => {
    const value = values[key.toLowerCase() as keyof typeof values];
    return value?.trim() || "";
  }).replace(/[ \t]{2,}/g, " ").trim();
}

/**
 * Resolve the customer set for a segment.
 *   - all:       every customer (live ledger entries only)
 *   - recent:    lastOrderAt within the last 30 days
 *   - unpaid:    customers linked to at least one OPEN receivable
 *   - wholesale: customers whose orders include `isWholesale: true`
 */
export async function segmentRecipients(
  vendorId: string,
  segment: BroadcastSegment,
): Promise<Recipient[]> {
  if (segment === "all") {
    const rows = await prisma.customer.findMany({
      where: { vendorId, deletedAt: null, phone: { not: "" } },
      select: { id: true, name: true, phone: true },
    });
    return rows;
  }

  if (segment === "vip") {
    const customers = await prisma.customer.findMany({
      where: { vendorId, deletedAt: null, phone: { not: "" } },
      select: {
        id: true, name: true, phone: true, orderCount: true,
        orders: {
          where: { vendorId, deletedAt: null, status: { in: [...QUALIFYING_ORDER_STATUSES] } },
          select: { id: true },
        },
      },
    });
    return customers
      .filter((c) => isValidPhone(c.phone) && isCustomerVip({ qualifyingOrderCount: c.orders.length, orderCount: c.orderCount }))
      .map((c) => ({ id: c.id, name: c.name, phone: normalizePhone(c.phone) }));
  }

  if (segment === "inactive" || segment === "reactivation") {
    const customers = await prisma.customer.findMany({
      where: { vendorId, deletedAt: null, phone: { not: "" }, marketingConsent: true, marketingConsentRevokedAt: null },
      select: {
        id: true, name: true, phone: true, marketingConsent: true,
        marketingConsentRevokedAt: true, deletedAt: true, lastOrderAt: true,
        funnelEvents: { where: { vendorId }, orderBy: { createdAt: "desc" }, take: 1, select: { createdAt: true } },
      },
    });
    const now = Date.now();
    return customers
      .filter((c) => isValidPhone(c.phone) && customerReactivationEligibility({
        marketingConsent: c.marketingConsent,
        marketingConsentRevokedAt: c.marketingConsentRevokedAt,
        deletedAt: c.deletedAt,
        lastOrderAt: c.lastOrderAt,
        lastCartAt: c.funnelEvents[0]?.createdAt ?? null,
      }, now))
      .map((c) => ({ id: c.id, name: c.name, phone: normalizePhone(c.phone) }));
  }

  if (segment === "recent") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.customer.findMany({
      where: {
        vendorId,
        deletedAt: null,
        phone: { not: "" },
        lastOrderAt: { gte: thirtyDaysAgo },
      },
      select: { id: true, name: true, phone: true },
    });
    return rows;
  }

  if (segment === "unpaid") {
    const openReceivables = await prisma.receivable.findMany({
      where: { vendorId, status: "OPEN", customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    const ids = openReceivables
      .map((r) => r.customerId)
      .filter((v): v is string => Boolean(v));
    if (ids.length === 0) return [];
    const rows = await prisma.customer.findMany({
      where: { id: { in: ids }, deletedAt: null, phone: { not: "" } },
      select: { id: true, name: true, phone: true },
    });
    return rows;
  }

  // wholesale
  const wholesaleOrders = await prisma.order.findMany({
    where: {
      vendorId,
      isWholesale: true,
      deletedAt: null,
      customerId: { not: null },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  const ids = wholesaleOrders
    .map((o) => o.customerId)
    .filter((v): v is string => Boolean(v));
  if (ids.length === 0) return [];
  const rows = await prisma.customer.findMany({
    where: { id: { in: ids }, deletedAt: null, phone: { not: "" } },
    select: { id: true, name: true, phone: true },
  });
  return rows;
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

/**
 * Resolve recipients, fan out one WhatsApp per recipient, and update the
 * Broadcast row as we go (`sentCount` ticks up for every successful send so
 * the dashboard's poll-while-sending can show a live progress count).
 *
 * Designed to be called fire-and-forget from the send API route. We capture
 * and log any per-recipient failures rather than throwing them up — the
 * broadcast as a whole is considered "sent" unless *every* send failed.
 */
export async function dispatchBroadcast(broadcastId: string): Promise<void> {
  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
  });
  if (!broadcast) {
    logger.warn("broadcast.dispatch_missing", { broadcastId });
    return;
  }
  if (broadcast.status === "sending" || broadcast.status === "sent" || broadcast.status === "stubbed") {
    logger.info("broadcast.dispatch_skipped", {
      broadcastId,
      status: broadcast.status,
    });
    return;
  }

  if (!isSegment(broadcast.segment)) {
    logger.warn("broadcast.invalid_segment", {
      broadcastId,
      segment: broadcast.segment,
    });
    await prisma.broadcast.update({
      where: { id: broadcastId },
      data: { status: "failed" },
    });
    return;
  }

  const recipients = await segmentRecipients(broadcast.vendorId, broadcast.segment);

  // Monthly free-broadcast quota — block the blast if it would exceed the
  // vendor's remaining allowance (active subscribers bypass).
  const vendor = await prisma.vendor.findUnique({
    where: { id: broadcast.vendorId },
    select: { subscriptionStatus: true, shopName: true },
  });
  const quota = await checkBroadcastQuota(
    broadcast.vendorId,
    recipients.length,
    vendor?.subscriptionStatus === "active",
  );
  if (!quota.allowed) {
    logger.warn("broadcast.quota_exceeded", {
      broadcastId,
      vendorId: broadcast.vendorId,
      requested: recipients.length,
      used: quota.used,
      cap: quota.cap,
    });
    await prisma.broadcast.update({ where: { id: broadcastId }, data: { status: "failed" } });
    return;
  }

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: { status: "sending", sentCount: 0 },
  });

  logger.info("broadcast.dispatch_start", {
    broadcastId,
    vendorId: broadcast.vendorId,
    segment: broadcast.segment,
    recipientCount: recipients.length,
  });

  let sent = 0;
  let failed = 0;
  let stubbed = 0;

  for (const recipient of recipients) {
    try {
      const result = await sendWhatsApp({
        vendorId: broadcast.vendorId,
        to: recipient.phone,
        body: personalizeBroadcastMessage(broadcast.body, {
          name: recipient.name,
          store: vendor?.shopName,
          // Broadcast has no selected product field. Don't guess from a
          // multi-recipient audience's order history; missing product tokens
          // intentionally render as empty until the vendor defines one.
        }),
      });
      if (result.status === "failed") {
        failed++;
        logger.warn("broadcast.recipient_failed", {
          broadcastId,
          customerId: recipient.id,
          error: result.error,
        });
      } else {
        sent++;
        if (result.status === "stubbed") stubbed++;
        await prisma.broadcast.update({
          where: { id: broadcastId },
          data: { sentCount: sent },
        });
      }
    } catch (e) {
      failed++;
      logger.error("broadcast.recipient_error", {
        broadcastId,
        customerId: recipient.id,
        error: e instanceof Error ? e.message : String(e),
      });
    }
    await sleep(THROTTLE_MS);
  }

  const finalStatus =
    recipients.length === 0
      ? "sent"
      : failed === recipients.length
        ? "failed"
        : stubbed === sent
          ? "stubbed"
          : "sent";

  await prisma.broadcast.update({
    where: { id: broadcastId },
    data: {
      status: finalStatus,
      sentCount: sent,
      targetCount: recipients.length,
      sentAt: new Date(),
    },
  });

  logger.info("broadcast.dispatch_complete", {
    broadcastId,
    status: finalStatus,
    sent,
    failed,
    stubbed,
    total: recipients.length,
  });
}
