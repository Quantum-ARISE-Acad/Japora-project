import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getEntitlement,
  newVendorTrialDates,
  computeCommissionCents,
  PRICING,
  PRICING_FEE_PERCENT,
  PRICING_KEEP_PERCENT,
} from "../src/lib/billing";

// Minimal Vendor shape stub so we don't depend on Prisma's generated types
// at runtime. getEntitlement only reads a handful of columns.
type V = Parameters<typeof getEntitlement>[0];

function vendor(over: Partial<V> = {}): V {
  return {
    subscriptionStatus: "trialing",
    trialEndsAt: null,
    currentPeriodEnd: null,
    ...over,
  } as V;
}

describe("getEntitlement", () => {
  test("active subscription → access granted", () => {
    const e = getEntitlement(vendor({ subscriptionStatus: "active" }));
    assert.equal(e.status, "active");
    assert.equal(e.active, true);
  });

  test("past_due → blocked with friendly message", () => {
    const e = getEntitlement(vendor({ subscriptionStatus: "past_due" }));
    assert.equal(e.status, "past_due");
    assert.equal(e.active, false);
    assert.match(e.summary, /Payment failed/);
  });

  test("trialing within window → active with day count", () => {
    const futureEnd = new Date(Date.now() + 5 * 24 * 60 * 60_000);
    const e = getEntitlement(
      vendor({ subscriptionStatus: "trialing", trialEndsAt: futureEnd }),
    );
    assert.equal(e.active, true);
    assert.ok((e.trialDaysRemaining ?? 0) >= 4 && (e.trialDaysRemaining ?? 0) <= 5);
  });

  test("trial expired → blocked", () => {
    const pastEnd = new Date(Date.now() - 24 * 60 * 60_000);
    const e = getEntitlement(
      vendor({ subscriptionStatus: "trialing", trialEndsAt: pastEnd }),
    );
    assert.equal(e.status, "trial_expired");
    assert.equal(e.active, false);
  });

  test("canceled → blocked", () => {
    const e = getEntitlement(vendor({ subscriptionStatus: "canceled" }));
    assert.equal(e.status, "canceled");
    assert.equal(e.active, false);
  });
});

describe("newVendorTrialDates", () => {
  test("returns trialing + ~30 days out", () => {
    const now = new Date("2026-01-01T00:00:00Z");
    const r = newVendorTrialDates(now);
    assert.equal(r.subscriptionStatus, "trialing");
    const days = (r.trialEndsAt.getTime() - now.getTime()) / (24 * 60 * 60_000);
    assert.equal(days, 30);
  });
});

describe("pricing — computeCommissionCents (3% all-in, floor + cap)", () => {
  test("orders under the floor pay nothing", () => {
    assert.equal(computeCommissionCents(PRICING.freeBelowCents - 1), 0);
    assert.equal(computeCommissionCents(0), 0);
    assert.equal(computeCommissionCents(100_000), 0); // 1,000 XOF < 2,000 floor
  });

  test("at/above the floor, fee is the rate", () => {
    assert.equal(computeCommissionCents(500_000), 15_000); // 5,000 XOF → 150 XOF
    assert.equal(computeCommissionCents(1_000_000), 30_000); // 10,000 XOF → 300 XOF
  });

  test("fee is capped per order", () => {
    assert.equal(computeCommissionCents(20_000_000), PRICING.feeCapCents); // huge order
  });

  test("bespoke vendor rate honoured (still floored + capped)", () => {
    assert.equal(computeCommissionCents(1_000_000, 0.02), 20_000);
    assert.equal(computeCommissionCents(100_000, 0.02), 0);
  });

  test("display percents are consistent", () => {
    assert.equal(PRICING_FEE_PERCENT, 3);
    assert.equal(PRICING_KEEP_PERCENT, 97);
    assert.equal(PRICING_FEE_PERCENT + PRICING_KEEP_PERCENT, 100);
  });
});
