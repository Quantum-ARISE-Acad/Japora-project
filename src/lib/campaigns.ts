/**
 * Japora CTWA (Click-to-WhatsApp) campaigns + order attribution.
 *
 * The play: a vendor mints a campaign for a product. We hand back a single
 * trackable link — `/go/<refCode>` — that they paste into a Facebook/Instagram
 * "Ads that Click to WhatsApp" creative (or any post, flyer QR, Status). The
 * link counts the click, then bounces the customer into WhatsApp with a
 * pre-filled message carrying a small ref tag `(ref: CODE)`.
 *
 * When that first message lands on the webhook we record a CampaignTouch
 * (phone → campaign). Any order that phone places afterwards — via the bot, the
 * in-chat Flow, or even the web catalog — attributes back to the campaign
 * (last-touch within a window). That closes the loop Meta's own tools never do
 * for informal vendors: ad click → WhatsApp chat → actual order + revenue.
 *
 * Stub-first: nothing here needs Meta credentials. In production Meta also
 * delivers a `referral.source_id` on the first CTWA message — we honour that as
 * an alternative ref source, but the pre-fill tag works without it.
 */

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { logger } from "./logger";
import { isValidPhone, normalizePhone } from "./otp";
import {
  customerMarketingConsentGranted,
  customerReactivationEligibility,
} from "./customers";
import { sendWhatsApp } from "./whatsapp";

// Readable alphabet — no confusables (0/O, 1/I/L). A campaign code is short so
// it survives being typed into a chat or shouted across a stall.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const CODE_LEN = 6;
const MAX_RETRIES = 6;

// Agreed campaign attribution window: a touch older than seven days no longer credits orders.
const TOUCH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_RECOVERY_MESSAGES_PER_WEEK = 2;
const RECOVERY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;


function generateCode(): string {
  const buf = randomBytes(CODE_LEN);
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) out += ALPHABET[buf[i] % ALPHABET.length];
  return out;
}

async function mintRefCode(): Promise<string> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const code = generateCode();
    const clash = await prisma.campaign.findUnique({ where: { refCode: code }, select: { id: true } });
    if (!clash) return code;
    logger.warn("campaign.code_collision_retry", { attempt });
  }
  throw new Error("campaign_code_exhausted");
}

export type CreateCampaignInput = {
  name: string;
  productId?: string | null;
  headline?: string;
  body?: string;
  cta?: string;
  spendCents?: number;
  platform?: "meta" | "tiktok" | "linkedin";
  targetRegion?: string;
  kind?: "ctwa" | "abandoned_cart";
  status?: string;
};

export type RecoveryCartCandidate = {
  vendorId: string;
  sessionId: string;
  productId: string | null;
  productName: string | null;
  valueCents: number;
  createdAt: Date;
  staleAgeMs: number;
};

export function renderRecoveryTemplate(
  template: string,
  values: Record<string, string | number | boolean | null | undefined>,
): string {
  const safe = (template || "").trim();
  if (!safe) return "";
  return safe.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const value = values[key];
    if (value == null || value === "") return "";
    return String(value);
  }).replace(/\s{2,}/g, " ").trim();
}

