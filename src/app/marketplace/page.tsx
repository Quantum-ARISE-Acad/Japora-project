import type { Metadata } from "next";
import { listShops } from "@/lib/directory";
import MarketplaceClient from "./MarketplaceClient";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Marketplace Japora — Boutiques en ligne & WhatsApp vérifiées",
  description:
    "Explorez les meilleurs vendeurs WhatsApp vérifiés en Afrique. Mode, électronique, beauté, alimentation. Parcourez les catalogues et commandez en direct.",
};

type Props = {
  searchParams?: Promise<{ category?: string; region?: string; q?: string }>;
};

export default async function MarketplacePage({ searchParams }: Props) {
  const sp = searchParams ? await searchParams : {};
  const activeCategory = sp.category || "";
  const activeRegion = sp.region || "";
  const query = sp.q || "";

  const shops = await listShops({
    category: activeCategory || undefined,
    region: activeRegion || undefined,
    q: query || undefined,
    take: 36,
  });

  return (
    <MarketplaceClient
      shops={shops}
      activeCategory={activeCategory}
      activeRegion={activeRegion}
      query={query}
    />
  );
}
