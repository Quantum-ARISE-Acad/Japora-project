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
export function computeFunnelRates(counts: {
  visit: number;
  product_view: number;
  cart: number;
  ussd_intent: number;
  confirmed_order: number;
}): FunnelSummary {
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
    { stage: "confirmed_order", label: "5. Commandes payées & confirmées", count: conf },
  ];

  const stages: FunnelStageMetric[] = [];
  let prevCount = 0;

  for (let i = 0; i < stageDefs.length; i++) {
    const item = stageDefs[i];
    const conversionFromVisit = v > 0 ? Math.min(100, Math.round((item.count / v) * 1000) / 10) : 0;
    let stepDropOff = 0;
    if (i > 0) {
      if (prevCount > 0) {
        const retained = Math.min(prevCount, item.count);
        stepDropOff = Math.max(0, Math.round(((prevCount - retained) / prevCount) * 1000) / 10);
      } else {
        stepDropOff = 0;
      }
    }

    stages.push({
      stage: item.stage,
      label: item.label,
      count: item.count,
      rawCount: item.count,
      conversionFromVisitPct: conversionFromVisit,
      stepDropOffPct: stepDropOff,
    });

    prevCount = item.count;
  }

  const overall = v > 0 ? Math.min(100, Math.round((conf / v) * 1000) / 10) : 0;
  const ussdToPaid = u > 0 ? Math.min(100, Math.round((conf / u) * 1000) / 10) : 0;

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

  if (options?.from || options?.to) {
    whereClause.createdAt = {};
    if (options.from) whereClause.createdAt.gte = options.from;
    if (options.to) whereClause.createdAt.lte = options.to;
  }

  // Fetch events for this vendor
  const events = await prisma.funnelEvent.findMany({
    where: whereClause,
    select: {
      stage: true,
      sessionId: true,
      orderId: true,
    },
  });

  // Track unique sessions per stage
  const sessionSets: Record<string, Set<string>> = {
    visit: new Set<string>(),
    product_view: new Set<string>(),
    cart: new Set<string>(),
    ussd_intent: new Set<string>(),
    confirmed_order: new Set<string>(),
  };

  for (const ev of events) {
    if (sessionSets[ev.stage]) {
      // For confirmed_order, if sessionId is present use it, else orderId
      const identifier = ev.stage === "confirmed_order" && ev.orderId ? ev.orderId : ev.sessionId;
      sessionSets[ev.stage].add(identifier);
    }
  }

  return computeFunnelRates({
    visit: sessionSets.visit.size,
    product_view: sessionSets.product_view.size,
    cart: sessionSets.cart.size,
    ussd_intent: sessionSets.ussd_intent.size,
    confirmed_order: sessionSets.confirmed_order.size,
  });
}
