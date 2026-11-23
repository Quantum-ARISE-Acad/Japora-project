import { describe, test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../src/lib/db";
import { matchesSearch, normalizeSearch, searchTerms } from "../src/lib/search-text";
import { searchMarketplace } from "../src/lib/search";

describe("search words", () => {
  test("accents, capitals, punctuation and small words are ignored", () => {
    assert.equal(normalizeSearch("Robe WAX — Lomé !"), "robe wax lome");
    assert.deepEqual(searchTerms("une robe de Lomé"), ["robe", "lome"]);
    assert.deepEqual(searchTerms("de la"), ["de", "la"]);
  });

  test("plurals, word starts and one typo still match", () => {
    assert.equal(matchesSearch("robes", "Robe Ankara"), true);
    assert.equal(matchesSearch("ank", "Robe Ankara"), true);
    assert.equal(matchesSearch("ankarra", "Robe Ankara"), true);
    assert.equal(matchesSearch("telephone", "Téléphone Samsung"), true);
    assert.equal(matchesSearch("lome", "Boutique de Lomé"), true);
  });

  test("every word must be found", () => {
    assert.equal(matchesSearch("robe rouge", "Robe Ankara", "en coton bleu"), false);
    assert.equal(matchesSearch("robe bleu", "Robe Ankara", "en coton bleu"), true);
    assert.equal(matchesSearch("sac", "Robe Ankara"), false);
    assert.equal(matchesSearch("", "Robe Ankara"), true);
  });
});

const vendorIds: string[] = [];
after(async () => {
  await prisma.product.deleteMany({ where: { vendorId: { in: vendorIds } } });
  await prisma.vendor.deleteMany({ where: { id: { in: vendorIds } } });
  await prisma.$disconnect();
});

async function shop(name: string, extra: Record<string, unknown>, products: Array<Record<string, unknown>>) {
  const tag = randomUUID().slice(0, 8);
  const v = await prisma.vendor.create({
    data: {
      email: `search_${tag}@japora.test`,
      passwordHash: "x",
      shopName: name,
      shopSlug: `search-${tag}`,
      currency: "XOF",
      ...extra,
    } as never,
  });
  vendorIds.push(v.id);
  for (const p of products) {
    await prisma.product.create({ data: { vendorId: v.id, priceCents: 1_000_000, stock: 3, ...p } as never });
  }
  return v;
}

describe("marketplace search (shops and products)", async () => {
  const tag = randomUUID().slice(0, 6).replace(/[^a-z]/g, "q");
  const mode = await shop(`Mode Akossiwa${tag}`, { region: "lome", category: "fashion", tagline: "Pagnes et robes" }, [
    { name: `Robe Ankara ${tag}`, description: "Coton, toutes tailles" },
    { name: `Sac en cuir ${tag}`, stock: 0 },
  ]);
  const tech = await shop(`Kara Phone${tag}`, { region: "kara", category: "electronics" }, [
    { name: `Téléphone Samsung ${tag}` },
  ]);
  const hidden = await shop(`Cachee${tag}`, { region: "lome", isPublic: false }, [{ name: `Robe Ankara ${tag}` }]);

  test("a product is found by its name, without accents, with its shop", async () => {
    const r = await searchMarketplace({ q: `telephone ${tag}` });
    assert.deepEqual(r.products.map((p) => p.name), [`Téléphone Samsung ${tag}`]);
    assert.equal(r.products[0].shop.shopSlug, tech.shopSlug);
  });

  test("a shop is found by its name", async () => {
    const r = await searchMarketplace({ q: `akossiwa${tag}`, type: "shops" });
    assert.deepEqual(r.shops.map((s) => s.id), [mode.id]);
    assert.equal(r.products.length, 0);
    assert.equal(r.shopsFirst, true);
  });

  test("a shop is found by what it sells, and a hidden shop never shows", async () => {
    const r = await searchMarketplace({ q: `robes ${tag}` });
    assert.ok(r.shops.some((s) => s.id === mode.id));
    assert.ok(!r.shops.some((s) => s.id === hidden.id));
    assert.deepEqual(r.products.map((p) => p.name), [`Robe Ankara ${tag}`]);
    assert.equal(r.shopsFirst, false);
  });

  test("a city narrows the products, and sold-out items say so", async () => {
    const r = await searchMarketplace({ q: `${tag} lome`, type: "products" });
    assert.deepEqual(r.products.map((p) => p.name).sort(), [`Robe Ankara ${tag}`, `Sac en cuir ${tag}`]);
    assert.equal(r.products.find((p) => p.name.startsWith("Sac"))?.available, false);
    assert.equal(r.shops.length, 0);
  });

  test("the region filter applies to products and shops", async () => {
    const r = await searchMarketplace({ q: tag, region: "kara" });
    assert.deepEqual(r.products.map((p) => p.name), [`Téléphone Samsung ${tag}`]);
    assert.deepEqual(r.shops.map((s) => s.id), [tech.id]);
  });
});
