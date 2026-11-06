import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUssdInstructions,
  ussdNetworksForCurrency,
  ussdSupportsCurrency,
  telHref,
} from "../src/lib/payments/ussd";
import { providersForCurrency, apiFallbackForCurrency } from "../src/lib/payments";

describe("USSD instructions", () => {
  test("Togo (XOF) surfaces T-Money and Flooz first", () => {
    const nets = ussdNetworksForCurrency("XOF").map((n) => n.id);
    assert.equal(nets[0], "tmoney");
    assert.equal(nets[1], "flooz");
  });

  test("builds dial steps with payee number + amount baked in", () => {
    const ins = buildUssdInstructions({
      currency: "XOF",
      payeeNumber: "+228 90 00 00 00",
      amountCents: 500000, // 5 000 CFA (zero-decimal)
    });
    assert.ok(ins.networks.length >= 2);
    const tmoney = ins.networks.find((n) => n.network.id === "tmoney")!;
    assert.equal(tmoney.dial, "*145#");
    // The merchant number and amount must appear in the step copy.
    assert.ok(tmoney.steps.some((s) => s.includes("+228 90 00 00 00")));
    assert.ok(tmoney.steps.some((s) => s.includes(ins.amountLabel)));
  });

  test("tel: href percent-encodes the # so the dialer keeps it", () => {
    assert.equal(telHref("*145#"), "tel:*145%23");
  });

  test("generates direct USSD codes for T-Money and Flooz", () => {
    const ins = buildUssdInstructions({
      currency: "XOF",
      payeeNumber: "+228 90 12 34 56",
      amountCents: 150000, // 1 500 CFA
    });
    const tmoney = ins.networks.find((n) => n.network.id === "tmoney")!;
    const flooz = ins.networks.find((n) => n.network.id === "flooz")!;

    // T-Money: *145*1*1500*90123456*1#
    assert.equal(tmoney.directDial, "*145*1*1500*90123456*1#");
    assert.equal(tmoney.directTelHref, "tel:*145*1*1500*90123456*1%23");

    // Flooz: *155*1*1*90123456*1500*1#
    assert.equal(flooz.directDial, "*155*1*1*90123456*1500*1#");
    assert.equal(flooz.directTelHref, "tel:*155*1*1*90123456*1500*1%23");

    // French steps available
    assert.ok(tmoney.frenchSteps.length >= 4);
    assert.ok(tmoney.frenchSteps.some((s) => s.includes("T-Money")));
    assert.ok(flooz.frenchSteps.length >= 4);
    assert.ok(flooz.frenchSteps.some((s) => s.includes("Flooz")));
  });

  test("USSD does not apply to non-mobile-money currencies", () => {
    assert.equal(ussdSupportsCurrency("USD"), false);
    assert.equal(ussdSupportsCurrency("XOF"), true);
  });
});

describe("payment ordering — USSD is the default", () => {
  test("USSD leads the rail list for XOF, cash closes it", () => {
    const order = providersForCurrency("XOF");
    assert.equal(order[0], "ussd");
    assert.equal(order[order.length - 1], "cash");
  });

  test("API fallback is null with no provider configured (stub-first)", () => {
    // No CinetPay/PayGate creds in the test env → no automatic fallback.
    assert.equal(apiFallbackForCurrency("XOF"), null);
  });
});
