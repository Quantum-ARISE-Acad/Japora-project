import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { normalizeJoinCode, __testing } from "../src/lib/cooperative";

const { parsePhoneList, generateCode } = __testing;

describe("cooperative helpers", () => {
  test("normalizeJoinCode upper-cases and trims", () => {
    assert.equal(normalizeJoinCode("  ab12cd "), "AB12CD");
    assert.equal(normalizeJoinCode(""), "");
  });

  test("parsePhoneList splits on commas, spaces, newlines", () => {
    const list = parsePhoneList("+228 90 00 00 00\n+228911111111, 22892222222");
    assert.deepEqual(list, ["22890000000", "228911111111", "22892222222"]);
  });

  test("parsePhoneList drops invalid + de-dupes", () => {
    const list = parsePhoneList("123, 22890000000, 22890000000, abc");
    // "123" too short, duplicate collapsed, "abc" → empty
    assert.deepEqual(list, ["22890000000"]);
  });

  test("parsePhoneList handles empty input", () => {
    assert.deepEqual(parsePhoneList(""), []);
    assert.deepEqual(parsePhoneList("   "), []);
  });

  test("generated join codes use the readable alphabet", () => {
    for (let i = 0; i < 50; i++) {
      assert.match(generateCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });
});
