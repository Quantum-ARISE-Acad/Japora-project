import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { formatCatalogForPrompt, formatShopProfileForPrompt, buildSystemPrompt, isLlmConfigured, llmProviderName } from "../src/lib/llm";

describe("llm grounding helpers", () => {
  test("formatCatalogForPrompt renders price + stock per line", () => {
    const out = formatCatalogForPrompt([
      { name: "Ankara Gown", priceLabel: "CFA 8,000", stock: 3, description: "Handmade cotton" },
      { name: "Beaded Bag", priceLabel: "CFA 2,500", stock: 0 },
    ]);
    assert.match(out, /Ankara Gown: CFA 8,000, 3 in stock — Handmade cotton/);
    assert.match(out, /Beaded Bag: CFA 2,500, out of stock/);
  });

  test("formatCatalogForPrompt handles an empty catalog", () => {
    assert.match(formatCatalogForPrompt([]), /no products listed/);
  });

  test("shop profile context reflects each merchant's own activity and location", () => {
    const profile = formatShopProfileForPrompt({
      category: "Electronics",
      tagline: "Repair and sales",
      region: "Lomé",
      bio: "Phones, laptops, and repair service",
    });
    assert.match(profile, /Activity: Electronics/);
    assert.match(profile, /Region: Lomé/);
    assert.match(profile, /Repair and sales/);
  });

  test("buildSystemPrompt names the shop and forbids inventing prices", () => {
    const p = buildSystemPrompt("Chez Améyo");
    assert.match(p, /Chez Améyo/);
    assert.match(p, /Never invent prices/);
    assert.match(p, /same language/);
  });

  test("isLlmConfigured reflects env presence", () => {
    const had = process.env.ANTHROPIC_API_KEY;
    const hadO = process.env.OPENAI_API_KEY;
    const hadG = process.env.GEMINI_API_KEY;
    const hadGN = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    assert.equal(isLlmConfigured(), false);
    assert.equal(llmProviderName(), "none");

    process.env.GEMINI_API_KEY = "AIza-test";
    assert.equal(isLlmConfigured(), true);
    assert.equal(llmProviderName(), "gemini");

    process.env.ANTHROPIC_API_KEY = "sk-test";
    assert.equal(isLlmConfigured(), true);
    assert.equal(llmProviderName(), "anthropic");

    // restore
    if (had === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = had;
    if (hadO === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = hadO;
    if (hadG === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = hadG;
    if (hadGN === undefined) delete process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    else process.env.NEXT_PUBLIC_GEMINI_API_KEY = hadGN;
  });
});
