import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseDeliveryZones, calculateDeliveryFee } from "../src/lib/delivery";
import { computeLoyalty } from "../src/lib/loyalty";
import { normalizePhone, isValidPhone } from "../src/lib/otp";

describe("delivery calculations", () => {
  test("parseDeliveryZones parses comma-separated names and prices", () => {
    const raw = "Lomé Centre: 1000, Agoè: 1500, Baguida: 2000";
    const zones = parseDeliveryZones(raw, 500);
    assert.equal(zones.length, 3);
    assert.deepEqual(zones[0], { name: "Lomé Centre", feeCents: 1000 });
    assert.deepEqual(zones[1], { name: "Agoè", feeCents: 1500 });
    assert.deepEqual(zones[2], { name: "Baguida", feeCents: 2000 });
  });

  test("parseDeliveryZones falls back to default fee when no price specified", () => {
    const raw = "Lomé, Kpalimé, Kara";
    const zones = parseDeliveryZones(raw, 1200);
    assert.equal(zones.length, 3);
    assert.equal(zones[0].feeCents, 1200);
    assert.equal(zones[1].feeCents, 1200);
  });

  test("calculateDeliveryFee respects deliveryEnabled flag", () => {
    const disabledVendor = {
      deliveryEnabled: false,
      deliveryFeeCents: 1500,
      deliveryZones: "Centre: 1000",
    };
    assert.equal(calculateDeliveryFee(disabledVendor, "Centre"), 0);

    const enabledVendor = {
      deliveryEnabled: true,
      deliveryFeeCents: 800,
      deliveryZones: "Centre: 1000, Banlieue: 2000",
    };
    assert.equal(calculateDeliveryFee(enabledVendor, "Centre"), 1000);
    assert.equal(calculateDeliveryFee(enabledVendor, "Banlieue"), 2000);
    assert.equal(calculateDeliveryFee(enabledVendor, "Unknown"), 800);
  });
});

describe("loyalty tiers", () => {
  test("assigns Bronze for initial customer", () => {
    const loyalty = computeLoyalty(5000 * 100);
    assert.equal(loyalty.tier, "bronze");
    assert.equal(loyalty.discountPct, 0);
  });

  test("promotes to Silver when criteria met", () => {
    const loyalty = computeLoyalty(15000 * 100);
    assert.equal(loyalty.tier, "silver");
    assert.equal(loyalty.discountPct, 5);
  });

  test("promotes to Gold for high spenders", () => {
    const loyalty = computeLoyalty(60000 * 100);
    assert.equal(loyalty.tier, "gold");
    assert.equal(loyalty.discountPct, 10);
  });
});

describe("phone validation and normalization", () => {
  test("normalizes phone numbers to clean digits", () => {
    const norm = normalizePhone("+228 90 12 34 56");
    assert.equal(norm, "22890123456");
  });

  test("validates phone format", () => {
    assert.ok(isValidPhone("+22890123456"));
    assert.ok(isValidPhone("+22997123456"));
    assert.ok(!isValidPhone("123"));
  });
});
