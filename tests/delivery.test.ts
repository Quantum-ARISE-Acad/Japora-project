import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseDeliveryZones, calculateDeliveryFee } from "../src/lib/delivery";

describe("parseDeliveryZones", () => {
  test("returns empty array for blank or whitespace strings", () => {
    assert.deepEqual(parseDeliveryZones(""), []);
    assert.deepEqual(parseDeliveryZones("   "), []);
  });

  test("parses comma, semicolon, and newline separated zones with explicit prices", () => {
    const zones = parseDeliveryZones("Lomé Centre: 1000, Agoè: 1500; Baguida: 2000\nAdidogomé: 1200");
    assert.deepEqual(zones, [
      { name: "Lomé Centre", feeCents: 100000 },
      { name: "Agoè", feeCents: 150000 },
      { name: "Baguida", feeCents: 200000 },
      { name: "Adidogomé", feeCents: 120000 },
    ]);
  });

  test("falls back to defaultFeeCents when a zone omits price", () => {
    const zones = parseDeliveryZones("Lomé, Kpalimé, Kara: 2500", 1000);
    assert.deepEqual(zones, [
      { name: "Lomé", feeCents: 1000 },
      { name: "Kpalimé", feeCents: 1000 },
      { name: "Kara", feeCents: 250000 },
    ]);
  });

  test("converts fractional major-unit prices to internal hundredths", () => {
    const zones = parseDeliveryZones("Plateau: 1499.6");
    assert.deepEqual(zones, [{ name: "Plateau", feeCents: 149960 }]);
  });
});

describe("calculateDeliveryFee", () => {
  test("returns 0 when deliveryEnabled is false or omitted", () => {
    assert.equal(
      calculateDeliveryFee(
        { deliveryEnabled: false, deliveryFeeCents: 1000, deliveryZones: "Agoè: 1500" },
        "Agoè",
      ),
      0,
    );
    assert.equal(calculateDeliveryFee({}, "Agoè"), 0);
  });

  test("matches zone name case-insensitively", () => {
    const vendor = {
      deliveryEnabled: true,
      deliveryFeeCents: 1000,
      deliveryZones: "Lomé Centre: 800, Agoè: 1500, Baguida: 2000",
    };
    assert.equal(calculateDeliveryFee(vendor, "agoè"), 150000);
    assert.equal(calculateDeliveryFee(vendor, "BAGUIDA"), 200000);
    assert.equal(calculateDeliveryFee(vendor, "lomé centre"), 80000);
  });

  test("falls back to deliveryFeeCents when zone is not selected or unknown", () => {
    const vendor = {
      deliveryEnabled: true,
      deliveryFeeCents: 1200,
      deliveryZones: "Agoè: 1500",
    };
    assert.equal(calculateDeliveryFee(vendor), 1200);
    assert.equal(calculateDeliveryFee(vendor, "Tsévié"), 1200);
  });
});

describe("XOF delivery amounts", () => {
  test("the same 1000 XOF fee gives the same amount by default and by zone", () => {
    const vendor = {
      deliveryEnabled: true,
      deliveryFeeCents: 100000,
      deliveryZones: "Lomé: 1000, Zone sans tarif",
    };
    assert.equal(calculateDeliveryFee(vendor), 100000);
    assert.equal(calculateDeliveryFee(vendor, "Lomé"), 100000);
    assert.equal(calculateDeliveryFee(vendor, "Zone sans tarif"), 100000);
    assert.equal(calculateDeliveryFee(vendor, "Lomé") / 100, 1000);
  });
});
