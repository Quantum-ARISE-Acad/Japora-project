import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { computeDeposit, computeBalanceDue } from "../src/lib/preorder";

describe("computeDeposit", () => {
  test("50% deposit on 1 unit", () => {
    const d = computeDeposit(
      { priceCents: 1000000, preOrderAllowed: true, depositPercent: 50 },
      1,
    );
    assert.equal(d, 500000);
  });

  test("3 units × 30% deposit", () => {
    const d = computeDeposit(
      { priceCents: 250000, preOrderAllowed: true, depositPercent: 30 },
      3,
    );
    // floor(250000 * 3 * 30 / 100) = floor(225000) = 225000
    assert.equal(d, 225000);
  });

  test("0 when pre-orders disabled", () => {
    const d = computeDeposit(
      { priceCents: 1000000, preOrderAllowed: false, depositPercent: 50 },
      1,
    );
    assert.equal(d, 0);
  });

  test("0 when deposit percent is 0", () => {
    const d = computeDeposit(
      { priceCents: 1000000, preOrderAllowed: true, depositPercent: 0 },
      1,
    );
    assert.equal(d, 0);
  });

  test("clamps depositPercent above 100", () => {
    const d = computeDeposit(
      { priceCents: 100000, preOrderAllowed: true, depositPercent: 150 },
      1,
    );
    assert.equal(d, 100000); // capped at 100%
  });
});

describe("computeBalanceDue", () => {
  test("subtracts paidCents from totalCents", () => {
    assert.equal(computeBalanceDue({ totalCents: 1000000, paidCents: 400000 }), 600000);
  });
  test("clamps negative balance to 0", () => {
    assert.equal(computeBalanceDue({ totalCents: 100, paidCents: 999 }), 0);
  });
  test("handles zero paid", () => {
    assert.equal(computeBalanceDue({ totalCents: 12345, paidCents: 0 }), 12345);
  });
});
