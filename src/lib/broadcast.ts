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
import { sendWhatsApp, sendWhatsAppTemplate } from "./whatsapp";
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
  const [completed, active] = await Promise.all([prisma.broadcast.aggregate({
    _sum: { sentCount: true },
    where: { vendorId, status: { in: ["sent", "partial"] }, createdAt: { gte: monthStart() } },
  }), prisma.broadcast.aggregate({
    _sum: { targetCount: true },
    where: { vendorId, status: { in: ["queued", "sending", "attention"] }, createdAt: { gte: monthStart() } },
  })]);
  return (completed._sum.sentCount ?? 0) + (active._sum.targetCount ?? 0);
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
      where: {
        vendorId, deletedAt: null, phone: { not: "" },
        marketingConsent: true, marketingConsentRevokedAt: null,
      },
      select: { id: true, name: true, phone: true },
    });
    return rows
      .filter((c) => isValidPhone(c.phone))
      .map((c) => ({ ...c, phone: normalizePhone(c.phone) }));
  }

  if (segment === "vip") {
    const customers = await prisma.customer.findMany({
      where: {
        vendorId, deletedAt: null, phone: { not: "" },
        marketingConsent: true, marketingConsentRevokedAt: null,
      },
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
      .filter((c) => {
        if (!isValidPhone(c.phone)) return false;
        const candidate = {
        marketingConsent: c.marketingConsent,
        marketingConsentRevokedAt: c.marketingConsentRevokedAt,
        deletedAt: c.deletedAt,
        lastOrderAt: c.lastOrderAt,
        lastCartAt: c.funnelEvents[0]?.createdAt ?? null,
        };
        if (!customerReactivationEligibility(candidate, now)) return false;
        const lastActivity = Math.max(
          c.lastOrderAt?.getTime() ?? 0,
          c.funnelEvents[0]?.createdAt.getTime() ?? 0,
        );
        const age = now - lastActivity;
        return segment === "inactive" ? age < 90 * 24 * 60 * 60 * 1000 : age >= 90 * 24 * 60 * 60 * 1000;
      })
      .map((c) => ({ id: c.id, name: c.name, phone: normalizePhone(c.phone) }));
  }

  if (segment === "recent") {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const rows = await prisma.customer.findMany({
      where: {
        vendorId,
        deletedAt: null,
        phone: { not: "" },
        marketingConsent: true,
        marketingConsentRevokedAt: null,
        lastOrderAt: { gte: thirtyDaysAgo },
      },
      select: { id: true, name: true, phone: true },
    });
    return rows
      .filter((c) => isValidPhone(c.phone))
      .map((c) => ({ ...c, phone: normalizePhone(c.phone) }));
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
      where: {
        id: { in: ids }, vendorId, deletedAt: null, phone: { not: "" },
        marketingConsent: true, marketingConsentRevokedAt: null,
      },
      select: { id: true, name: true, phone: true },
    });
    return rows
      .filter((c) => isValidPhone(c.phone))
      .map((c) => ({ ...c, phone: normalizePhone(c.phone) }));
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
    where: {
      id: { in: ids }, vendorId, deletedAt: null, phone: { not: "" },
      marketingConsent: true, marketingConsentRevokedAt: null,
    },
    select: { id: true, name: true, phone: true },
  });
  return rows
    .filter((c) => isValidPhone(c.phone))
    .map((c) => ({ ...c, phone: normalizePhone(c.phone) }));
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const CLAIM_STALE_MS = 15 * 60_000;
const QUEUE_BATCH_SIZE = 20;

export type QueueBroadcastResult =
  | { ok: true; targetCount: number }
  | { ok: false; reason: "not_found" | "already_started" | "no_recipients" | "quota_exceeded" | "invalid_template" };

