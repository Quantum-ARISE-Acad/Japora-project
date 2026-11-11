import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isZeroDecimal,
  majorUnits,
  minorUnits,
  providerMajorAmount,
  majorToCents,
} from "../src/lib/currency";
import { formatMoney } from "../src/lib/utils";

describe("isZeroDecimal", () => {
  test("XOF (Togo CFA) is zero-decimal", () => {
    assert.equal(isZeroDecimal("XOF"), true);
    assert.equal(isZeroDecimal("xof"), true); // case-insensitive
  });
  test("XAF / GNF / RWF / UGX are zero-decimal", () => {
    for (const c of ["XAF", "GNF", "RWF", "UGX"]) assert.equal(isZeroDecimal(c), true);
  });
  test("NGN / USD / GHS keep decimals", () => {
    for (const c of ["NGN", "USD", "GHS"]) assert.equal(isZeroDecimal(c), false);
  });
});

describe("majorUnits / minorUnits", () => {
  test("5,000 CFA stored as 500000 → 5000 major units", () => {
    assert.equal(majorUnits(500000), 5000);
  });
  test("minorUnits returns the stored integer (NGN kobo)", () => {
    assert.equal(minorUnits(1850000), 1850000);
  });
  test("non-finite input is safe", () => {
    assert.equal(majorUnits(Number.NaN), 0);
    assert.equal(minorUnits(Number.NaN), 0);
  });
});

describe("providerMajorAmount", () => {
  test("plain conversion (multipleOf 1)", () => {
    // 8,000 CFA stored 800000 → 8000 francs
    assert.equal(providerMajorAmount(800000), 8000);
  });
  test("CinetPay XOF multiple-of-5 rounding", () => {
    // 3,003 CFA stored 300300 → ceil to 3005 (multiple of 5)
    assert.equal(providerMajorAmount(300300, { multipleOf: 5 }), 3005);
    // already a multiple of 5 stays put
    assert.equal(providerMajorAmount(500000, { multipleOf: 5 }), 5000);
  });
  test("rounds fractional francs up, never sends 100x", () => {
    // The classic XOF bug: 5000 CFA must go out as 5000, not 500000.
    assert.equal(providerMajorAmount(500000), 5000);
    assert.notEqual(providerMajorAmount(500000), 500000);
  });
});

describe("majorToCents", () => {
  test("provider-reported 5000 XOF → 500000 stored cents", () => {
    assert.equal(majorToCents(5000), 500000);
  });
});

describe("formatMoney respects XOF zero decimals", () => {
  test("XOF renders without decimals", () => {
    const out = formatMoney(500000, "XOF");
    // Should show 5,000 / 5 000 and NOT 5,000.00
    assert.match(out, /5[\s,.]?000/);
    assert.doesNotMatch(out, /5[\s,.]?000\.00/);
  });
  test("NGN still renders normally", () => {
    const out = formatMoney(1850000, "NGN");
    assert.match(out, /18[\s,]?500/);
  });
});