export async function findAbandonedCartRecoveryCandidates(
  vendorId: string,
  opts: { now?: Date | number; staleAfterMs?: number; maxAgeMs?: number } = {},
): Promise<RecoveryCartCandidate[]> {
  const nowMs = new Date(opts.now ?? Date.now()).getTime();
  const staleAfterMs = opts.staleAfterMs ?? 24 * 60 * 60 * 1000;
  const maxAgeMs = opts.maxAgeMs ?? 48 * 60 * 60 * 1000;
  const earliest = new Date(nowMs - maxAgeMs);

  const [rows, convertedSessions] = await Promise.all([
    prisma.funnelEvent.findMany({
      where: {
        vendorId,
        stage: "cart",
        createdAt: { gte: earliest },
        valueCents: { gt: 0 },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        vendorId,
        deletedAt: null,
        sessionId: { not: null },
      },
      select: { sessionId: true },
    }),
  ]);

  const converted = new Set(
    convertedSessions
      .map((row) => row.sessionId)
      .filter((value): value is string => Boolean(value && value.trim())),
  );

  const results: RecoveryCartCandidate[] = [];
  for (const row of rows) {
    const sessionId = (row.sessionId || "").trim();
    if (!sessionId || converted.has(sessionId)) continue;

    const createdAt = row.createdAt ?? new Date();
    const staleAgeMs = nowMs - createdAt.getTime();
    if (staleAgeMs < staleAfterMs) continue;

    let productName: string | null = null;
    if (row.productId) {
      const product = await prisma.product.findFirst({
        where: { id: row.productId, vendorId, isActive: true },
        select: { name: true },
      });
      productName = product?.name ?? null;
    }

    results.push({
      vendorId: row.vendorId,
      sessionId,
      // FunnelEvent.productId is an unconstrained string. Only expose it when
      // it resolves to an active product owned by this vendor.
      productId: productName ? row.productId : null,
      productName,
      valueCents: Number(row.valueCents || 0),
      createdAt,
      staleAgeMs,
    });
  }

  return results;
}

