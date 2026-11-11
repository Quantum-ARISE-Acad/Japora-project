import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { t, detectLang, DEFAULT_LANG, LANG_NAMES } from "../src/lib/i18n";
import { REGIONS, CATEGORIES, findRegion, findCategory } from "../src/lib/regions";

describe("i18n — translation & language detection", () => {
  test("supports all 7 declared languages in LANG_NAMES", () => {
    assert.deepEqual(Object.keys(LANG_NAMES).sort(), ["am", "en", "fr", "ha", "pcm", "sw", "wo"]);
    assert.equal(DEFAULT_LANG, "en");
  });

  test("falls back to raw key when translation key does not exist and interpolates variables", () => {
    const rendered = t("Hello {name}, you have {count} orders", "fr", { name: "Kossi", count: 4 });
    assert.equal(rendered, "Hello Kossi, you have 4 orders");
  });

  test("preserves unmatched placeholders when variable is missing", () => {
    const rendered = t("Order {ref} for {buyer}", "en", { ref: "A102" });
    assert.equal(rendered, "Order A102 for {buyer}");
  });

  test("detectLang respects explicit vendor preference when supported", () => {
    assert.equal(detectLang("en-US,en;q=0.9", "fr"), "fr");
    assert.equal(detectLang("fr-TG,fr;q=0.9", "pcm"), "pcm");
    // Unsupported vendorLang falls back to Accept-Language
    assert.equal(detectLang("fr-TG,fr;q=0.9", "es"), "fr");
  });

  test("detectLang parses Accept-Language quality weights and regional aliases", () => {
    assert.equal(detectLang("en;q=0.4, fr-TG;q=0.9, sw;q=0.7"), "fr");
    assert.equal(detectLang("en-NG,en;q=0.8"), "pcm");
    assert.equal(detectLang("sw-KE,sw;q=0.9"), "sw");
    assert.equal(detectLang("wo-SN"), "wo");
    assert.equal(detectLang("ha-NG"), "ha");
    assert.equal(detectLang("am-ET"), "am");
    assert.equal(detectLang("de-DE,es;q=0.8"), "en");
    assert.equal(detectLang(undefined, undefined), "en");
  });
});

describe("regions & categories", () => {
  test("leads with Togo launch market (Lomé, Sokodé, Kara)", () => {
    assert.equal(REGIONS[0].slug, "lome");
    assert.equal(REGIONS[0].country, "Togo");
    assert.equal(REGIONS[1].slug, "sokode");
    assert.equal(REGIONS[2].slug, "kara");
  });

  test("findRegion and findCategory resolve known slugs and return undefined for unknown", () => {
    assert.equal(findRegion("lome")?.label, "Lomé");
    assert.equal(findRegion("cotonou")?.country, "Bénin");
    assert.equal(findRegion("non-existent-city"), undefined);

    assert.equal(findCategory("fashion")?.label, "Fashion");
    assert.equal(findCategory("electronics")?.icon, "📱");
    assert.equal(findCategory("unknown-cat"), undefined);
    assert.ok(CATEGORIES.length >= 8);
  });
});

