import type { Vendor } from "@prisma/client";

/**
 * Subscription state derived from the Vendor row. Keep all logic that asks
 * "is this vendor allowed to do X?" in one place so paywalls + UI agree.
 */

export type Entitlement = {
  /** Friendly badge label */
  status: "trialing" | "trial_expired" | "active" | "past_due" | "canceled" | "incomplete" | "unknown";
  /** Whether the vendor has full feature access right now */
  active: boolean;
  /** Days remaining in trial (negative if expired) */
  trialDaysRemaining: number | null;
  /** Human-readable summary for UI */
  summary: string;
};

const TRIAL_LEN_DAYS = 30;

export function getEntitlement(vendor: Vendor): Entitlement {
  const now = new Date();

  if (vendor.subscriptionStatus === "active") {
    return {
      status: "active",
      active: true,
      trialDaysRemaining: null,
      summary: vendor.currentPeriodEnd
        ? `Renews ${vendor.currentPeriodEnd.toLocaleDateString()}`
        : "Subscription active",
    };
  }

  if (vendor.subscriptionStatus === "past_due") {
    return {
      status: "past_due",
      active: false,
      trialDaysRemaining: null,
      summary: "Payment failed — please update your card to keep your shop active.",
    };
  }

  if (vendor.subscriptionStatus === "canceled") {
    return {
      status: "canceled",
      active: false,
      trialDaysRemaining: null,
      summary: "Subscription cancelled — resubscribe to keep selling.",
    };
  }

  if (vendor.subscriptionStatus === "incomplete") {
    return {
      status: "incomplete",
      active: false,
      trialDaysRemaining: null,
      summary: "Subscription incomplete — finish checkout to activate.",
    };
  }

  if (vendor.subscriptionStatus === "trialing") {
    const end = vendor.trialEndsAt;
    if (!end) {
      return {
        status: "trialing",
        active: true,
        trialDaysRemaining: null,
        summary: "Free trial",
      };
    }
    const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60_000));
    if (daysLeft <= 0) {
      return {
        status: "trial_expired",
        active: false,
        trialDaysRemaining: daysLeft,
        summary: "Trial ended — subscribe to keep selling.",
      };
    }
    return {
      status: "trialing",
      active: true,
      trialDaysRemaining: daysLeft,
      summary: `${daysLeft} day${daysLeft === 1 ? "" : ""} left in your free trial`,
    };
  }

  return {
    status: "unknown",
    active: false,
    trialDaysRemaining: null,
    summary: "Subscription status unknown",
  };
}

export function newVendorTrialDates(now = new Date()) {
  return {
    subscriptionStatus: "trialing" as const,
    trialEndsAt: new Date(now.getTime() + TRIAL_LEN_DAYS * 24 * 60 * 60_000),
  };
}

/**
 * Japora pricing — success-based, Togo-first (XOF). See gtm/01-PRICING.md for
 * the persona/market reasoning. Two tiers:
 *
 *   Starter (free): catalog + bot + orders + marketplace. Payment is
 *     vendor-direct (their own T-Money / Flooz) — Japora takes 0%.
 *   Pro (pay-as-you-sell): inline payment routed through Japora. A single
 *     all-in fee on each PAID order (covers mobile-money processing + a thin
 *     Japora margin), so the vendor "keeps 97%". No monthly fee.
 *
 * The fee is FREE under a small-order floor and CAPPED per order, so tiny sales
 * aren't taxed and big sales aren't punished. Amounts are XOF francs × 100
 * (the app's integer "cents"); XOF is zero-decimal — see src/lib/currency.ts.
 */
export const PRICING = {
  /** Pro all-in fee on a routed paid order. */
  proRatePct: 0.03, // 3% → "keep 97%"
  /** Orders below this pay no fee (don't tax tiny sales). 2,000 XOF. */
  freeBelowCents: 200_000,
  /** Fee never exceeds this per order (don't punish big sales). 1,000 XOF. */
  feeCapCents: 100_000,
  /** Display currency for the marketing/pricing surfaces (launch market). */
  displayCurrency: "XOF",
} as const;

/** Whole-percent display, e.g. 3 and 97. */
export const PRICING_FEE_PERCENT = Math.round(PRICING.proRatePct * 100);
export const PRICING_KEEP_PERCENT = 100 - PRICING_FEE_PERCENT;

/**
 * Free marketing-broadcast recipients per vendor per calendar month. Broadcasts
 * (new-drop blasts, follower notifies) are the one notification category that is
 * always a paid WhatsApp Marketing template and scales with audience size — so
 * we give a free allowance, then it's vendor-funded / Pro. See
 * gtm/02-NOTIFICATIONS.md. Env-tunable.
 */
export function freeBroadcastRecipientsPerMonth(): number {
  const n = Number(process.env.JAPORA_FREE_BROADCAST_RECIPIENTS);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

/**
 * Japora's fee on a Pro-tier routed paid order, in cents — floor + cap applied.
 * `ratePct` lets a vendor be on a bespoke rate (Vendor.commissionPct); defaults
 * to the standard Pro rate.
 */
export function computeCommissionCents(totalCents: number, ratePct: number = PRICING.proRatePct): number {
  if (!Number.isFinite(totalCents) || totalCents < PRICING.freeBelowCents) return 0;
  const raw = Math.round(totalCents * ratePct);
  return Math.min(raw, PRICING.feeCapCents);
}