export async function createRecoveryCampaign(
  vendorId: string,
  input: {
    sessionId: string;
    productId?: string | null;
    template?: string;
    name?: string;
    headline?: string;
  },
) {
  const sessionId = (input.sessionId || "").trim();
  if (!sessionId) {
    throw new Error("sessionId_required");
  }

  const draftName = input.name || "Abandoned cart recovery";
  const recoveryKey = `cart:${sessionId}`;
  const existing = await prisma.campaign.findUnique({
    where: { vendorId_recoveryKey: { vendorId, recoveryKey } },
  });
  if (existing) return existing;

  const template = (input.template || "Hi {{name}}, your {{product}} is still waiting at {{store}}.").trim();
  try {
    const candidate = await prisma.campaign.create({
      data: {
      vendorId,
      name: draftName,
      kind: "abandoned_cart",
      recoveryKey,
      productId: input.productId ?? null,
      headline: (input.headline || "Your cart is still waiting").slice(0, 140),
      body: template,
      cta: "Complete my order",
      status: "draft",
      refCode: await mintRefCode(),
      },
    });

  logger.info("campaign.recovery_draft_created", {
    vendorId,
    sessionId,
    campaignId: candidate.id,
  });
    return candidate;
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const concurrent = await prisma.campaign.findUnique({ where: { vendorId_recoveryKey: { vendorId, recoveryKey } } });
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

export type ReactivationCustomerCandidate = {
  vendorId: string;
  customerId: string;
  customerName: string;
  phone: string;
  lastActivityAt: Date;
  staleDays: number;
  productId?: string | null;
  productName?: string | null;
};

export async function findInactiveCustomerReactivationCandidates(
  vendorId: string,
  opts: { now?: Date | number; staleDays?: number } = {},
): Promise<ReactivationCustomerCandidate[]> {
  const referenceTime = new Date(opts.now ?? Date.now()).getTime();

  const customers = await prisma.customer.findMany({
    where: {
      vendorId,
      deletedAt: null,
      phone: { not: "" },
      marketingConsent: true,
      marketingConsentRevokedAt: null,
    },
    include: {
      funnelEvents: {
        where: { vendorId },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
      orders: {
        where: { vendorId, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          createdAt: true,
          items: {
            take: 1,
          select: { productId: true, productName: true },
          },
        },
      },
    },
    orderBy: { lastOrderAt: "asc" },
  });

  const results: ReactivationCustomerCandidate[] = [];

  for (const c of customers) {
    if (!c.phone || !isValidPhone(c.phone)) continue;

    const lastOrderTime = c.lastOrderAt ? c.lastOrderAt.getTime() : (c.orders[0]?.createdAt ? c.orders[0].createdAt.getTime() : null);
    const lastCartTime = c.funnelEvents[0]?.createdAt ? c.funnelEvents[0].createdAt.getTime() : null;
    const lastActivityTime = [lastOrderTime, lastCartTime]
      .filter((v): v is number => v != null)
      .sort((a, b) => b - a)[0];

    const eligible = customerReactivationEligibility(
      {
        marketingConsent: c.marketingConsent,
        marketingConsentRevokedAt: c.marketingConsentRevokedAt,
        deletedAt: c.deletedAt,
        lastOrderAt: lastOrderTime ? new Date(lastOrderTime) : null,
        lastCartAt: lastCartTime ? new Date(lastCartTime) : null,
      },
      referenceTime,
    );

    if (!eligible || lastActivityTime == null) continue;

    const staleDays = Math.floor((referenceTime - lastActivityTime) / (24 * 60 * 60 * 1000));
    const lastOrderItem = c.orders[0]?.items?.[0];
    const productId = lastOrderItem?.productId ?? null;
    const productName = lastOrderItem?.productName ?? null;

    results.push({
      vendorId,
      customerId: c.id,
      customerName: c.name || "Customer",
      phone: normalizePhone(c.phone),
      lastActivityAt: new Date(lastActivityTime),
      staleDays,
      productId,
      productName,
    });
  }

  return results;
}

export async function createReactivationCampaign(
  vendorId: string,
  input: {
    customerId: string;
    productId?: string | null;
    template?: string;
    name?: string;
    headline?: string;
  },
) {
  const customerId = (input.customerId || "").trim();
  if (!customerId) {
    throw new Error("customerId_required");
  }

  const draftName = input.name || "Customer reactivation";
  const recoveryKey = `customer:${customerId}`;
  const existing = await prisma.campaign.findUnique({
    where: { vendorId_recoveryKey: { vendorId, recoveryKey } },
  });
  if (existing) return existing;

  const template = (input.template || "Hi {{name}}, we miss you at {{store}}! Check out our latest arrivals.").trim();
  try {
    const candidate = await prisma.campaign.create({
      data: {
      vendorId,
      name: draftName,
      kind: "reactivation",
      recoveryKey,
      productId: input.productId ?? null,
      headline: (input.headline || "We miss you").slice(0, 140),
      body: template,
      cta: "Shop new arrivals",
      status: "draft",
      refCode: await mintRefCode(),
      },
    });

  logger.info("campaign.reactivation_draft_created", {
    vendorId,
    customerId,
    campaignId: candidate.id,
  });
    return candidate;
  } catch (error) {
    if ((error as { code?: string })?.code === "P2002") {
      const concurrent = await prisma.campaign.findUnique({ where: { vendorId_recoveryKey: { vendorId, recoveryKey } } });
      if (concurrent) return concurrent;
    }
    throw error;
  }
}

function makeApprovalHash(recipientPhone: string, body: string, sessionId?: string | null): string {
  const payload = JSON.stringify({
    sessionId: sessionId ?? null,
    recipientPhone: normalizePhone(recipientPhone),
    body,
  });
  return createHash("sha256").update(payload).digest("hex");
}

async function resolveRecoveryRecipient(vendorId: string, sessionId: string) {
  const cart = await prisma.funnelEvent.findFirst({
    where: { vendorId, sessionId, stage: "cart" },
    orderBy: { createdAt: "desc" },
    select: {
      customerId: true,
      customerPhone: true,
    },
  });

  const customer = cart?.customerId
    ? await prisma.customer.findFirst({
      where: { id: cart.customerId, vendorId, deletedAt: null },
      select: {
        id: true,
        name: true,
        phone: true,
        marketingConsent: true,
        marketingConsentRevokedAt: true,
      },
    })
    : cart?.customerPhone
      ? await prisma.customer.findUnique({
        where: { vendorId_phone: { vendorId, phone: cart.customerPhone } },
        select: {
          id: true,
          name: true,
          phone: true,
          marketingConsent: true,
          marketingConsentRevokedAt: true,
        },
      })
      : null;

  if (customer?.phone && isValidPhone(customer.phone)) {
    return {
      customerId: customer.id,
      phone: normalizePhone(customer.phone),
      name: customer.name,
      marketingConsent: customer.marketingConsent ?? null,
      marketingConsentRevokedAt: customer.marketingConsentRevokedAt ?? null,
    };
  }

  const order = await prisma.order.findFirst({
    where: { vendorId, sessionId, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      customerId: true,
      customerPhone: true,
      customerName: true,
      customer: { select: { id: true, name: true, phone: true, marketingConsent: true, marketingConsentRevokedAt: true } },
    },
  });

  if (order?.customer?.phone && isValidPhone(order.customer.phone)) {
    return {
      customerId: order.customer.id,
      phone: normalizePhone(order.customer.phone),
      name: order.customer.name || order.customerName,
      marketingConsent: order.customer.marketingConsent ?? null,
      marketingConsentRevokedAt: order.customer.marketingConsentRevokedAt ?? null,
    };
  }

  if (order?.customerPhone && isValidPhone(order.customerPhone)) {
    return {
      customerId: order.customerId ?? null,
      phone: normalizePhone(order.customerPhone),
      name: order.customerName,
      marketingConsent: order.customer?.marketingConsent ?? null,
      marketingConsentRevokedAt: order.customer?.marketingConsentRevokedAt ?? null,
    };
  }

  return null;
}

export async function approveRecoveryCampaign(
  vendorId: string,
  campaignId: string,
  input: { sessionId?: string; recipientPhone?: string; body?: string } = {},
) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, vendorId, deletedAt: null },
  });
  if (!campaign) return null;
  if (!["abandoned_cart", "reactivation"].includes(campaign.kind)) return null;

  const rawBody = typeof input.body === "string" ? input.body.trim() : campaign.body || "";
  const recipientPhone = typeof input.recipientPhone === "string" ? normalizePhone(input.recipientPhone) : campaign.approvedForPhone || null;
  const approvalHash = recipientPhone && rawBody ? makeApprovalHash(recipientPhone, rawBody, input.sessionId ?? campaign.recoveryKey) : null;

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "approved",
      approvedAt: new Date(),
      approvedForPhone: recipientPhone,
      approvedBody: rawBody || null,
      approvalHash,
    },
  });
}

