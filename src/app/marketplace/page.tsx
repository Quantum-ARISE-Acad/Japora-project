/**
 * Public marketplace home — top-level discovery for Japora.
 *
 * Aurora-skinned: glass region/category chips, glass shop cards with mini
 * product previews and formatted prices, buyer protection guarantees,
 * regional market hubs, and merchant recruitment banner.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { listShops, type ShopCard as ShopCardType } from "@/lib/directory";
import { REGIONS, CATEGORIES, findRegion, findCategory } from "@/lib/regions";
import { formatMoney } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";
import VerifiedBadge from "@/components/VerifiedBadge";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Marketplace Japora — Découvrez les boutiques WhatsApp vérifiées",
  description:
    "Explorez les meilleurs vendeurs WhatsApp vérifiés en Afrique. Mode, électronique, beauté, alimentation. Parcourez les catalogues et commandez en direct.",
};

function ShopCard({ shop }: { shop: ShopCardType }) {
  const region = findRegion(shop.region);
  const category = findCategory(shop.category);
  const initial = shop.shopName.charAt(0).toUpperCase() || "S";
  const cur = shop.currency || "XOF";

  return (
    <div className="glass glass-edge group flex flex-col justify-between gap-3.5 rounded-shape-xl p-5 transition-all duration-short ease-spring hover:-translate-y-1 hover:shadow-elev-2">
      <div>
        {/* Shop Header */}
        <div className="flex items-start justify-between gap-3">
          <Link href={`/shop/${shop.shopSlug}`} className="flex items-center gap-3 min-w-0">
            {shop.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={shop.avatarUrl}
                alt=""
                className="h-12 w-12 shrink-0 rounded-full border border-arctic-200 object-cover"
              />
            ) : (
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-arctic-200/85 a-label-lg text-arctic-900 backdrop-blur-glass-thin">
                {initial}
              </div>
            )}
            <div className="min-w-0">
              <div className="a-title-md flex items-center gap-1.5 truncate text-arctic-900 transition-colors duration-short group-hover:text-brand-dark">
                <span className="truncate">{shop.shopName}</span>
                {shop.verified && (
                  <VerifiedBadge size="sm" withLabel={false} className="shrink-0" />
                )}
              </div>
              {shop.tagline ? (
                <div className="a-body-sm truncate text-arctic-600">{shop.tagline}</div>
              ) : (
                <div className="a-body-sm truncate text-arctic-500">
                  Boutique WhatsApp active
                </div>
              )}
            </div>
          </Link>

          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            En ligne
          </span>
        </div>

        {/* Bio */}
        {shop.bio ? (
          <p className="mt-3 a-body-md line-clamp-2 text-arctic-700 leading-relaxed">
            {shop.bio}
          </p>
        ) : (
          <p className="mt-3 a-body-sm italic text-arctic-500">
            Catalogue disponible en commande directe sur WhatsApp.
          </p>
        )}

        {/* Mini Product Previews with Prices */}
        {shop.products && shop.products.length > 0 && (
          <div className="mt-3.5 rounded-shape-md border border-arctic-200/70 bg-white/60 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-arctic-500">
              <span>Aperçu du catalogue</span>
              <span>{shop.products.length} articles phares</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {shop.products.map((p) => (
                <Link
                  key={p.id}
                  href={`/c/${shop.shopSlug}?product=${p.id}`}
                  className="group/item flex flex-col overflow-hidden rounded-shape-sm border border-arctic-200/80 bg-white transition-all hover:border-brand"
                  title={p.name}
                >
                  <div className="relative h-14 w-full overflow-hidden bg-arctic-100/70">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-short group-hover/item:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-xs font-bold text-arctic-600">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-1.5">
                    <div className="truncate text-[10px] font-medium text-arctic-800">
                      {p.name}
                    </div>
                    <div className="a-num text-[10px] font-bold text-brand-dark">
                      {formatMoney(p.priceCents, cur)}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Tags + Dual Action Links */}
      <div className="mt-2 space-y-3 border-t border-arctic-200/60 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {region ? (
            <Link
              href={`/marketplace/${region.slug}`}
              className="rounded-shape-sm border border-arctic-400/45 bg-white/75 px-2 py-0.5 text-[11px] font-semibold text-arctic-800 hover:border-brand"
            >
              📍 {region.label}, {region.country}
            </Link>
          ) : null}
          {category ? (
            <Link
              href={`/marketplace?category=${category.slug}`}
              className="rounded-shape-sm border border-arctic-400/45 bg-arctic-200/65 px-2 py-0.5 text-[11px] font-semibold text-arctic-900 hover:border-brand"
            >
              {category.icon} {category.label}
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/shop/${shop.shopSlug}`}
            className="btn-ghost flex-1 py-2 text-xs justify-center"
          >
            Profil boutique
          </Link>
          <Link
            href={`/c/${shop.shopSlug}`}
            className="btn-primary flex-1 py-2 text-xs justify-center"
          >
            Catalogue →
          </Link>
        </div>
      </div>
    </div>
  );
}

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

  const selectedCategoryObj = CATEGORIES.find((c) => c.slug === activeCategory);
  const selectedRegionObj = REGIONS.find((r) => r.slug === activeRegion);

  const makeFilterUrl = (params: { category?: string; region?: string; q?: string }) => {
    const qp = new URLSearchParams();
    const c = params.category !== undefined ? params.category : activeCategory;
    const r = params.region !== undefined ? params.region : activeRegion;
    const search = params.q !== undefined ? params.q : query;

    if (c) qp.set("category", c);
    if (r) qp.set("region", r);
    if (search) qp.set("q", search);

    const s = qp.toString();
    return s ? `/marketplace?${s}` : "/marketplace";
  };

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      {/* ============================================================
       * 1. MARKETPLACE HERO & PROMINENT SEARCH
       * ============================================================ */}
      <section className="border-b border-arctic-200/60 bg-gradient-to-b from-white/75 to-transparent">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center md:py-16">
          <span className="inline-flex items-center gap-2 rounded-shape-full border border-brand/35 bg-white/80 px-3.5 py-1 text-xs font-semibold text-arctic-800 shadow-xs">
            <span>🛍️</span>
            <span>Annuaire Officiel des Boutiques WhatsApp</span>
          </span>

          <h1 className="a-display-sm mt-4 text-arctic-900 sm:a-display-md a-fade-in">
            Découvrez les boutiques WhatsApp
            <br />
            <span className="text-brand-dark">près de chez vous.</span>
          </h1>
          <p className="a-body-lg a-measure mx-auto mt-3 text-arctic-700">
            Des vendeurs vérifiés à travers l&apos;Afrique de l&apos;Ouest et au-delà. Choisissez une boutique, parcourez son catalogue en direct et commandez sans quitter WhatsApp.
          </p>

          {/* Prominent Search Bar */}
          <form method="GET" action="/marketplace" className="mx-auto mt-7 max-w-2xl">
            {activeCategory && (
              <input type="hidden" name="category" value={activeCategory} />
            )}
            {activeRegion && (
              <input type="hidden" name="region" value={activeRegion} />
            )}
            <div className="flex items-center rounded-shape-full border border-arctic-300/75 bg-white/90 p-1.5 shadow-elev-2 backdrop-blur-md focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
              <span className="pl-4 pr-2 text-arctic-500">🔍</span>
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Rechercher une boutique, un produit, une ville (ex: Lomé, Mode, Wax)..."
                className="w-full bg-transparent px-2 py-2.5 a-body-md text-arctic-900 outline-none placeholder:text-arctic-400"
              />
              <button
                type="submit"
                className="rounded-shape-full bg-arctic-900 px-6 py-2.5 a-label-md font-bold text-white transition hover:bg-arctic-800"
              >
                Rechercher
              </button>
            </div>
          </form>

          {/* Marketplace Quick Stats */}
          <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-4 text-xs text-arctic-600 sm:gap-8">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-arctic-900">{REGIONS.length}</span>
              <span>villes &amp; marchés couverts</span>
            </div>
            <span className="hidden sm:inline text-arctic-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-arctic-900">{CATEGORIES.length}</span>
              <span>rayons spécialisés</span>
            </div>
            <span className="hidden sm:inline text-arctic-300">•</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-emerald-700">✓ Paiement direct</span>
              <span>T-Money, Flooz, Wave &amp; Cash</span>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl flex-1 px-4 py-10">
        {/* ============================================================
         * 2. ACTIVE FILTERS BAR
         * ============================================================ */}
        {(activeCategory || activeRegion || query) && (
          <div className="mb-8 flex flex-wrap items-center gap-2 rounded-shape-lg border border-brand/35 bg-brand/10 p-3.5">
            <span className="a-label-md font-bold text-arctic-800">
              Filtres actifs :
            </span>
            {selectedCategoryObj && (
              <Link
                href={makeFilterUrl({ category: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-900 shadow-xs hover:bg-arctic-50"
              >
                <span>
                  {selectedCategoryObj.icon} {selectedCategoryObj.label}
                </span>
                <span className="text-arctic-500 hover:text-arctic-900">✕</span>
              </Link>
            )}
            {selectedRegionObj && (
              <Link
                href={makeFilterUrl({ region: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-900 shadow-xs hover:bg-arctic-50"
              >
                <span>
                  📍 {selectedRegionObj.label} ({selectedRegionObj.country})
                </span>
                <span className="text-arctic-500 hover:text-arctic-900">✕</span>
              </Link>
            )}
            {query && (
              <Link
                href={makeFilterUrl({ q: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-900 shadow-xs hover:bg-arctic-50"
              >
                <span>&ldquo;{query}&rdquo;</span>
                <span className="text-arctic-500 hover:text-arctic-900">✕</span>
              </Link>
            )}
            <Link
              href="/marketplace"
              className="ml-auto text-xs font-bold text-brand-dark underline hover:text-arctic-900"
            >
              Réinitialiser tous les filtres
            </Link>
          </div>
        )}

        {/* ============================================================
         * 3. CATEGORY SPOTLIGHT CARDS
         * ============================================================ */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="a-label-md uppercase tracking-wider text-arctic-700">
              Explorer par rayon (Browse by category)
            </h2>
            {activeCategory && (
              <Link
                href={makeFilterUrl({ category: "" })}
                className="text-xs font-semibold text-brand-dark hover:underline"
              >
                Tous les rayons
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
            {CATEGORIES.map((c) => {
              const isSelected = activeCategory === c.slug;
              return (
                <Link
                  key={c.slug}
                  href={makeFilterUrl({ category: isSelected ? "" : c.slug })}
                  className={`flex flex-col items-center justify-center gap-1.5 rounded-shape-lg border p-3 text-center transition-all duration-short hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-arctic-900 bg-arctic-900 text-arctic-50 shadow-elev-1"
                      : "border-arctic-300/60 bg-white/75 text-arctic-800 hover:border-brand/60 hover:bg-white"
                  }`}
                >
                  <span className="text-2xl">{c.icon}</span>
                  <span className="text-xs font-bold">{c.label}</span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ============================================================
         * 4. REGION FILTER CHIPS
         * ============================================================ */}
        <section className="mb-12">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="a-label-md uppercase tracking-wider text-arctic-700">
              Filtrer par ville &amp; pays (Browse by region)
            </h2>
            {activeRegion && (
              <Link
                href={makeFilterUrl({ region: "" })}
                className="text-xs font-semibold text-brand-dark hover:underline"
              >
                Toutes les villes
              </Link>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => {
              const isSelected = activeRegion === r.slug;
              return (
                <Link
                  key={r.slug}
                  href={makeFilterUrl({ region: isSelected ? "" : r.slug })}
                  className={`a-chip transition-all ${
                    isSelected
                      ? "border-arctic-900 bg-arctic-900 text-white font-semibold shadow-xs"
                      : "hover:border-brand/60"
                  }`}
                >
                  <span>{r.label}</span>
                  <span
                    className={`ml-1 a-label-md ${
                      isSelected ? "text-arctic-200" : "text-arctic-500"
                    }`}
                  >
                    {r.country}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* ============================================================
         * 5. SHOPS DIRECTORY GRID
         * ============================================================ */}
        <section className="mb-16">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-2 border-b border-arctic-200/70 pb-3">
            <div>
              <div className="a-eyebrow">Catalogue Marchands</div>
              <h2 className="a-headline-md text-arctic-900">
                {activeCategory || activeRegion || query
                  ? "Boutiques correspondantes"
                  : "Boutiques à la une"}
              </h2>
            </div>
            <span className="rounded-full bg-arctic-200/70 px-3 py-1 a-body-sm font-semibold text-arctic-800">
              {shops.length} {shops.length === 1 ? "boutique disponible" : "boutiques disponibles"}
            </span>
          </div>

          {shops.length === 0 ? (
            <div className="glass glass-edge rounded-shape-xl p-8">
              <AuroraIsoscout
                variant="products"
                title="Aucune boutique trouvée pour cette recherche"
                body="Essayez de modifier vos filtres de ville ou de catégorie, ou lancez la première boutique Japora sur ce créneau."
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href="/marketplace" className="btn-primary">
                      Voir toutes les boutiques
                    </Link>
                    <Link href="/start" className="btn-ghost">
                      Ouvrir ma boutique ici →
                    </Link>
                  </div>
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

        {/* ============================================================
         * 6. BUYER EXPERIENCE — Comment acheter en toute confiance
         * ============================================================ */}
        <section className="mb-16 rounded-shape-xl border border-arctic-300/60 bg-white/80 p-6 sm:p-10 shadow-elev-1">
          <div className="mx-auto max-w-2xl text-center">
            <span className="a-eyebrow">Expérience Acheteur</span>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              Comment commander sur une boutique du Marketplace ?
            </h2>
            <p className="mt-2 text-xs sm:text-sm text-arctic-600">
              Pas besoin de créer un compte acheteur ni de télécharger une application. Tout se passe en 3 étapes simples.
            </p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: "Choisissez vos articles",
                desc: "Parcourez le catalogue en ligne du vendeur, vérifiez le stock en temps réel, sélectionnez votre taille et votre zone de livraison.",
                badge: "Catalogue en direct",
              },
              {
                step: "2",
                title: "Validez sur WhatsApp ou via le Bot",
                desc: "Votre panier s'ouvre directement dans la discussion WhatsApp du marchand ou avec son assistant IA qui confirme immédiatement la disponibilité.",
                badge: "Zéro attente",
              },
              {
                step: "3",
                title: "Payez par Mobile Money & recevez",
                desc: "Réglez par T-Money, Flooz, Wave, Orange Money ou à la livraison. Vous recevez votre confirmation de commande instantanément.",
                badge: "Paiement sécurisé",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-shape-lg border border-arctic-200/80 bg-arctic-50/70 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-arctic-900 font-display text-xs font-bold text-white">
                    {item.step}
                  </span>
                  <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold text-brand-dark">
                    {item.badge}
                  </span>
                </div>
                <h3 className="mt-3 font-display text-sm font-bold text-arctic-900">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-arctic-600">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 7. REGIONAL HUBS DIRECTORY — SEO & Local Market Discovery
         * ============================================================ */}
        <section className="mb-16">
          <div className="mb-6">
            <div className="a-eyebrow">Présence Pan-Africaine</div>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              Explorer les pôles commerciaux par région
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                zone: "🇹🇬 Togo (Marché pilote)",
                cities: REGIONS.filter((r) => r.country === "Togo"),
                rails: "T-Money & Flooz",
              },
              {
                zone: "🌍 Afrique de l'Ouest Francophone",
                cities: REGIONS.filter((r) =>
                  ["Bénin", "Côte d'Ivoire", "Senegal", "Burkina Faso", "Mali", "Niger"].includes(
                    r.country
                  )
                ),
                rails: "Flooz, Wave, Orange & MoMo",
              },
              {
                zone: "🇬🇭 🇳🇬 Afrique de l'Ouest Anglophone",
                cities: REGIONS.filter((r) =>
                  ["Ghana", "Nigeria"].includes(r.country)
                ),
                rails: "Paystack, Flutterwave & MoMo",
              },
              {
                zone: "🇰🇪 🇷🇼 Afrique de l'Est & Australe",
                cities: REGIONS.filter((r) =>
                  ["Kenya", "Uganda", "Rwanda", "Tanzania", "South Africa"].includes(
                    r.country
                  )
                ),
                rails: "M-Pesa Daraja & Cartes",
              },
            ].map((hub) => (
              <div
                key={hub.zone}
                className="glass rounded-shape-lg p-5 flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-display text-sm font-bold text-arctic-900">
                    {hub.zone}
                  </h3>
                  <p className="mt-1 text-[11px] font-medium text-brand-dark">
                    Rails : {hub.rails}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {hub.cities.map((city) => (
                      <Link
                        key={city.slug}
                        href={`/marketplace/${city.slug}`}
                        className="rounded-md border border-arctic-300/60 bg-white/80 px-2 py-1 text-[11px] font-medium text-arctic-800 hover:border-brand hover:text-brand-dark"
                      >
                        {city.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 8. VENDOR RECRUITMENT BANNER — List your shop
         * ============================================================ */}
        <section className="mb-8">
          <div className="rounded-shape-xl bg-gradient-to-r from-arctic-900 via-arctic-800 to-slate-900 p-8 text-white shadow-elev-3 sm:p-10">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-2">
                <span className="inline-block rounded-full bg-white/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                  Vous êtes commerçant ?
                </span>
                <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                  Référencez votre boutique gratuitement dans le Marketplace
                </h2>
                <p className="text-xs sm:text-sm text-arctic-200 leading-relaxed">
                  Créez votre boutique en 90 secondes, activez l&apos;option « Marketplace public » dans vos paramètres et laissez de nouveaux clients de votre ville vous découvrir chaque jour.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <Link
                  href="/start"
                  className="a-btn a-btn--cafe px-6 py-3 text-xs font-bold"
                >
                  Ouvrir ma boutique →
                </Link>
                <Link
                  href="/how-to-use"
                  className="a-btn border border-white/25 bg-white/10 px-5 py-3 text-xs text-white hover:bg-white/20"
                >
                  Comment ça marche
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
