/**
 * Public marketplace — region + category filter. Aurora skinned.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listShops, type ShopCard as ShopCardType } from "@/lib/directory";
import { CATEGORIES, findRegion, findCategory, categoryName, countryName } from "@/lib/regions";
import { formatMoney } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";
import VerifiedBadge from "@/components/VerifiedBadge";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { SaasIcon, CategoryIcon } from "@/components/ui/SaasIcons";
import { getServerTr } from "@/lib/public-locale";

export const revalidate = 300;

type Params = { params: Promise<{ region: string; category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { region, category } = await params;
  const r = findRegion(region);
  const c = findCategory(category);
  const tr = await getServerTr();
  if (!r || !c) return { title: tr("Introuvable — Japora", "Not found — Japora") };
  const [catFr, catEn] = categoryName(c);
  const [countryFr, countryEn] = countryName(r.country);
  return {
    title: tr(`Boutiques ${catFr} à ${r.label} — Japora`, `${catEn} shops in ${r.label} — Japora`),
    description: tr(
      `Découvrez les vendeurs WhatsApp ${catFr.toLowerCase()} à ${r.label}, ${countryFr}.`,
      `Discover the ${catEn.toLowerCase()} WhatsApp vendors in ${r.label}, ${countryEn}.`,
    ),
  };
}

async function ShopCard({ shop }: { shop: ShopCardType }) {
  const tr = await getServerTr();
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
              className="h-14 w-14 rounded-full border border-arctic-200 object-cover"
            />
          ) : (
            <div className="grid h-14 w-14 place-items-center rounded-full bg-arctic-200/85 a-title-md text-arctic-900 backdrop-blur-glass-thin">
              {initial}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <Link
              href={`/shop/${shop.shopSlug}`}
              className="a-title-lg flex items-center gap-1.5 truncate text-arctic-900 transition-colors duration-short group-hover:text-brand-dark"
            >
              <span className="truncate">{shop.shopName}</span>
              {shop.verified && <VerifiedBadge withLabel={false} className="shrink-0" />}
            </Link>
            {shop.tagline ? (
              <div className="a-body-sm truncate text-arctic-600">{shop.tagline}</div>
            ) : null}
          </div>
        </div>
        {shop.bio ? (
          <p className="mt-3 a-body-md line-clamp-3 text-arctic-700">{shop.bio}</p>
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
        <Link
          href={`/c/${shop.shopSlug}`}
          className="text-xs font-semibold text-arctic-700 hover:text-arctic-900"
        >
          {tr("Catalogue direct", "Direct catalog")}
        </Link>
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

export default async function MarketplaceRegionCategoryPage({ params }: Params) {
  const tr = await getServerTr();
  const { region, category } = await params;
  const r = findRegion(region);
  const c = findCategory(category);
  if (!r || !c) notFound();

  const shops = await listShops({ region, category, take: 24 });

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <section className="border-b border-arctic-200/60 bg-white/60">
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <nav className="mb-3 flex flex-wrap items-center gap-2 text-xs text-arctic-600">
            <Link href="/marketplace" className="font-semibold hover:text-arctic-900">
              Marketplace
            </Link>
            <span>/</span>
            <Link
              href={`/marketplace/${r.slug}`}
              className="font-semibold hover:text-arctic-900"
            >
              {r.label} ({tr(...countryName(r.country))})
            </Link>
            <span>/</span>
            <span className="inline-flex items-center gap-1 font-bold text-brand-dark">
              <CategoryIcon slug={c.slug} size={13} />
              <span>{tr(...categoryName(c))}</span>
            </span>
          </nav>

          <h1 className="a-display-sm flex items-center gap-3 text-arctic-900 sm:a-display-md">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-shape-lg border border-brand/30 bg-brand/10 text-brand-dark">
              <CategoryIcon slug={c.slug} size={22} />
            </span>
            <span>
              {tr(`Boutiques ${categoryName(c)[0]} à ${r.label}`, `${c.label} shops in ${r.label}`)}
            </span>
          </h1>
          <p className="a-body-lg a-measure mt-2 text-arctic-700">
            {tr(
              `Vendeurs WhatsApp vérifiés dans le rayon ${categoryName(c)[0].toLowerCase()} à ${r.label} (${countryName(r.country)[0]}). Parcourez leurs articles et commandez en direct.`,
              `Verified WhatsApp vendors in the ${c.label.toLowerCase()} aisle in ${r.label} (${countryName(r.country)[1]}). Browse their items and order directly.`,
            )}
          </p>
        </div>
      </section>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10">
        <section className="mb-8">
          <h2 className="mb-3 a-label-md uppercase tracking-wider text-arctic-700">
            {tr("Autres rayons à", "Other aisles in")} {r.label}
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((x) => x.slug !== c.slug).map((x) => (
              <Link
                key={x.slug}
                href={`/marketplace/${r.slug}/${x.slug}`}
                className="a-chip inline-flex items-center gap-1.5"
              >
                <CategoryIcon slug={x.slug} size={14} className="text-brand-dark" />
                <span>{x.label}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-5 flex items-end justify-between border-b border-arctic-200/70 pb-3">
            <h2 className="a-headline-md text-arctic-900">
              {shops.length} {shops.length === 1 ? tr("boutique", "shop") : tr("boutiques", "shops")}
            </h2>
            <Link
              href={`/marketplace/${r.slug}`}
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              {tr("← Tous les rayons à", "← All aisles in")} {r.label}
            </Link>
          </div>
          {shops.length === 0 ? (
            <div className="glass glass-edge rounded-shape-xl p-8">
              <AuroraIsoscout
                variant="products"
                title={tr(`Aucune boutique ${categoryName(c)[0].toLowerCase()} à ${r.label} pour l'instant`, `No ${c.label.toLowerCase()} shop in ${r.label} yet`)}
                body={tr(
                  `Lancez la première boutique ${categoryName(c)[0].toLowerCase()} à ${r.label} sur Japora et captez les premiers clients de votre ville.`,
                  `Open the first ${c.label.toLowerCase()} shop in ${r.label} on Japora and win the first customers in your city.`,
                )}
                action={
                  <Link href="/signup" className="btn-primary">
                    {tr("Créer ma boutique maintenant →", "Create my shop now →")}
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