export type RecoveryApprovalPreview = {
  campaignId: string;
  sessionId: string | null;
  productId: string | null;
  productName: string | null;
  customerId: string | null;
  recipientName: string | null;
  phone: string;
  marketingConsent: boolean | null;
  marketingConsentRevokedAt: Date | null;
  renderedBody: string;
  approvalRequired: boolean;
  alreadyApproved: boolean;
  status: string;
};

export async function getRecoveryApprovalPreview(
  vendorId: string,
  campaignId: string,
): Promise<RecoveryApprovalPreview | null> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, vendorId, deletedAt: null },
      select: {
      id: true,
      kind: true,
      recoveryKey: true,
      productId: true,
      body: true,
      status: true,
      approvedAt: true,
      approvedForPhone: true,
      approvedBody: true,
      approvalHash: true,
    },
  });
  if (!campaign || !["abandoned_cart", "reactivation"].includes(campaign.kind) || !campaign.recoveryKey) return null;

  const isReactivation = campaign.kind === "reactivation";
  if (isReactivation) {
    const candidateList = await findInactiveCustomerReactivationCandidates(vendorId);
    const customerId = campaign.recoveryKey.slice("customer:".length);
    const relevant = candidateList.filter((c) => c.customerId === customerId);

    if (relevant.length === 0) return null;

    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { shopName: true },
    });

    for (const candidate of relevant) {
      const renderedBody = renderRecoveryTemplate(
        campaign.body || "Hi {{name}}, we miss you at {{store}}! Check out our latest arrivals.",
        {
          name: candidate.customerName || "there",
          product: "",
          store: vendor?.shopName || "our shop",
        },
      );

      const approvalHash = makeApprovalHash(candidate.phone, renderedBody, candidate.customerId);
      const alreadyApproved = Boolean(
        campaign.approvedAt &&
        campaign.approvedForPhone === candidate.phone &&
        campaign.approvedBody === renderedBody &&
        campaign.approvalHash === approvalHash,
      );

      return {
        campaignId: campaign.id,
        sessionId: candidate.customerId,
        productId: candidate.productId ?? campaign.productId,
        productName: candidate.productName ?? null,
        customerId: candidate.customerId,
        recipientName: candidate.customerName,
        phone: candidate.phone,
        marketingConsent: true,
        marketingConsentRevokedAt: null,
        renderedBody,
        approvalRequired: !alreadyApproved,
        alreadyApproved,
        status: campaign.status,
      };
    }

    return null;
  }

  const candidateList = await findAbandonedCartRecoveryCandidates(vendorId);
  const sessionId = campaign.recoveryKey.slice("cart:".length);
  const relevant = candidateList.filter((candidate) => candidate.sessionId === sessionId);

  if (relevant.length === 0) return null;

  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { shopName: true },
  });

  for (const candidate of relevant) {
    const recipient = await resolveRecoveryRecipient(vendorId, candidate.sessionId);
    if (!recipient?.phone) continue;

    const consentGranted = customerMarketingConsentGranted({
      marketingConsent: recipient.marketingConsent,
      marketingConsentRevokedAt: recipient.marketingConsentRevokedAt,
    });
    if (!consentGranted) continue;

    const renderedBody = renderRecoveryTemplate(campaign.body || "Hi {{name}}, your {{product}} is still waiting at {{store}}.", {
      name: recipient.name || "there",
      product: candidate.productName || "",
      store: vendor?.shopName || "our shop",
    });

    const approvalHash = makeApprovalHash(recipient.phone, renderedBody, candidate.sessionId);
    const alreadyApproved = Boolean(
      campaign.approvedAt &&
      campaign.approvedForPhone === recipient.phone &&
      campaign.approvedBody === renderedBody &&
      campaign.approvalHash === approvalHash,
    );

    return {
      campaignId: campaign.id,
      sessionId: candidate.sessionId,
      productId: candidate.productId,
      productName: candidate.productName,
      customerId: recipient.customerId ?? null,
      recipientName: recipient.name ?? null,
      phone: recipient.phone,
      marketingConsent: recipient.marketingConsent ?? null,
      marketingConsentRevokedAt: recipient.marketingConsentRevokedAt ?? null,
      renderedBody,
      approvalRequired: !alreadyApproved,
      alreadyApproved,
      status: campaign.status,
    };
  }

  return null;
}

