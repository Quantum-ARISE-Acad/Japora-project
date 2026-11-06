import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  parsePriceToCents,
  slugify,
  parseSizes,
  waMeLink,
  digitsOnly,
  formatMoney,
  isOrderStatus,
} from "../src/lib/utils";

describe("parsePriceToCents", () => {
  test("converts whole-naira string to cents", () => {
    assert.equal(parsePriceToCents("12000"), 1200000);
  });
  test("handles decimals", () => {
    assert.equal(parsePriceToCents("25.50"), 2550);
  });
  test("strips currency symbols + commas", () => {
    assert.equal(parsePriceToCents("₦12,500"), 1250000);
  });
  test("rejects negatives + non-finite", () => {
    assert.equal(parsePriceToCents("-50"), 0);
    assert.equal(parsePriceToCents("abc"), 0);
  });
});

describe("slugify", () => {
  test("normalizes to URL-safe", () => {
    assert.equal(slugify("Ada's Fashion House"), "adas-fashion-house");
    assert.equal(slugify("  Lagos Plug 🇳🇬 "), "lagos-plug");
  });
  test("falls back to shop when empty", () => {
    assert.equal(slugify("@@@"), "shop");
    assert.equal(slugify(""), "shop");
  });
  test("caps length at 40", () => {
    const s = slugify("a".repeat(80));
    assert.ok(s.length <= 40);
  });
});

describe("parseSizes", () => {
  test("splits + trims", () => {
    assert.deepEqual(parseSizes("S, M, L , XL"), ["S", "M", "L", "XL"]);
  });
  test("drops empties", () => {
    assert.deepEqual(parseSizes(",,M,,"), ["M"]);
  });
});

describe("waMeLink", () => {
  test("strips non-digits + url-encodes text", () => {
    const link = waMeLink("+234 801-234-5678", "Hi there");
    assert.equal(link, "https://wa.me/2348012345678?text=Hi%20there");
  });
  test("no text → bare link", () => {
    assert.equal(waMeLink("2348012345678"), "https://wa.me/2348012345678");
  });
});

describe("digitsOnly", () => {
  test("strips formatting", () => {
    assert.equal(digitsOnly("+234 (801) 234-5678"), "2348012345678");
  });
});

describe("formatMoney", () => {
  test("formats with currency symbol", () => {
    // Format depends on locale; check that the number renders with comma, space or narrow space.
    const out = formatMoney(1850000, "NGN");
    assert.match(out, /18[\s\u202F,]?500/);
  });

  test("safely handles bogus input", () => {
    const out = formatMoney(Number.NaN, "USD");
    assert.match(out, /0|0\.00/);
  });
});

describe("isOrderStatus", () => {
  test("accepts known statuses", () => {
    assert.ok(isOrderStatus("NEW"));
    assert.ok(isOrderStatus("PAID"));
  });
  test("rejects unknown", () => {
    assert.equal(isOrderStatus("MAYBE_PAID"), false);
  });
});
