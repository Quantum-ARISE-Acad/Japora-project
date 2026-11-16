/**
 * Marketplace search: one search box that finds shops and products.
 *
 * A shop is found by its name, slogan, description, city, category, or by
 * what it sells ("robe" finds the shops that sell robes). A product is found
 * by its name, collection, description, shop, city or category.
 *
 * Matching runs in code (src/lib/search-text.ts) rather than in SQL so it
 * ignores accents and works the same on SQLite (development) and PostgreSQL.
 * The candidate rows are capped; past a few thousand products, move this to
 * PostgreSQL full-text search.
 */
import { prisma } from "./db";
import { PUBLIC_SHOP_SELECT, toCard, type ShopCard } from "./directory";
import { CATEGORY_LABEL_FR, findCategory, findRegion } from "./regions";
import { scoreFields, searchable, searchTerms } from "./search-text";

export type SearchType = "all" | "shops" | "products";

export type ProductHit = {
  id: string;
  name: string;
  priceCents: number;
  imageUrl: string;
  available: boolean;
  preOrder: boolean;
  shop: { shopName: string; shopSlug: string; currency: string; region: string; verified: boolean };
};

export type MarketplaceResults = {
  terms: string[];
  shops: ShopCard[];
  products: ProductHit[];
  /** Show shops before products: the search looks like a shop name. */
  shopsFirst: boolean;
};

const SHOP_CANDIDATES = 2000;
const PRODUCT_CANDIDATES = 5000;

export function parseSearchType(value: string | undefined): SearchType {
  return value === "shops" || value === "products" ? value : "all";
}

function placeWords(region: string): string[] {
  const r = findRegion(region);
  return searchable(r?.label, r?.country, region);
}

function categoryWords(category: string): string[] {
  const c = findCategory(category);
  return searchable(c?.label, CATEGORY_LABEL_FR[category], category);
}

export async function searchMarketplace(opts: {
  q: string;
  type?: SearchType;
  region?: string;
  category?: string;
  takeShops?: number;
  takeProducts?: number;
}): Promise<MarketplaceResults> {
  const terms = searchTerms(opts.q);
  const type = opts.type ?? "all";
  if (!terms.length) return { terms, shops: [], products: [], shopsFirst: true };

  const shopWhere = {
    isPublic: true,
    deletedAt: null,
    ...(opts.region ? { region: opts.region } : {}),
    ...(opts.category ? { category: opts.category } : {}),
  };

  // Products are scored even for a shop-only search: "robe" must find the
  // shops that sell robes.
  const productRows = await prisma.product.findMany({
    where: { isActive: true, vendor: shopWhere },
    select: {
      id: true,
      name: true,
      description: true,
      priceCents: true,
      imageUrl: true,
      stock: true,
      preOrderAllowed: true,
      vendorId: true,
      collection: { select: { name: true } },
      vendor: {
        select: { shopName: true, shopSlug: true, currency: true, region: true, category: true, verifiedAt: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: PRODUCT_CANDIDATES,
  });

  const scoredProducts: Array<{ hit: ProductHit; score: number; vendorId: string }> = [];
  for (const p of productRows) {
    const score = scoreFields(
      [
        { words: searchable(p.name), weight: 5 },
        { words: searchable(p.collection?.name), weight: 3 },
        { words: searchable(p.vendor.shopName), weight: 2 },
        { words: placeWords(p.vendor.region), weight: 2 },
        { words: categoryWords(p.vendor.category), weight: 1 },
        { words: searchable(p.description), weight: 1 },
      ],
      terms,
    );
    if (!score) continue;
    const available = p.stock > 0;
    scoredProducts.push({
      score: score + (available ? 0.5 : 0),
      vendorId: p.vendorId,
      hit: {
        id: p.id,
        name: p.name,
        priceCents: p.priceCents,
        imageUrl: p.imageUrl,
        available,
        preOrder: !available && p.preOrderAllowed,
        shop: {
          shopName: p.vendor.shopName,
          shopSlug: p.vendor.shopSlug,
          currency: p.vendor.currency,
          region: p.vendor.region,
          verified: Boolean(p.vendor.verifiedAt),
        },
      },
    });
  }
  scoredProducts.sort((a, b) => b.score - a.score);

  // Best product score per shop: a shop that sells the item is a match too.
  const sellsBest = new Map<string, number>();
  for (const p of scoredProducts) {
    if (!sellsBest.has(p.vendorId)) sellsBest.set(p.vendorId, p.score);
  }

  let shops: ShopCard[] = [];
  let topShopNameScore = 0;
  if (type !== "products") {
    const shopRows = await prisma.vendor.findMany({
      where: shopWhere,
      select: PUBLIC_SHOP_SELECT,
      orderBy: { createdAt: "desc" },
      take: SHOP_CANDIDATES,
    });
    const scoredShops: Array<{ shop: ShopCard; score: number }> = [];
    for (const row of shopRows) {
      const own = scoreFields(
        [
          { words: searchable(row.shopName), weight: 6 },
          { words: searchable(row.shopSlug.replace(/-/g, " ")), weight: 4 },
          { words: searchable(row.tagline), weight: 2 },
          { words: placeWords(row.region), weight: 2 },
          { words: categoryWords(row.category), weight: 2 },
          { words: searchable(row.bio), weight: 1 },
        ],
        terms,
      );
      const nameOnly = scoreFields([{ words: searchable(row.shopName), weight: 6 }], terms);
      topShopNameScore = Math.max(topShopNameScore, nameOnly);
      // What the shop sells counts, a little less than its own description.
      const sells = (sellsBest.get(row.id) ?? 0) * 0.6;
      const score = Math.max(own, sells);
      if (score > 0) scoredShops.push({ shop: toCard(row), score });
    }
    scoredShops.sort((a, b) => b.score - a.score);
    shops = scoredShops.slice(0, opts.takeShops ?? 36).map((s) => s.shop);
  }

  const products =
    type === "shops" ? [] : scoredProducts.slice(0, opts.takeProducts ?? 48).map((p) => p.hit);

  return { terms, shops, products, shopsFirst: topShopNameScore > 0 };
}