export async function dispatchRecoveryCampaign(
  vendorId: string,
  campaignId: string,
): Promise<{ status: "approval_required" | "blocked" | "sent" | "stubbed" | "failed"; sent: number; failed: number; reason?: string }> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, vendorId, deletedAt: null },
  });
  if (!campaign) {
    return { status: "blocked", sent: 0, failed: 0, reason: "campaign_not_found" };
  }

  if (campaign.status !== "approved") {
    return { status: "approval_required", sent: 0, failed: 0, reason: "merchant_approval_required" };
  }
  if (!["abandoned_cart", "reactivation"].includes(campaign.kind)) {
    return { status: "blocked", sent: 0, failed: 0, reason: "unsupported_campaign_kind" };
  }

  const preview = await getRecoveryApprovalPreview(vendorId, campaignId);
  if (!preview) {
    await prisma.campaign.updateMany({ where: { id: campaignId, vendorId, status: "approved" }, data: { status: "blocked" } });
    return { status: "blocked", sent: 0, failed: 0, reason: "no_candidate" };
  }
  if (!preview.alreadyApproved || preview.phone !== campaign.approvedForPhone || preview.renderedBody !== campaign.approvedBody) {
    await prisma.campaign.updateMany({ where: { id: campaignId, vendorId, status: "approved" }, data: { status: "blocked" } });
    return { status: "blocked", sent: 0, failed: 0, reason: "approval_mismatch" };
  }

  // Claim the one-time dispatch atomically so concurrent requests cannot send twice.
  const claim = await prisma.campaign.updateMany({
    where: { id: campaignId, vendorId, status: "approved" },
    data: { status: "sending" },
  });
  if (claim.count !== 1) {
    return { status: "approval_required", sent: 0, failed: 0, reason: "dispatch_already_claimed" };
  }

  const weeklyMessages = await prisma.whatsAppMessage.count({
    where: {
      vendorId,
      direction: "OUT",
      contact: preview.phone,
      createdAt: { gte: new Date(Date.now() - RECOVERY_WINDOW_MS) },
    },
  });
  if (weeklyMessages >= MAX_RECOVERY_MESSAGES_PER_WEEK) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "blocked" } });
    return { status: "blocked", sent: 0, failed: 0, reason: "weekly_message_limit" };
  }

  try {
    const result = await sendWhatsApp({ vendorId, to: preview.phone, body: preview.renderedBody });
    const status = result.status === "stubbed" ? "stubbed" : result.status === "failed" ? "failed" : "sent";
    await prisma.campaign.update({ where: { id: campaignId }, data: { status } });
    return { status, sent: result.status === "failed" ? 0 : 1, failed: result.status === "failed" ? 1 : 0 };
  } catch (error) {
    await prisma.campaign.update({ where: { id: campaignId }, data: { status: "failed" } });
    logger.error("campaign.recovery_dispatch_failed", { campaignId, error: String(error) });
    return { status: "failed", sent: 0, failed: 1, reason: "send_failed" };
  }
}

