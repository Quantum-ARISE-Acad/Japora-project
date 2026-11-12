import { prisma } from "@/lib/db";

export interface FunnelStageMetric {
  stage: string;
  label: string;
  count: number; // Distinct sessions (or unique orders for confirmed)
  rawCount: number; // Total events
  conversionFromVisitPct: number;
  stepDropOffPct: number;
}

export interface FunnelSummary {
  stages: FunnelStageMetric[];
  totalVisits: number;
  totalConfirmed: number;
  overallConversionRatePct: number;
  ussdIntentToConfirmedPct: number;
}

export type FunnelStageCounts = {
  visit: number;
  product_view: number;
  cart: number;
  ussd_intent: number;
  confirmed_order: number;
};

/**
 * Record a server-authoritative confirmed order in FunnelEvent.
 * Idempotent: ensures only one confirmed_order event exists per order.
 */
export async function recordConfirmedOrder(opts: {
  orderId: string;
  vendorId: string;
  shopSlug: string;
  totalCents: number;
  sessionId?: string | null;
}): Promise<void> {
  const existing = await prisma.funnelEvent.findFirst({
    where: { orderId: opts.orderId, stage: "confirmed_order" },
    select: { id: true },
  });
  if (existing) return;

  await prisma.funnelEvent.create({
    data: {
      vendorId: opts.vendorId,
      shopSlug: opts.shopSlug,
      stage: "confirmed_order",
      sessionId: opts.sessionId && opts.sessionId.trim() ? opts.sessionId.trim() : `order_${opts.orderId}`,
      orderId: opts.orderId,
      valueCents: opts.totalCents > 0 ? opts.totalCents : 0,
    },
  });
}

/**
 * Calculate step-by-step conversion and drop-off rates given 5 stage session counts.
 */
export function computeFunnelRates(
  counts: FunnelStageCounts,
  rawCounts: FunnelStageCounts = counts,
  ussdOrders: { intents: number; confirmed: number } = {
    intents: counts.ussd_intent,
    confirmed: counts.confirmed_order,
  },
): FunnelSummary {
  const v = Math.max(0, counts.visit);
  const p = Math.max(0, counts.product_view);
  const c = Math.max(0, counts.cart);
  const u = Math.max(0, counts.ussd_intent);
  const conf = Math.max(0, counts.confirmed_order);

  const stageDefs: Array<{ stage: string; label: string; count: number }> = [
    { stage: "visit", label: "1. Visites de la boutique", count: v },
    { stage: "product_view", label: "2. Fiches produits consultées", count: p },
    { stage: "cart", label: "3. Ajouts au panier", count: c },
    { stage: "ussd_intent", label: "4. Intentions de paiement USSD (T-Money / Flooz)", count: u },
    { stage: "confirmed_order", label: "5. Sessions avec commande payée", count: conf },
  ];

  const stages: FunnelStageMetric[] = [];
  let prevCount = 0;

  for (let i = 0; i < stageDefs.length; i++) {
    const item = stageDefs[i];
    const conversionFromVisit = v > 0 ? Math.min(100, Math.round((item.count / v) * 1000) / 10) : 0;
    let stepDropOff = 0;
    if (i > 0) {
      if (prevCount > 0) {
        // A later stage can exceed an earlier one when the tracking history is
        // incomplete. Never fabricate abandonment by clamping the later count.
        stepDropOff = item.count < prevCount
          ? Math.round(((prevCount - item.count) / prevCount) * 1000) / 10
          : 0;
      } else {
        stepDropOff = 0;
      }
    }

    stages.push({
      stage: item.stage,
      label: item.label,
      count: item.count,
      rawCount: Math.max(0, rawCounts[item.stage as keyof FunnelStageCounts]),
      conversionFromVisitPct: conversionFromVisit,
      stepDropOffPct: stepDropOff,
    });

    prevCount = item.count;
  }

  const overall = v > 0 ? Math.min(100, Math.round((conf / v) * 1000) / 10) : 0;
  const ussdToPaid = ussdOrders.intents > 0
    ? Math.min(100, Math.round((ussdOrders.confirmed / ussdOrders.intents) * 1000) / 10)
    : 0;

  return {
    stages,
    totalVisits: v,
    totalConfirmed: conf,
    overallConversionRatePct: overall,
    ussdIntentToConfirmedPct: ussdToPaid,
  };
}

