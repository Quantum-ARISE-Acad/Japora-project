import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  counterMessage,
  decideOffer,
  extractOfferAmount,
  isAcceptance,
  looksLikeBareOffer,
} from "../src/lib/bargaining";
import { wantsAssistantBack, wantsHumanSeller } from "../src/lib/handoff";
import { normalizeHistory, parseImageMatch } from "../src/lib/llm";

// Shown price 10 000 XOF, secret minimum 8 000 XOF (amounts in cents).
const base = { priceCents: 1_000_000, floorCents: 800_000, currency: "XOF", lastCounterCents: 0 };

describe("automatic bargaining", () => {
  test("an offer at or above the minimum is accepted at the offered price", () => {
    assert.deepEqual(decideOffer({ ...base, offerCents: 850_000, round: 0 }), { kind: "accept", unitCents: 850_000 });
    assert.deepEqual(decideOffer({ ...base, offerCents: 800_000, round: 0 }), { kind: "accept", unitCents: 800_000 });
  });

  test("an offer above the shown price never charges more than the shown price", () => {
    assert.deepEqual(decideOffer({ ...base, offerCents: 1_200_000, round: 0 }), { kind: "accept", unitCents: 1_000_000 });
  });

  test("counter-offers move towards the minimum in three rounds, never below", () => {
    const r1 = decideOffer({ ...base, offerCents: 500_000, round: 0 });
    assert.equal(r1.kind, "counter");
    if (r1.kind !== "counter") return;
    assert.equal(r1.unitCents, 920_000); // 10 000 − 40 % of 2 000
    assert.equal(r1.final, false);

    const r2 = decideOffer({ ...base, offerCents: 600_000, round: r1.round, lastCounterCents: r1.unitCents });
    assert.equal(r2.kind, "counter");
    if (r2.kind !== "counter") return;
    assert.equal(r2.unitCents, 860_000); // 10 000 − 70 % of 2 000

    const r3 = decideOffer({ ...base, offerCents: 600_000, round: r2.round, lastCounterCents: r2.unitCents });
    assert.equal(r3.kind, "counter");
    if (r3.kind !== "counter") return;
    assert.equal(r3.unitCents, 800_000);
    assert.equal(r3.final, true);

    const r4 = decideOffer({ ...base, offerCents: 100_000, round: r3.round, lastCounterCents: r3.unitCents });
    assert.equal(r4.kind === "counter" && r4.unitCents, 800_000);
  });

  test("a counter-offer never goes back up", () => {
    const r = decideOffer({ ...base, offerCents: 500_000, round: 0, lastCounterCents: 850_000 });
    assert.equal(r.kind === "counter" && r.unitCents, 850_000);
  });

  test("counter-offers are rounded up to 50 XOF and stay within [minimum, price]", () => {
    const r = decideOffer({ priceCents: 1_234_500, floorCents: 1_000_000, offerCents: 100, round: 0, lastCounterCents: 0, currency: "XOF" });
    assert.equal(r.kind, "counter");
    if (r.kind !== "counter") return;
    assert.equal(r.unitCents % 5000, 0);
    assert.ok(r.unitCents >= 1_000_000 && r.unitCents <= 1_234_500);
  });

  test("a minimum equal to the shown price means no discount", () => {
    const r = decideOffer({ ...base, floorCents: 1_000_000, offerCents: 900_000, round: 0 });
    assert.equal(r.kind === "counter" && r.unitCents, 1_000_000);
  });

  test("offers are read from market phrasing", () => {
    assert.equal(extractOfferAmount("je te donne 8000"), 8000);
    assert.equal(extractOfferAmount("8 500 f"), 8500);
    assert.equal(extractOfferAmount("ok pour 12.000"), 12000);
    assert.equal(extractOfferAmount("2 robes"), null);
    assert.equal(looksLikeBareOffer("8500"), true);
    assert.equal(looksLikeBareOffer("ok 8500 alors"), true);
    assert.equal(looksLikeBareOffer("est-ce que vous livrez à Lomé pour 1000 personnes ce weekend"), false);
  });

  test("acceptance is a short yes without an amount or a doubt", () => {
    assert.equal(isAcceptance("ok"), true);
    assert.equal(isAcceptance("D'accord !"), true);
    assert.equal(isAcceptance("ça marche"), true);
    assert.equal(isAcceptance("ok 8500"), false);
    assert.equal(isAcceptance("ok mais c'est trop cher"), false);
    assert.equal(isAcceptance("non"), false);
    assert.equal(isAcceptance("je vais réfléchir"), false);
  });

  test("the last counter-offer says it is the last price", () => {
    assert.match(
      counterMessage({ productName: "Robe", offerLabel: "5 000", counterLabel: "8 000", round: 3, final: true }),
      /dernier prix/,
    );
  });
});

describe("hand-off to the vendor", () => {
  test("detects a request for the seller", () => {
    assert.equal(wantsHumanSeller("Je veux parler au vendeur svp"), true);
    assert.equal(wantsHumanSeller("je peux parler à quelqu'un ?"), true);
    assert.equal(wantsHumanSeller("HANDOFF"), true);
    assert.equal(wantsHumanSeller("c'est combien la robe"), false);
  });

  test("detects the way back to the assistant", () => {
    assert.equal(wantsAssistantBack("Assistant"), true);
    assert.equal(wantsAssistantBack("reprendre l'assistant"), true);
    assert.equal(wantsAssistantBack("l'assistant est nul"), false);
  });
});

describe("conversation memory and photo answers", () => {
  test("history merges turns, starts with the customer and drops the trailing question", () => {
    const h = normalizeHistory([
      { role: "assistant", text: "Bienvenue" },
      { role: "customer", text: "Vous avez des robes ?" },
      { role: "customer", text: "en coton" },
      { role: "assistant", text: "Oui, la robe Ankara à 8 000." },
      { role: "customer", text: "et en rouge ?" },
    ]);
    assert.deepEqual(h, [
      { role: "customer", text: "Vous avez des robes ?\nen coton" },
      { role: "assistant", text: "Oui, la robe Ankara à 8 000." },
    ]);
  });

  test("photo matches keep only real catalog ids", () => {
    const m = parseImageMatch('{"description":"robe rouge","productIds":["p1","fake","p2"]}', new Set(["p1", "p2"]));
    assert.deepEqual(m, { description: "robe rouge", productIds: ["p1", "p2"] });
    assert.equal(parseImageMatch("pas du json", new Set()), null);
  });
});