/** Create a campaign for a vendor, minting a unique trackable refCode. */
export async function createCampaign(vendorId: string, input: CreateCampaignInput) {
  const refCode = await mintRefCode();
  const campaign = await prisma.campaign.create({
    data: {
      vendorId,
      name: input.name.trim().slice(0, 120) || "Untitled campaign",
      productId: input.productId || null,
      headline: (input.headline || "").trim().slice(0, 140),
      body: (input.body || "").trim().slice(0, 600),
      cta: (input.cta || "Shop now").trim().slice(0, 40),
      spendCents: Math.max(0, Math.round(input.spendCents || 0)),
      platform: input.platform || "meta",
      targetRegion: (input.targetRegion || "").trim().slice(0, 120) || null,
      refCode,
    },
  });
  logger.info("campaign.created", { vendorId, campaignId: campaign.id, refCode });
  return campaign;
}

/** The ROAS-augmented view a dashboard wants. */
export type CampaignStats = {
  id: string;
  name: string;
  refCode: string;
  productId: string | null;
  kind: string;
  platform: string | null;
  targetRegion: string | null;
  headline: string;
  body: string;
  cta: string;
  status: string;
  clicks: number;
  orders: number;
  revenueCents: number;
  spendCents: number;
  cvr: number; // orders / clicks
  roas: number | null; // revenue / spend (null if no spend recorded)
  createdAt: Date;
};

function toStats(c: {
  id: string; name: string; refCode: string; productId: string | null; kind: string;
  platform: string | null; targetRegion: string | null;
  headline: string; body: string; cta: string; status: string;
  clicks: number; orders: number; revenueCents: number; spendCents: number; createdAt: Date;
}): CampaignStats {
  return {
    id: c.id,
    name: c.name,
    refCode: c.refCode,
    productId: c.productId,
    kind: c.kind,
    platform: c.platform,
    targetRegion: c.targetRegion,
    headline: c.headline,
    body: c.body,
    cta: c.cta,
    status: c.status,
    clicks: c.clicks,
    orders: c.orders,
    revenueCents: c.revenueCents,
    spendCents: c.spendCents,
    cvr: c.clicks > 0 ? c.orders / c.clicks : 0,
    roas: c.spendCents > 0 ? c.revenueCents / c.spendCents : null,
    createdAt: c.createdAt,
  };
}

