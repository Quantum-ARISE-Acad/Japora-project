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
      { name: "Lomé Centre", feeCents: 1000 },
      { name: "Agoè", feeCents: 1500 },
      { name: "Baguida", feeCents: 2000 },
      { name: "Adidogomé", feeCents: 1200 },
    ]);
  });

  test("falls back to defaultFeeCents when a zone omits price", () => {
    const zones = parseDeliveryZones("Lomé, Kpalimé, Kara: 2500", 1000);
    assert.deepEqual(zones, [
      { name: "Lomé", feeCents: 1000 },
      { name: "Kpalimé", feeCents: 1000 },
      { name: "Kara", feeCents: 2500 },
    ]);
  });

  test("rounds fractional fee values to nearest integer", () => {
    const zones = parseDeliveryZones("Plateau: 1499.6");
    assert.deepEqual(zones, [{ name: "Plateau", feeCents: 1500 }]);
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
    assert.equal(calculateDeliveryFee(vendor, "agoè"), 1500);
    assert.equal(calculateDeliveryFee(vendor, "BAGUIDA"), 2000);
    assert.equal(calculateDeliveryFee(vendor, "lomé centre"), 800);
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

