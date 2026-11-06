import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { rateLimit } from "../src/lib/ratelimit";

describe("rateLimit — in-process sliding window", () => {
  test("allows up to the limit, blocks the (N+1)th", () => {
    const key = `t1:${Math.random()}`;
    let last;
    for (let i = 1; i <= 5; i++) {
      last = rateLimit({ key, limit: 5, windowMs: 60_000 });
      assert.ok(last.allowed, `attempt ${i} should be allowed`);
    }
    const sixth = rateLimit({ key, limit: 5, windowMs: 60_000 });
    assert.equal(sixth.allowed, false);
    assert.ok((sixth.retryAfterSeconds ?? 0) > 0);
  });

  test("different keys do not interfere", () => {
    const a = `t2-a:${Math.random()}`;
    const b = `t2-b:${Math.random()}`;
    rateLimit({ key: a, limit: 1, windowMs: 60_000 });
    rateLimit({ key: a, limit: 1, windowMs: 60_000 }); // blocked
    const fresh = rateLimit({ key: b, limit: 1, windowMs: 60_000 });
    assert.ok(fresh.allowed, "b should be untouched by a's hits");
  });

  test("window expiry resets the bucket", async () => {
    const key = `t3:${Math.random()}`;
    rateLimit({ key, limit: 1, windowMs: 30 });
    const blocked = rateLimit({ key, limit: 1, windowMs: 30 });
    assert.equal(blocked.allowed, false);
    await new Promise((r) => setTimeout(r, 50));
    const after = rateLimit({ key, limit: 1, windowMs: 30 });
    assert.ok(after.allowed, "should be allowed after window expires");
  });

  test("remaining decrements correctly", () => {
    const key = `t4:${Math.random()}`;
    const r1 = rateLimit({ key, limit: 3, windowMs: 60_000 });
    const r2 = rateLimit({ key, limit: 3, windowMs: 60_000 });
    const r3 = rateLimit({ key, limit: 3, windowMs: 60_000 });
    assert.equal(r1.remaining, 2);
    assert.equal(r2.remaining, 1);
    assert.equal(r3.remaining, 0);
  });
});