export async function listCampaigns(vendorId: string): Promise<CampaignStats[]> {
  await syncEligibleRecoveryCampaigns(vendorId);
  await syncEligibleReactivationCampaigns(vendorId);
  const rows = await prisma.campaign.findMany({
    where: { vendorId, deletedAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toStats);
}

export async function getCampaign(vendorId: string, id: string): Promise<CampaignStats | null> {
  const row = await prisma.campaign.findFirst({ where: { id, vendorId, deletedAt: null } });
  return row ? toStats(row) : null;
}

export async function softDeleteCampaign(vendorId: string, id: string): Promise<boolean> {
  const res = await prisma.campaign.updateMany({
    where: { id, vendorId, deletedAt: null },
    data: { deletedAt: new Date(), status: "archived" },
  });
  return res.count > 0;
}

export async function syncEligibleRecoveryCampaigns(
  vendorId: string,
  opts: { now?: Date | number; staleAfterMs?: number; maxAgeMs?: number } = {},
): Promise<void> {
  const candidates = await findAbandonedCartRecoveryCandidates(vendorId, opts);
  for (const candidate of candidates) {
    await createRecoveryCampaign(vendorId, {
      sessionId: candidate.sessionId,
      productId: candidate.productId,
      template: "Hi {{name}}, your {{product}} is still waiting at {{store}}.",
      name: "Abandoned cart recovery",
      headline: "Your cart is still waiting",
    });
  }
}

export async function syncEligibleReactivationCampaigns(
  vendorId: string,
  opts: { now?: Date | number; staleDays?: number } = {},
): Promise<void> {
  const candidates = await findInactiveCustomerReactivationCandidates(vendorId, opts);
  for (const candidate of candidates) {
    await createReactivationCampaign(vendorId, {
      customerId: candidate.customerId,
      productId: candidate.productId ?? null,
      template: "Hi {{name}}, we miss you at {{store}}! Check out our latest arrivals.",
      name: "Customer reactivation",
      headline: "We miss you",
    });
  }
}

export async function rejectRecoveryCampaignApproval(vendorId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, vendorId, deletedAt: null },
    select: { id: true, status: true, kind: true },
  });
  if (!campaign) return null;
  if (!["abandoned_cart", "reactivation"].includes(campaign.kind)) return null;
  if (campaign.status === "sent" || campaign.status === "stubbed") return null;

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: "draft",
      approvedAt: null,
      approvedForPhone: null,
      approvedBody: null,
      approvalHash: null,
    },
  });
}

/* ------------------------------- Ref tagging ------------------------------ */

const REF_RE = /\(ref:\s*([A-Z0-9]{4,12})\)/i;

/** Pull a campaign ref code out of a free-text message, if present. */
export function extractRef(text: string): string | null {
  const m = REF_RE.exec(text || "");
  return m ? m[1].toUpperCase() : null;
}

/** Remove the ref tag so the bot's intent parser sees a clean message. */
export function stripRef(text: string): string {
  return (text || "").replace(REF_RE, "").replace(/\s{2,}/g, " ").trim();
}

/** The trackable click URL for a campaign. */
export function goPath(refCode: string): string {
  return `/go/${refCode}`;
}

/** The pre-filled WhatsApp message body a /go redirect should carry. */
export function prefillText(opts: {
  shopName: string;
  productName?: string | null;
  refCode: string;
}): string {
  const lead = opts.productName
    ? `Hi ${opts.shopName}! I'd like to order ${opts.productName}.`
    : `Hi ${opts.shopName}! I saw your ad and I'd like to order.`;
  return `${lead} (ref: ${opts.refCode})`;
}

/* ------------------------------- Click + touch ---------------------------- */

/**
 * Register a click on a campaign link and return what /go needs to build the
 * WhatsApp redirect. Returns null for unknown/archived codes.
 */
export async function recordClick(refCode: string, opts: { countClick?: boolean } = {}): Promise<{
  vendorPhone: string;
  shopName: string;
  productName: string | null;
  refCode: string;
} | null> {
  const code = String(refCode || "").trim().toUpperCase();
  if (!code) return null;
  const campaign = await prisma.campaign.findFirst({
    where: { refCode: code, deletedAt: null },
    select: { id: true, productId: true, vendorId: true },
  });
  if (!campaign) return null;

  const vendor = await prisma.vendor.findUnique({
    where: { id: campaign.vendorId },
    select: { whatsappNumber: true, phone: true, shopName: true },
  });
  if (!vendor) return null;

  let productName: string | null = null;
  if (campaign.productId) {
    const p = await prisma.product.findUnique({
      where: { id: campaign.productId },
      select: { name: true },
    });
    productName = p?.name ?? null;
  }

  if (opts.countClick !== false) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { clicks: { increment: 1 } },
    });
    logger.info("campaign.click", { campaignId: campaign.id, refCode: code });
  }

  return {
    vendorPhone: normalizePhone(vendor.whatsappNumber || vendor.phone || ""),
    shopName: vendor.shopName,
    productName,
    refCode: code,
  };
}

