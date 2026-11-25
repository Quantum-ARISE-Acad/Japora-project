/**
 * Public marketplace — region filter. Aurora skinned.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listShops, type ShopCard as ShopCardType } from "@/lib/directory";
import { CATEGORIES, REGIONS, findRegion, findCategory, categoryName, countryName } from "@/lib/regions";
import { formatMoney } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";
import VerifiedBadge from "@/components/VerifiedBadge";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { SaasIcon, CategoryIcon } from "@/components/ui/SaasIcons";
import { getServerTr } from "@/lib/public-locale";

export const revalidate = 300;

type Params = { params: Promise<{ region: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { region } = await params;
  const r = findRegion(region);
  const tr = await getServerTr();
  if (!r) return { title: tr("Région introuvable — Japora", "Region not found — Japora") };
  const [countryFr, countryEn] = countryName(r.country);
  return {
    title: tr(`Boutiques WhatsApp à ${r.label} (${countryFr}) — Japora`, `WhatsApp shops in ${r.label} (${countryEn}) — Japora`),
    description: tr(
      `Découvrez les vendeurs WhatsApp vérifiés à ${r.label}, ${countryFr}. Mode, alimentation, beauté, électronique et services.`,
      `Discover the verified WhatsApp vendors in ${r.label}, ${countryEn}. Fashion, food, beauty, electronics and services.`,
    ),
  };
}

async function ShopCard({ shop }: { shop: ShopCardType }) {
  const tr = await getServerTr();
  const category = findCategory(shop.category);
  const initial = shop.shopName.charAt(0).toUpperCase() || "S";
  const cur = shop.currency || "XOF";

  return (
    <div className="glass glass-edge group flex flex-col justify-between gap-3 rounded-shape-xl p-5 transition-all duration-short ease-spring hover:-translate-y-1 hover:shadow-elev-2">
      <div>
        <div className="flex items-center gap-3">
          {shop.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shop.avatarUrl}
              alt=""
              className="h-12 w-12 rounded-full border border-arctic-200 object-cover"
            />
          ) : (
            <div className="grid h-12 w-12 place-items-center rounded-full bg-arctic-200/85 a-label-lg text-arctic-900 backdrop-blur-glass-thin">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link
              href={`/shop/${shop.shopSlug}`}
              className="a-title-md flex items-center gap-1.5 truncate text-arctic-900 transition-colors duration-short group-hover:text-brand-dark"
            >
              <span className="truncate">{shop.shopName}</span>
              {shop.verified && (
                <VerifiedBadge size="sm" withLabel={false} className="shrink-0" />
              )}
            </Link>
            {shop.tagline ? (
              <div className="a-body-sm truncate text-arctic-600">{shop.tagline}</div>
            ) : null}
          </div>
        </div>

        {shop.bio ? (
          <p className="mt-3 a-body-md line-clamp-2 text-arctic-700">{shop.bio}</p>
        ) : (
          <p className="mt-3 a-body-sm italic text-arctic-600">
            {tr("Catalogue disponible en commande directe sur WhatsApp.", "Catalog available to order directly on WhatsApp.")}
          </p>
        )}

        {shop.products && shop.products.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {shop.products.map((p) => (
              <Link
                key={p.id}
                href={`/c/${shop.shopSlug}?product=${p.id}`}
                className="overflow-hidden rounded-shape-sm border border-arctic-200 bg-white/80 p-1.5 text-center hover:border-brand"
              >
                <div className="truncate text-[10px] font-medium text-arctic-800">
                  {p.name}
                </div>
                <div className="a-num text-[10px] font-bold text-brand-dark">
                  {formatMoney(p.priceCents, cur)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-arctic-200/60 pt-3">
        {category ? (
          <span className="inline-flex items-center gap-1 rounded-shape-sm border border-arctic-400/45 bg-arctic-200/65 px-2 py-0.5 a-label-md text-arctic-900 backdrop-blur-glass-thin">
            <CategoryIcon slug={category.slug} size={13} className="text-brand-dark" />
            <span>{tr(...categoryName(category))}</span>
          </span>
        ) : (
          <span />
        )}
        <Link
          href={`/shop/${shop.shopSlug}`}
          className="inline-flex items-center gap-1 a-label-md font-bold text-brand-dark group-hover:underline"
        >
          <span>{tr("Voir la boutique", "View the shop")}</span>
          <SaasIcon name="arrow-right" size={13} />
        </Link>
      </div>
    </div>
  );
}

export default async function MarketplaceRegionPage({ params }: Params) {
  const tr = await getServerTr();
  const { region } = await params;
  const r = findRegion(region);
  if (!r) notFound();

  const shops = await listShops({ region, take: 24 });

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <section className="border-b border-arctic-200/60 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <div className="flex flex-wrap items-center gap-2 text-xs text-arctic-600 mb-3">
            <Link href="/marketplace" className="font-semibold hover:text-arctic-900">
              Marketplace
            </Link>
            <span>/</span>
            <span className="inline-flex items-center gap-1 font-bold text-brand-dark">
              <SaasIcon name="map-pin" size={13} />
              <span>
                {r.label} ({tr(...countryName(r.country))})
              </span>
            </span>
          </div>

          <h1 className="a-display-sm text-arctic-900 sm:a-display-md">
            {tr("Boutiques WhatsApp à", "WhatsApp shops in")} {r.label}
          </h1>
          <p className="a-body-lg a-measure mt-2 text-arctic-700">
            {tr("Explorez les marchands vérifiés de", "Explore the verified vendors of")} {r.label} ({tr(...countryName(r.country))}{tr("). Consultez leurs catalogues en ligne et commandez directement sur WhatsApp.", "). Browse their online catalogs and order directly on WhatsApp.")}
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <section className="mb-10">
          <h2 className="mb-3 a-label-md uppercase tracking-wider text-arctic-700">
            {tr("Filtrer par rayon à", "Filter by aisle in")} {r.label}
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/marketplace/${r.slug}/${c.slug}`}
                className="a-chip inline-flex items-center gap-1.5 hover:border-brand"
              >
                <CategoryIcon slug={c.slug} size={14} className="text-brand-dark" />
                <span>{c.label}</span>
              </Link>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="a-label-md text-arctic-600">{tr("Autres villes :", "Other cities:")}</span>
            {REGIONS.filter((x) => x.slug !== r.slug)
              .slice(0, 8)
              .map((x) => (
                <Link
                  key={x.slug}
                  href={`/marketplace/${x.slug}`}
                  className="a-chip"
                >
                  {x.label}
                </Link>
              ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-5 flex items-end justify-between border-b border-arctic-200/70 pb-3">
            <h2 className="a-headline-md text-arctic-900">
              {shops.length} {shops.length === 1 ? tr("boutique active", "active shop") : tr("boutiques actives", "active shops")} à {r.label}
            </h2>
            <Link
              href="/marketplace"
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              {tr("← Toutes les régions", "← All regions")}
            </Link>
          </div>
          {shops.length === 0 ? (
            <div className="glass glass-edge rounded-shape-xl p-8">
              <AuroraIsoscout
                variant="products"
                title={tr(`Aucune boutique publique à ${r.label} pour le moment`, `No public shop in ${r.label} yet`)}
                body={tr(
                  `Soyez le premier commerçant à référencer votre boutique WhatsApp à ${r.label}. L'inscription est rapide et 100 % gratuite.`,
                  `Be the first trader to list your WhatsApp shop in ${r.label}. Sign-up is quick and 100% free.`,
                )}
                action={
                  <Link href="/signup" className="btn-primary">
                    {tr("Ouvrir la première boutique à", "Open the first shop in")} {r.label} →
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          )}
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
