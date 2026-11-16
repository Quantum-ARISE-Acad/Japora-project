import type { Metadata } from "next";
import { listShops } from "@/lib/directory";
import { parseSearchType, searchMarketplace, type ProductHit } from "@/lib/search";
import MarketplaceClient from "./MarketplaceClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Marketplace Japora — Boutiques en ligne & WhatsApp vérifiées",
  description:
    "Explorez les meilleurs vendeurs WhatsApp vérifiés en Afrique. Mode, électronique, beauté, alimentation. Parcourez les catalogues et commandez en direct.",
};

type Props = {
  searchParams?: Promise<{ category?: string; region?: string; q?: string; type?: string }>;
};

export default async function MarketplacePage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const activeCategory = sp.category || "";
  const activeRegion = sp.region || "";
  const query = (sp.q || "").trim().slice(0, 100);
  const searchType = parseSearchType(sp.type);

  let shops;
  let products: ProductHit[] = [];
  let shopsFirst = true;
  if (query) {
    const results = await searchMarketplace({
      q: query,
      type: searchType,
      region: activeRegion || undefined,
      category: activeCategory || undefined,
    });
    shops = results.shops;
    products = results.products;
    shopsFirst = results.shopsFirst;
  } else {
    shops = await listShops({
      category: activeCategory || undefined,
      region: activeRegion || undefined,
      take: 36,
    });
  }

  return (
    <MarketplaceClient
      shops={shops}
      products={products}
      shopsFirst={shopsFirst}
      searchType={searchType}
      activeCategory={activeCategory}
      activeRegion={activeRegion}
      query={query}
    />
  );
}