/**
 * Fetch and aggregate funnel counts from FunnelEvent for a given vendor.
 */
export async function getVendorFunnel(
  vendorId: string,
  options?: { from?: Date; to?: Date }
): Promise<FunnelSummary> {
  const whereClause: {
    vendorId: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = { vendorId };

  // Analytics should describe a bounded, comparable period. Callers may pass
  // an explicit interval; otherwise use the most recent 14 days.
  const now = new Date();
  const from = options?.from ?? new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const to = options?.to ?? now;
  whereClause.createdAt = { gte: from, lte: to };

  const clientStages = ["visit", "product_view", "cart", "ussd_intent"];
  const [rawGroups, sessionGroups, confirmedOrders, ussdIntentOrders] = await Promise.all([
    prisma.funnelEvent.groupBy({
      by: ["stage"],
      where: whereClause,
      _count: { _all: true },
    }),
    prisma.funnelEvent.groupBy({
      by: ["stage", "sessionId"],
      where: { ...whereClause, stage: { in: clientStages } },
    }),
    prisma.funnelEvent.groupBy({
      by: ["orderId", "sessionId"],
      where: { ...whereClause, stage: "confirmed_order", orderId: { not: null } },
    }),
    prisma.funnelEvent.groupBy({
      by: ["orderId", "sessionId"],
      where: { ...whereClause, stage: "ussd_intent", orderId: { not: null } },
    }),
  ]);

  const visitSessions = new Set<string>();
  const sessionsByStage = new Map<string, Set<string>>();
  for (const stage of clientStages) sessionsByStage.set(stage, new Set<string>());
  for (const group of sessionGroups) {
    if (clientStages.includes(group.stage) && group.sessionId) {
      sessionsByStage.get(group.stage)?.add(group.sessionId);
      if (group.stage === "visit") visitSessions.add(group.sessionId);
    }
  }

  const matchingConfirmedOrders = confirmedOrders.filter((group) =>
    group.sessionId && !group.sessionId.startsWith("order_") && visitSessions.has(group.sessionId),
  );
  const counts: FunnelStageCounts = {
    visit: visitSessions.size,
    product_view: 0,
    cart: 0,
    ussd_intent: 0,
    confirmed_order: new Set(matchingConfirmedOrders.map((group) => group.sessionId).filter((id): id is string => Boolean(id))).size,
  };
  for (const stage of ["product_view", "cart", "ussd_intent"] as const) {
    counts[stage] = [...(sessionsByStage.get(stage) ?? [])].filter((sessionId) => visitSessions.has(sessionId)).length;
  }
  const rawCounts: FunnelStageCounts = { visit: 0, product_view: 0, cart: 0, ussd_intent: 0, confirmed_order: 0 };

  for (const group of rawGroups) {
    if (group.stage in rawCounts) rawCounts[group.stage as keyof FunnelStageCounts] = group._count._all;
  }
  rawCounts.confirmed_order = rawGroups.find((group) => group.stage === "confirmed_order")?._count._all ?? 0;

  const ussdOrderIds = new Set(
    ussdIntentOrders.flatMap((group) =>
      group.orderId && group.sessionId && !group.sessionId.startsWith("order_") && visitSessions.has(group.sessionId)
        ? [group.orderId]
        : [],
    ),
  );
  const confirmedUssdOrders = new Set(
    matchingConfirmedOrders
      .filter((group) => group.orderId && ussdOrderIds.has(group.orderId))
      .map((group) => group.orderId)
      .filter((id): id is string => Boolean(id)),
  ).size;

  return computeFunnelRates(counts, rawCounts, {
    intents: ussdOrderIds.size,
    confirmed: confirmedUssdOrders,
  });
}
