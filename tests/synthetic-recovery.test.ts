import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { verifyPassword } from "../src/lib/auth";
import {
  SYNTHETIC_VENDOR_EMAIL,
  SYNTHETIC_VENDOR_PASSWORD,
  getSyntheticVendorPasswordHash,
} from "../scripts/synthetic-recovery-demo";

describe("synthetic recovery credentials", () => {
  test("synthetic vendor uses a bcrypt password hash that matches the login password", async () => {
    const passwordHash = await getSyntheticVendorPasswordHash();

    assert.equal(SYNTHETIC_VENDOR_EMAIL, "synthetic-demo@japora.test");
    assert.match(passwordHash, /^\$2[aby]?\$/);
    assert.equal(await verifyPassword(SYNTHETIC_VENDOR_PASSWORD, passwordHash), true);
  });
});
