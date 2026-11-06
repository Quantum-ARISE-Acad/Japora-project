import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { parseIntent, __testing } from "../src/lib/bot";

const { levenshtein, tokens, scoreTokens } = __testing;

describe("parseIntent — multilingual keyword routing", () => {
  test("English greeting", () => {
    assert.equal(parseIntent("hi there").intent, "greeting");
  });
  test("Pidgin greeting (how far)", () => {
    assert.equal(parseIntent("how far?").intent, "greeting");
  });
  test("Swahili menu request", () => {
    assert.equal(parseIntent("orodha tafadhali").intent, "menu");
  });
  test("French price check", () => {
    assert.equal(parseIntent("c'est combien le senateur?").intent, "price_check");
  });
  test("Pidgin order intent", () => {
    assert.equal(parseIntent("I wan buy ankara").intent, "order");
  });
  test("French order intent with quantity", () => {
    const r = parseIntent("je veux commander 2 ankara");
    assert.equal(r.intent, "order");
    assert.equal(r.quantity, 2);
  });
  test("Order tracking intent — French", () => {
    assert.equal(parseIntent("suivre ma commande").intent, "track_order");
  });
  test("Order tracking intent — by ref code", () => {
    const r = parseIntent("#AB12CD");
    assert.equal(r.intent, "track_order");
    assert.equal(r.orderRef, "ab12cd");
  });
  test("Deal proposal intent with proposed price", () => {
    const r = parseIntent("Deal Shirt à 2500 FCFA");
    assert.equal(r.intent, "propose_deal");
    assert.equal(r.proposedPrice, 2500);
  });
  test("Unpaid intent — English", () => {
    assert.equal(parseIntent("what's my balance?").intent, "unpaid");
  });
  test("Unpaid intent — Swahili", () => {
    assert.equal(parseIntent("ninakudai shillingi?").intent, "unpaid");
  });
  test("Bare product name falls through to price_check", () => {
    assert.equal(parseIntent("ankara maxi").intent, "price_check");
  });
  test("Empty input → unknown", () => {
    assert.equal(parseIntent("").intent, "unknown");
  });
  test("Mid-sentence question with menu word still routes", () => {
    const r = parseIntent("show me your catalog please");
    assert.equal(r.intent, "menu");
  });
});

describe("Levenshtein distance", () => {
  test("0 for identical", () => {
    assert.equal(levenshtein("ankara", "ankara"), 0);
  });
  test("1 for single insert", () => {
    assert.equal(levenshtein("ankra", "ankara"), 1);
  });
  test("substitution counts as 1", () => {
    assert.equal(levenshtein("ankora", "ankara"), 1);
  });
  test("handles empty strings", () => {
    assert.equal(levenshtein("", "ankara"), 6);
    assert.equal(levenshtein("ankara", ""), 6);
  });
});

describe("tokens (normalization)", () => {
  test("filters stop words", () => {
    assert.deepEqual(tokens("the blue one"), ["blue"]);
  });
  test("lowercases + strips punctuation", () => {
    assert.deepEqual(tokens("Ankara MAXI Gown!"), ["ankara", "maxi", "gown"]);
  });
  test("drops 1-char tokens", () => {
    assert.deepEqual(tokens("a b cd e"), ["cd"]);
  });
});

describe("scoreTokens — fuzzy product matching", () => {
  test("typo 'ankra' matches 'ankara maxi gown' cheaply", () => {
    const score = scoreTokens(tokens("ankra"), tokens("Ankara Maxi Gown"));
    assert.ok(score <= 1, `score=${score} should be ≤ 1`);
  });

  test("double-typo 'ankarra' still matches", () => {
    const score = scoreTokens(tokens("ankarra"), tokens("Ankara Maxi Gown"));
    assert.ok(score <= 1.5);
  });

  test("unrelated query returns Infinity", () => {
    const score = scoreTokens(tokens("toaster oven"), tokens("Ankara Maxi Gown"));
    assert.equal(score, Number.POSITIVE_INFINITY);
  });

  test("multi-word query both tokens must match", () => {
    const a = scoreTokens(tokens("aso oke"), tokens("Aso-Oke Headwrap Gele"));
    assert.ok(a <= 0.5);
    const b = scoreTokens(tokens("aso satellite"), tokens("Aso-Oke Headwrap Gele"));
    assert.equal(b, Number.POSITIVE_INFINITY);
  });
});