/** Snapshot the audience and atomically turn a draft into durable queue rows. */
export async function queueBroadcast(vendorId: string, broadcastId: string): Promise<QueueBroadcastResult> {
  const broadcast = await prisma.broadcast.findFirst({ where: { id: broadcastId, vendorId } });
  if (!broadcast) return { ok: false, reason: "not_found" };
  if (broadcast.status !== "draft") return { ok: false, reason: "already_started" };
  if (!isSegment(broadcast.segment)) {
    await prisma.broadcast.updateMany({ where: { id: broadcastId, vendorId, status: "draft" }, data: { status: "failed" } });
    return { ok: false, reason: "invalid_template" };
  }
  if (broadcast.messageMode === "template" && (!broadcast.templateName || !broadcast.templateLanguage)) {
    return { ok: false, reason: "invalid_template" };
  }

  const recipients = await segmentRecipients(vendorId, broadcast.segment);
  if (!recipients.length) return { ok: false, reason: "no_recipients" };
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { subscriptionStatus: true } });

  return prisma.$transaction(async (tx) => {
    const activeSubscriber = vendor?.subscriptionStatus === "active";
    if (!activeSubscriber) {
      const start = monthStart();
      const [completed, reserved] = await Promise.all([
        tx.broadcast.aggregate({ _sum: { sentCount: true }, where: { vendorId, status: { in: ["sent", "partial"] }, createdAt: { gte: start } } }),
        tx.broadcast.aggregate({ _sum: { targetCount: true }, where: { vendorId, status: { in: ["queued", "sending", "attention"] }, createdAt: { gte: start } } }),
      ]);
      const requested = recipients.length;
      const used = (completed._sum.sentCount ?? 0) + (reserved._sum.targetCount ?? 0);
      if (requested > Math.max(0, freeBroadcastRecipientsPerMonth() - used)) {
        return { ok: false as const, reason: "quota_exceeded" as const };
      }
    }
    const claimed = await tx.broadcast.updateMany({
      where: { id: broadcastId, vendorId, status: "draft" },
      data: { status: "queued", targetCount: recipients.length, sentCount: 0, failedCount: 0, skippedCount: 0, sentAt: null },
    });
    if (claimed.count !== 1) return { ok: false as const, reason: "already_started" as const };
    await tx.broadcastRecipient.createMany({
      data: recipients.map((recipient) => ({
        broadcastId,
        vendorId,
        customerId: recipient.id,
        name: recipient.name,
        phone: recipient.phone,
      })),
    });
    return { ok: true as const, targetCount: recipients.length };
  });
}

async function refreshBroadcastStatus(broadcastId: string) {
  const [broadcast, counts] = await Promise.all([
    prisma.broadcast.findUnique({ where: { id: broadcastId }, select: { id: true, status: true } }),
    prisma.broadcastRecipient.groupBy({ by: ["status"], where: { broadcastId }, _count: { _all: true } }),
  ]);
  if (!broadcast || ["sent", "stubbed", "failed", "partial", "skipped", "attention"].includes(broadcast.status)) return;
  const count = (status: string) => counts.find((entry) => entry.status === status)?._count._all ?? 0;
  const sent = count("sent");
  const stubbed = count("stubbed");
  const failed = count("failed");
  const skipped = count("skipped");
  const uncertain = count("uncertain");
  const pending = count("pending") + count("sending");
  const total = counts.reduce((sum, entry) => sum + entry._count._all, 0);
  let status: string;
  if (pending > 0) status = "sending";
  else if (uncertain > 0) status = "attention";
  else if (total === 0 || (sent + stubbed === 0 && failed > 0 && skipped === 0)) status = "failed";
  else if (sent + stubbed === 0 && skipped > 0 && failed === 0) status = "skipped";
  else if (failed > 0 || skipped > 0) status = "partial";
  else if (stubbed === total) status = "stubbed";
  else status = "sent";
  await prisma.broadcast.update({
    where: { id: broadcastId },
      data: { status, sentCount: sent + stubbed, failedCount: failed, skippedCount: skipped, uncertainCount: uncertain, sentAt: pending === 0 && uncertain === 0 ? new Date() : null },
  });
}

