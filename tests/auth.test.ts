import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateEmail, validatePassword } from "../src/lib/auth";

describe("validateEmail", () => {
  test("accepts well-formed addresses", () => {
    assert.ok(validateEmail("ada@japora.app"));
    assert.ok(validateEmail("ada+wholesale@japora.app"));
    assert.ok(validateEmail("a.b-c@sub.example.co"));
  });

  test("rejects garbage", () => {
    assert.equal(validateEmail("not-an-email"), false);
    assert.equal(validateEmail("@nodomain.com"), false);
    assert.equal(validateEmail("missing@tld"), false);
    assert.equal(validateEmail(""), false);
  });

  test("rejects absurdly long addresses", () => {
    const long = "a".repeat(260) + "@example.com";
    assert.equal(validateEmail(long), false);
  });
});

describe("validatePassword", () => {
  test("requires 8+ chars", () => {
    const r = validatePassword("ab1");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /8 characters/);
  });

  test("requires a letter", () => {
    const r = validatePassword("12345678");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /letter/);
  });

  test("requires a digit", () => {
    const r = validatePassword("abcdefgh");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.reason, /number/);
  });

  test("accepts compliant passwords", () => {
    assert.equal(validatePassword("ada1234x").ok, true);
    assert.equal(validatePassword("Pass-Word-99").ok, true);
  });

  test("caps very long passwords", () => {
    const r = validatePassword("a1" + "x".repeat(250));
    assert.equal(r.ok, false);
  });
});
