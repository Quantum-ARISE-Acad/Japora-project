import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkWhatsAppNumber,
  formatStoredWhatsAppNumber,
  isStoredWhatsAppNumberValid,
} from "../src/lib/whatsapp-number";
import { validateStoreSetupInput, getStoreSetupStatus } from "../src/lib/onboarding";
import { shopWhatsAppLink } from "../src/lib/shop-picker";

test("a number with its country code is accepted and stored as digits", () => {
  for (const input of ["+228 93 58 64 24", "+22893586424", "0022893586424", "+228-93-58-64-24"]) {
    const r = checkWhatsAppNumber(input);
    assert.ok(r.ok, input);
    if (r.ok) {
      assert.equal(r.digits, "22893586424");
      assert.equal(r.e164, "+22893586424");
    }
  }
});

test("a number without a country code is refused (the +93 QR code bug)", () => {
  for (const input of ["93 58 64 24", "93586424", "22893586424"]) {
    const r = checkWhatsAppNumber(input);
    assert.equal(r.ok, false, input);
    if (!r.ok) assert.match(r.error, /indicatif du pays/);
  }
});

test("a number whose length does not fit the country is refused", () => {
  // "+" added in front of a local Togo number reads as Afghanistan (+93) and is too short.
  assert.equal(checkWhatsAppNumber("+93586424").ok, false);
  assert.equal(checkWhatsAppNumber("+228 90 12").ok, false);
});

test("an empty number is refused", () => {
  assert.equal(checkWhatsAppNumber("").ok, false);
  assert.equal(checkWhatsAppNumber("   ").ok, false);
});

test("saved numbers: valid only with a real country code", () => {
  assert.equal(isStoredWhatsAppNumberValid("22893586424"), true);
  assert.equal(isStoredWhatsAppNumberValid("93586424"), false);
  assert.equal(isStoredWhatsAppNumberValid(""), false);
  assert.equal(formatStoredWhatsAppNumber("22893586424"), "+22893586424");
  assert.equal(formatStoredWhatsAppNumber("93586424"), "93586424");
});

test("store setup refuses a number without country code", () => {
  const base = { shopName: "Chez Jeanne", region: "lome", category: "fashion" };
  const bad = validateStoreSetupInput({ ...base, whatsappNumber: "93 58 64 24" });
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.field, "whatsappNumber");
  const good = validateStoreSetupInput({ ...base, whatsappNumber: "+228 93 58 64 24" });
  assert.ok(good.ok);
});

test("a shop saved without country code must finish store setup again", () => {
  const status = getStoreSetupStatus({
    shopName: "Chez Jeanne",
    whatsappNumber: "93586424",
    region: "lome",
    category: "fashion",
  });
  assert.equal(status.complete, false);
  assert.deepEqual(status.missingFields, ["whatsappNumber"]);
});

test("no WhatsApp QR link is built from a number without country code", () => {
  const opts = { shopName: "Chez Jeanne", shopSlug: "chez-jeanne" };
  assert.equal(shopWhatsAppLink({ ...opts, vendorNumber: "93586424" }), null);
  const link = shopWhatsAppLink({ ...opts, vendorNumber: "22893586424" });
  assert.ok(link?.url.startsWith("https://wa.me/22893586424?"));
});