/** Process a bounded batch of durable recipients; call from the protected cron. */
export async function processBroadcastQueue(limit = QUEUE_BATCH_SIZE): Promise<{ processed: number; uncertain: number }> {
  const staleBefore = new Date(Date.now() - CLAIM_STALE_MS);
  const staleRows = await prisma.broadcastRecipient.findMany({
    where: { status: "sending", startedAt: { lt: staleBefore } },
    select: { broadcastId: true },
  });
  const stale = await prisma.broadcastRecipient.updateMany({
    where: { status: "sending", startedAt: { lt: staleBefore } },
    data: { status: "uncertain", error: "Le worker s’est interrompu après le début de l’envoi. Vérifiez WhatsApp avant toute nouvelle tentative." },
  });
  const candidates = await prisma.broadcastRecipient.findMany({
    where: { status: "pending", broadcast: { status: { in: ["queued", "sending"] } } },
    orderBy: { createdAt: "asc" }, take: Math.max(limit * 2, limit),
    include: { broadcast: { select: { body: true, messageMode: true, templateName: true, templateLanguage: true, templateParams: true } } },
  });
  const due: Array<{ id: string; broadcastId: string; vendorId: string; customerId: string; name: string; phone: string; broadcast: { body: string; messageMode: string; templateName: string | null; templateLanguage: string | null; templateParams: string } }> = [];
  for (const candidate of candidates) {
    if (due.length >= limit) break;
    const claimed = await prisma.broadcastRecipient.updateMany({
      where: { id: candidate.id, status: "pending" },
      data: { status: "sending", startedAt: new Date(), attempts: { increment: 1 }, error: "" },
    });
    if (claimed.count !== 1) continue;
    await prisma.broadcast.update({ where: { id: candidate.broadcastId }, data: { status: "sending" } });
    due.push(candidate);
  }

  let processed = 0;
  const shopNames = new Map<string, string>();
  for (const recipient of due) {
    const customer = await prisma.customer.findFirst({
      where: { id: recipient.customerId, vendorId: recipient.vendorId, deletedAt: null, marketingConsent: true, marketingConsentRevokedAt: null },
      select: { name: true, phone: true },
    });
    if (!customer || !isValidPhone(customer.phone)) {
      await prisma.broadcastRecipient.update({ where: { id: recipient.id }, data: { status: "skipped", error: "Consentement retiré, client supprimé ou numéro invalide avant l’envoi." } });
      processed++;
      continue;
    }
    try {
      const templateParams = JSON.parse(recipient.broadcast.templateParams || "[]") as string[];
      let shopName = shopNames.get(recipient.vendorId);
      if (shopName === undefined) {
        shopName = (await prisma.vendor.findUnique({ where: { id: recipient.vendorId }, select: { shopName: true } }))?.shopName ?? "";
        shopNames.set(recipient.vendorId, shopName);
      }
      const values = { name: customer.name, store: shopName };
      const result = recipient.broadcast.messageMode === "template"
        ? await sendWhatsAppTemplate({
            vendorId: recipient.vendorId,
            to: normalizePhone(customer.phone),
            templateName: recipient.broadcast.templateName!,
            languageCode: recipient.broadcast.templateLanguage!,
            components: templateParams.length ? [{ type: "body", parameters: templateParams.map((key) => ({ type: "text", text: values[key as keyof typeof values] ?? "" })) }] : undefined,
            broadcastId: recipient.broadcastId,
          })
        : await sendWhatsApp({
            vendorId: recipient.vendorId,
            to: normalizePhone(customer.phone),
            body: personalizeBroadcastMessage(recipient.broadcast.body, values),
            broadcastId: recipient.broadcastId,
          });
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: result.status === "failed"
          ? { status: "failed", error: result.error || "WhatsApp a refusé l’envoi." }
          : { status: result.status === "stubbed" ? "stubbed" : "sent", sentAt: new Date() },
      });
      if (result.status === "failed") logger.warn("broadcast.recipient_failed", { broadcastId: recipient.broadcastId, customerId: recipient.customerId, error: result.error });
    } catch (error) {
      await prisma.broadcastRecipient.update({ where: { id: recipient.id }, data: { status: "failed", error: (error instanceof Error ? error.message : String(error)).slice(0, 500) } });
      logger.error("broadcast.recipient_error", { broadcastId: recipient.broadcastId, customerId: recipient.customerId, error: String(error) });
    }
    processed++;
    await sleep(THROTTLE_MS);
  }

  const affectedBroadcasts = new Set([...due.map((recipient) => recipient.broadcastId), ...staleRows.map((row) => row.broadcastId)]);
  for (const broadcastId of affectedBroadcasts) await refreshBroadcastStatus(broadcastId);
  logger.info("broadcast.queue_batch", { processed, uncertain: stale.count });
  return { processed, uncertain: stale.count };
}

/** Compatibility helper for tests and local callers; production uses cron batches. */
export async function dispatchBroadcast(broadcastId: string): Promise<void> {
  const broadcast = await prisma.broadcast.findUnique({ where: { id: broadcastId }, select: { vendorId: true, status: true } });
  if (!broadcast) return;
  if (broadcast.status === "draft") await queueBroadcast(broadcast.vendorId, broadcastId);
  await processBroadcastQueue(Number.MAX_SAFE_INTEGER);
}
