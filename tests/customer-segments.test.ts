import assert from "node:assert/strict";
import { test } from "node:test";
import { isCustomerInactiveFor30Days, isCustomerVip } from "../src/lib/customer-segments";

const NOW = new Date("2026-10-13T12:00:00.000Z");

test("inactive customer filter requires a real order date at least 30 days old", () => {
  assert.equal(isCustomerInactiveFor30Days(null, NOW), false);
  assert.equal(isCustomerInactiveFor30Days(undefined, NOW), false);
  assert.equal(isCustomerInactiveFor30Days("not-a-date", NOW), false);
  assert.equal(isCustomerInactiveFor30Days(new Date("2026-09-13T12:00:00.000Z"), NOW), true);
  assert.equal(isCustomerInactiveFor30Days(new Date("2026-09-13T12:00:01.000Z"), NOW), false);
});

test("VIP filter uses qualifying order count rather than total order count", () => {
  assert.equal(isCustomerVip({ qualifyingOrderCount: 2, orderCount: 5 }), false);
  assert.equal(isCustomerVip({ qualifyingOrderCount: 3, orderCount: 3 }), true);
  assert.equal(isCustomerVip({ qualifyingOrderCount: 0, orderCount: 3 }), false);
});
