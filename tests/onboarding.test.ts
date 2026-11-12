import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  getStoreSetupStatus,
  isPlaceholderShopName,
  isStoreSetupComplete,
  normalizeWhatsAppNumber,
  validateStoreSetupInput,
} from "../src/lib/onboarding";
import { digitsOnly, waMeLink } from "../src/lib/utils";

describe("store setup onboarding completion logic", () => {
  test("complete Vendor returns complete=true and no missing fields", () => {
    const completeVendor = {
      shopName: "Amina Wax Lomé",
      whatsappNumber: "22890123456",
      region: "lome",
      category: "fashion",
    };
    const status = getStoreSetupStatus(completeVendor);
    assert.equal(status.complete, true);
    assert.deepEqual(status.missingFields, []);
    assert.equal(isStoreSetupComplete(completeVendor), true);
  });

  test("incomplete Vendor with fallback 'My Shop' or missing fields triggers onboarding", () => {
    assert.equal(isPlaceholderShopName("My Shop"), true);
    assert.equal(isPlaceholderShopName("  my shop  "), true);
    assert.equal(isPlaceholderShopName(""), true);
    assert.equal(isPlaceholderShopName("Amina Wax"), false);

    const provisionedGoogleVendor = {
      shopName: "My Shop",
      whatsappNumber: "",
      region: "",
      category: "",
    };
    const status = getStoreSetupStatus(provisionedGoogleVendor);
    assert.equal(status.complete, false);
    assert.deepEqual(status.missingFields, [
      "shopName",
      "whatsappNumber",
      "region",
      "category",
    ]);
    assert.equal(isStoreSetupComplete(provisionedGoogleVendor), false);
  });

  test("Vendor from signup with shopName, whatsappNumber, and category but missing region is incomplete", () => {
    const signupVendor = {
      shopName: "Kossi Electronics",
      whatsappNumber: "+22891223344",
      region: "",
      category: "electronics",
    };
    const status = getStoreSetupStatus(signupVendor);
    assert.equal(status.complete, false);
    assert.deepEqual(status.missingFields, ["region"]);
  });

  test("validateStoreSetupInput normalizes WhatsApp number to E.164 and validates taxonomy slugs", () => {
    const invalidShop = validateStoreSetupInput({
      shopName: "My Shop",
      whatsappNumber: "+22890123456",
      region: "lome",
      category: "fashion",
    });
    assert.equal(invalidShop.ok, false);
    if (!invalidShop.ok) assert.equal(invalidShop.field, "shopName");

    const invalidPhone = validateStoreSetupInput({
      shopName: "Kossi Shop",
      whatsappNumber: "123",
      region: "lome",
      category: "fashion",
    });
    assert.equal(invalidPhone.ok, false);
    if (!invalidPhone.ok) assert.equal(invalidPhone.field, "whatsappNumber");

    const invalidRegion = validateStoreSetupInput({
      shopName: "Kossi Shop",
      whatsappNumber: "+22890123456",
      region: "invalid-region",
      category: "fashion",
    });
    assert.equal(invalidRegion.ok, false);
    if (!invalidRegion.ok) assert.equal(invalidRegion.field, "region");

    const valid = validateStoreSetupInput({
      shopName: "  Kossi Shop  ",
      whatsappNumber: "228 90 12 34 56",
      region: "lome",
      category: "fashion",
    });
    assert.equal(valid.ok, true);
    if (valid.ok) {
      assert.equal(valid.payload.shopName, "Kossi Shop");
      assert.equal(valid.payload.whatsappNumber, "+22890123456");
      assert.equal(valid.payload.region, "lome");
      assert.equal(valid.payload.category, "fashion");

      // Simulate PATCH /api/settings persistence (which stores digitsOnly for whatsappNumber)
      const persistedVendor = {
        shopName: valid.payload.shopName,
        whatsappNumber: digitsOnly(valid.payload.whatsappNumber),
        region: valid.payload.region,
        category: valid.payload.category,
      };
      assert.equal(isStoreSetupComplete(persistedVendor), true);
      assert.equal(
        waMeLink(persistedVendor.whatsappNumber, "Order #123"),
        "https://wa.me/22890123456?text=Order%20%23123",
      );
    }
  });

  test("normalizeWhatsAppNumber handles E.164 and digits-only strings", () => {
    assert.deepEqual(normalizeWhatsAppNumber("+228 90-12-34-56"), {
      e164: "+22890123456",
      digits: "22890123456",
      valid: true,
    });
    assert.deepEqual(normalizeWhatsAppNumber("12345"), {
      e164: "+12345",
      digits: "12345",
      valid: false,
    });
  });
});

