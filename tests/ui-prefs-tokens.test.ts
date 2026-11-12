import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PREFS,
  parseUiPrefs,
  validateUiPrefsPatch,
  uiPrefsToCssVars,
} from "../src/lib/uiPrefs";
import { generateToken, hashToken, appUrl } from "../src/lib/token";
import {
  welcomeEmail,
  verifyEmailTemplate,
  passwordResetEmail,
  newOrderEmail,
  buyerOrderConfirmationEmail,
} from "../src/lib/email-templates";

describe("uiPrefs — parsing, clamping, and CSS custom properties", () => {
  test("returns DEFAULT_PREFS for null, primitives, or empty object", () => {
    assert.deepEqual(parseUiPrefs(null), DEFAULT_PREFS);
    assert.deepEqual(parseUiPrefs("invalid"), DEFAULT_PREFS);
    assert.deepEqual(parseUiPrefs({}), DEFAULT_PREFS);
  });

  test("clamps values into [0, 100] and handles non-finite inputs", () => {
    assert.deepEqual(
      parseUiPrefs({ motion: -20, density: 150, accentShift: "not-a-number" }),
      { motion: 0, density: 100, accentShift: 50 },
    );
  });

  test("validateUiPrefsPatch whitelists known keys and rejects non-objects", () => {
    assert.equal(validateUiPrefsPatch(null), null);
    assert.equal(validateUiPrefsPatch("bad"), null);
    const patch = validateUiPrefsPatch({ motion: 80, unknownField: 999 });
    assert.deepEqual(patch, { motion: 80 });
  });

  test("uiPrefsToCssVars computes duration, density, and hue tokens", () => {
    const vars = uiPrefsToCssVars({ motion: 50, density: 50, accentShift: 50 });
    assert.equal(vars["--aurora-dur-short"], "200ms");
    assert.equal(vars["--aurora-dur-medium"], "320ms");
    assert.equal(vars["--aurora-dur-long"], "480ms");
    assert.equal(vars["--aurora-density"], "1");
    assert.equal(vars["--aurora-accent-hue"], "0deg");

    // Zero motion still keeps a minimum 1ms duration
    const zeroMotion = uiPrefsToCssVars({ motion: 0, density: 0, accentShift: 100 });
    assert.equal(zeroMotion["--aurora-dur-short"], "1ms");
    assert.equal(zeroMotion["--aurora-density"], "0.85");
    assert.equal(zeroMotion["--aurora-accent-hue"], "25deg");
  });
});

describe("token & URL helpers", () => {
  test("generateToken produces unique URL-safe base64url tokens with matching SHA-256 hash", () => {
    const a = generateToken();
    const b = generateToken();
    assert.notEqual(a.token, b.token);
    assert.equal(a.token.length, 43);
    assert.equal(a.hash, hashToken(a.token));
    assert.match(a.hash, /^[0-9a-f]{64}$/);
  });

  test("appUrl normalizes leading slashes against NEXT_PUBLIC_APP_URL", () => {
    assert.match(appUrl("/c/ankara-queen"), /\/c\/ankara-queen$/);
    assert.match(appUrl("dashboard/orders"), /\/dashboard\/orders$/);
  });
});

describe("transactional email templates", () => {
  test("welcomeEmail includes shopName and catalogUrl in subject, html, and text", () => {
    const res = welcomeEmail({
      shopName: "Boutique Amina",
      catalogUrl: "https://japora.market/c/boutique-amina",
    });
    assert.match(res.subject, /Boutique Amina/);
    assert.match(res.html, /https:\/\/japora\.market\/c\/boutique-amina/);
    assert.match(res.text, /Boutique Amina/);
  });

  test("verifyEmailTemplate and passwordResetEmail include target URLs", () => {
    const verify = verifyEmailTemplate({ verifyUrl: "https://japora.market/verify?t=123" });
    assert.match(verify.html, /verify\?t=123/);
    assert.match(verify.text, /24 hours/);

    const reset = passwordResetEmail({
      resetUrl: "https://japora.market/reset?t=456",
      shopName: "Koffi Tech",
    });
    assert.match(reset.html, /Koffi Tech/);
    assert.match(reset.text, /reset\?t=456/);
  });

  test("newOrderEmail and buyerOrderConfirmationEmail render items and payment links", () => {
    const vendorMail = newOrderEmail({
      shopName: "Lomé Mode",
      customerName: "Yao",
      total: "15 000 FCFA",
      itemCount: 2,
      ordersUrl: "https://japora.market/dashboard/orders",
    });
    assert.match(vendorMail.subject, /15 000 FCFA from Yao/);
    assert.match(vendorMail.text, /\(2 items\)/);

    const buyerMail = buyerOrderConfirmationEmail({
      orderId: "ord_123",
      shopName: "Lomé Mode",
      customerName: "Yao",
      items: [{ name: "Chemise Lin", quantity: 2, unitPrice: "7 500 FCFA", size: "L" }],
      total: "15 000 FCFA",
      payUrl: "https://japora.market/pay/ord_123",
      vendorWhatsApp: "22890001122",
    });
    assert.match(buyerMail.subject, /Lomé Mode/);
    assert.match(buyerMail.html, /Chemise Lin \(L\) × 2/);
    assert.match(buyerMail.html, /wa\.me\/22890001122/);
    assert.match(buyerMail.text, /https:\/\/japora\.market\/pay\/ord_123/);
  });
});