/**
 * Record an attribution touch from an inbound WhatsApp message. Detects a ref
 * code in the text (or accepts an explicit one from Meta's CTWA referral),
 * confirms it belongs to this vendor, and writes a CampaignTouch keyed by the
 * customer's phone. Idempotent-ish: a duplicate within 60s is skipped.
 *
 * Returns the matched campaignId, or null.
 */
export async function recordTouchFromText(
  vendorId: string,
  phone: string,
  text: string,
  explicitRef?: string | null,
): Promise<string | null> {
  const code = (explicitRef && explicitRef.toUpperCase()) || extractRef(text);
  if (!code) return null;
  const normPhone = normalizePhone(phone);
  if (!normPhone) return null;

  const campaign = await prisma.campaign.findFirst({
    where: { refCode: code, vendorId, deletedAt: null },
    select: { id: true },
  });
  if (!campaign) return null;

  // Skip a near-duplicate touch (same phone+campaign within a minute).
  const recent = await prisma.campaignTouch.findFirst({
    where: {
      campaignId: campaign.id,
      phone: normPhone,
      createdAt: { gte: new Date(Date.now() - 60_000) },
    },
    select: { id: true },
  });
  if (recent) return campaign.id;

  await prisma.campaignTouch.create({ data: { campaignId: campaign.id, phone: normPhone } });
  logger.info("campaign.touch", { vendorId, campaignId: campaign.id, refCode: code });
  return campaign.id;
}

/* ------------------------------- Attribution ------------------------------ */

/**
 * Attribute an order to a campaign (last-touch). Looks for the most recent
 * touch by this phone for this vendor within the window; if found, stamps
 * order.campaignId and bumps the campaign's orders + revenue counters.
 *
 * Safe to call post-commit for every order — a no-op when there's no touch.
 * Returns the attributed campaignId or null.
 */
export async function attributeOrder(opts: {
  orderId: string;
  vendorId: string;
  phone: string;
  revenueCents: number;
}): Promise<string | null> {
  const normPhone = normalizePhone(opts.phone);
  if (!normPhone) return null;

  const touch = await prisma.campaignTouch.findFirst({
    where: {
      phone: normPhone,
      createdAt: { gte: new Date(Date.now() - TOUCH_WINDOW_MS) },
      campaign: { vendorId: opts.vendorId, deletedAt: null },
    },
    orderBy: { createdAt: "desc" },
    select: { campaignId: true },
  });
  if (!touch) return null;

  const attributed = await prisma.$transaction(async (tx) => {
    const existing = await tx.order.findFirst({ where: { id: opts.orderId, vendorId: opts.vendorId }, select: { campaignId: true } });
    if (!existing) return null;
    if (existing.campaignId) return existing.campaignId;
    const claim = await tx.order.updateMany({
      where: { id: opts.orderId, vendorId: opts.vendorId, campaignId: null },
      data: { campaignId: touch.campaignId },
    });
    if (claim.count !== 1) {
      const current = await tx.order.findFirst({ where: { id: opts.orderId, vendorId: opts.vendorId }, select: { campaignId: true } });
      return current?.campaignId ?? null;
    }
    await tx.campaign.update({
      where: { id: touch.campaignId },
      data: { orders: { increment: 1 }, revenueCents: { increment: Math.max(0, opts.revenueCents) } },
    });
    return touch.campaignId;
  });
  if (!attributed) return null;
  if (attributed !== touch.campaignId) return attributed;
  logger.info("campaign.attributed", {
    vendorId: opts.vendorId,
    orderId: opts.orderId,
    campaignId: touch.campaignId,
    revenueCents: opts.revenueCents,
  });
  return attributed;
}

export const __testing = { generateCode, REF_RE, TOUCH_WINDOW_MS };
