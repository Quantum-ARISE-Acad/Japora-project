import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { extractRef, stripRef, goPath, prefillText, __testing } from "../src/lib/campaigns";

describe("campaign reactivation Prisma schema regression", () => {
  test("Customer query fields and activity relation exist in the generated client", () => {
    const customer = Prisma.dmmf.datamodel.models.find((model) => model.name === "Customer");
    assert.ok(customer, "generated Prisma client must include Customer");

    const fields = new Set(customer.fields.map((field) => field.name));
    for (const field of [
      "vendorId",
      "deletedAt",
      "phone",
      "marketingConsent",
      "marketingConsentRevokedAt",
      "lastOrderAt",
      "orders",
      "funnelEvents",
    ]) {
      assert.ok(fields.has(field), `Customer.${field} must exist in the generated Prisma client`);
    }
  });
});

describe("campaigns ref tagging", () => {
  test("extractRef pulls the code from a pre-filled message", () => {
    assert.equal(extractRef("Hi Chez Améyo! I'd like to order. (ref: AB12CD)"), "AB12CD");
    assert.equal(extractRef("hello (ref:xy9z8)"), "XY9Z8");
  });

  test("extractRef returns null when there is no tag", () => {
    assert.equal(extractRef("just a normal message"), null);
    assert.equal(extractRef(""), null);
  });

  test("stripRef removes the tag and collapses whitespace", () => {
    assert.equal(stripRef("I want the gown (ref: AB12CD)"), "I want the gown");
    assert.equal(stripRef("price?  (ref: ZZ99)  thanks"), "price? thanks");
  });

  test("stripRef leaves untagged text untouched", () => {
    assert.equal(stripRef("how much is the bag"), "how much is the bag");
  });

  test("goPath builds the trackable path", () => {
    assert.equal(goPath("ABC123"), "/go/ABC123");
  });

  test("prefillText includes the product name and ref tag", () => {
    const t = prefillText({ shopName: "Chez Améyo", productName: "Ankara Gown", refCode: "AB12CD" });
    assert.match(t, /Chez Améyo/);
    assert.match(t, /Ankara Gown/);
    assert.match(t, /\(ref: AB12CD\)/);
    // The tag must round-trip through extractRef.
    assert.equal(extractRef(t), "AB12CD");
  });

  test("prefillText without a product still carries the ref", () => {
    const t = prefillText({ shopName: "Shop", refCode: "QQ11" });
    assert.equal(extractRef(t), "QQ11");
  });

  test("generated codes use the readable alphabet", () => {
    for (let i = 0; i < 50; i++) {
      assert.match(__testing.generateCode(), /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
    }
  });

  test("campaign attribution expires after the agreed seven-day window", () => {
    assert.equal(__testing.TOUCH_WINDOW_MS, 7 * 24 * 60 * 60 * 1000);
  });
});
