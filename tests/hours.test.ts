import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { isOpenNow, parseHours } from "../src/lib/hours";

// A fixed reference moment: 2026-06-05 is a Friday. 10:00 UTC.
const friday10 = new Date("2026-06-05T10:00:00Z");
const friday22 = new Date("2026-06-05T22:00:00Z");
const sunday10 = new Date("2026-06-07T10:00:00Z");

describe("isOpenNow", () => {
  test("unconfigured hours → always open", () => {
    assert.equal(isOpenNow(parseHours({}), 0, friday22), true);
    assert.equal(isOpenNow(parseHours(undefined), 0, friday10), true);
  });

  test("open within window on an allowed day", () => {
    const h = parseHours({ enabled: true, days: [1, 2, 3, 4, 5], open: "08:00", close: "20:00" });
    assert.equal(isOpenNow(h, 0, friday10), true);
  });

  test("closed outside the window", () => {
    const h = parseHours({ enabled: true, days: [1, 2, 3, 4, 5], open: "08:00", close: "20:00" });
    assert.equal(isOpenNow(h, 0, friday22), false);
  });

  test("closed on a non-business day", () => {
    const h = parseHours({ enabled: true, days: [1, 2, 3, 4, 5], open: "08:00", close: "20:00" });
    assert.equal(isOpenNow(h, 0, sunday10), false); // Sunday (0) not in days
  });

  test("tz offset shifts the wall clock", () => {
    // 22:00 UTC + 3h = 01:00 next day local → outside 08-20
    const h = parseHours({ enabled: true, days: [0,1,2,3,4,5,6], open: "08:00", close: "20:00" });
    assert.equal(isOpenNow(h, 180, friday22), false);
    // 10:00 UTC - 2h = 08:00 local → just open
    assert.equal(isOpenNow(h, -120, friday10), true);
  });

  test("overnight window wraps midnight", () => {
    const h = parseHours({ enabled: true, days: [0,1,2,3,4,5,6], open: "20:00", close: "02:00" });
    assert.equal(isOpenNow(h, 0, friday22), true); // 22:00 inside 20:00→02:00
    assert.equal(isOpenNow(h, 0, friday10), false); // 10:00 outside
  });
});
