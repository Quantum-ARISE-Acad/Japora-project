"use client";

import Link from "next/link";
import type { ShopCard as ShopCardType } from "@/lib/directory";
import { REGIONS, CATEGORIES, findRegion, findCategory } from "@/lib/regions";
import { formatMoney } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";
import VerifiedBadge from "@/components/VerifiedBadge";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { SaasIcon, CategoryIcon } from "@/components/ui/SaasIcons";

const CATEGORY_FR: Record<string, string> = {
  fashion: "Mode & Wax",
  food: "Alimentation",
  beauty: "Beauté & Soins",
  electronics: "Électronique",
  home: "Maison & Déco",
  groceries: "Épicerie",
  services: "Services",
  other: "Autres",
};

function ShopCard({ shop }: { shop: ShopCardType }) {
  const { tr } = usePublicLang();
  const region = findRegion(shop.region);
  const category = findCategory(shop.category);
  const initial = shop.shopName.charAt(0).toUpperCase() || "S";
  const cur = shop.currency || "XOF";

  return (
    <div className="glass glass-edge group flex flex-col justify-between gap-3.5 rounded-shape-xl p-5 transition-all duration-short ease-spring hover:-translate-y-1 hover:shadow-elev-2">
      <div>
        <div className="flex items-start justify-between gap-3">
          <Link href={`/shop/${shop.shopSlug}`} className="flex min-w-0 items-center gap-3">
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
                  {tr("Boutique WhatsApp active", "Active WhatsApp shop")}
                </div>
              )}
            </div>
          </Link>

          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
            {tr("En ligne", "Online")}
          </span>
        </div>

        {shop.bio ? (
          <p className="mt-3 a-body-md line-clamp-2 leading-relaxed text-arctic-700">
            {shop.bio}
          </p>
        ) : (
          <p className="mt-3 a-body-sm italic text-arctic-500">
            {tr(
              "Catalogue disponible en commande directe sur WhatsApp.",
              "Catalog available for direct ordering on WhatsApp."
            )}
          </p>
        )}

        {shop.products && shop.products.length > 0 && (
          <div className="mt-3.5 rounded-shape-md border border-arctic-200/70 bg-white/60 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-arctic-500">
              <span>{tr("Aperçu du catalogue", "Catalog preview")}</span>
              <span>
                {shop.products.length} {tr("articles phares", "featured items")}
              </span>
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

      <div className="mt-2 space-y-3 border-t border-arctic-200/60 pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {region ? (
            <Link
              href={`/marketplace/${region.slug}`}
              className="inline-flex items-center gap-1 rounded-shape-sm border border-arctic-400/45 bg-white/75 px-2 py-0.5 text-[11px] font-semibold text-arctic-800 hover:border-brand"
            >
              <SaasIcon name="map-pin" size={12} className="text-brand-dark" />
              <span>
                {region.label}, {region.country}
              </span>
            </Link>
          ) : null}
          {category ? (
            <Link
              href={`/marketplace?category=${category.slug}`}
              className="inline-flex items-center gap-1 rounded-shape-sm border border-arctic-400/45 bg-arctic-200/65 px-2 py-0.5 text-[11px] font-semibold text-arctic-900 hover:border-brand"
            >
              <CategoryIcon slug={category.slug} size={12} className="text-brand-dark" />
              <span>{tr(CATEGORY_FR[category.slug] || category.label, category.label)}</span>
            </Link>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href={`/shop/${shop.shopSlug}`}
            className="btn-ghost flex-1 justify-center py-2 text-xs"
          >
            {tr("Profil boutique", "Shop profile")}
          </Link>
          <Link
            href={`/c/${shop.shopSlug}`}
            className="btn-primary flex-1 justify-center gap-1 py-2 text-xs"
          >
            <span>{tr("Catalogue", "Catalog")}</span>
            <SaasIcon name="arrow-right" size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function MarketplaceClient({
  shops,
  activeCategory,
  activeRegion,
  query,
}: {
  shops: ShopCardType[];
  activeCategory: string;
  activeRegion: string;
  query: string;
}) {
  const { tr } = usePublicLang();

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
            <SaasIcon name="store" size={14} className="text-brand-dark" />
            <span>
              {tr(
                "Annuaire Officiel des Boutiques en ligne & WhatsApp",
                "Official Directory of Online & WhatsApp Shops"
              )}
            </span>
          </span>

          <h1 className="a-display-sm mt-4 text-arctic-900 sm:a-display-md a-fade-in">
            {tr("Découvrez les boutiques WhatsApp", "Discover WhatsApp shops")}
            <br />
            <span className="text-brand-dark">
              {tr("près de chez vous.", "near you.")}
            </span>
          </h1>
          <p className="a-body-lg a-measure mx-auto mt-3 text-arctic-700">
            {tr(
              "Des vendeurs vérifiés à travers l'Afrique de l'Ouest et au-delà. Choisissez une boutique, parcourez son catalogue en direct et commandez sans quitter WhatsApp.",
              "Trusted WhatsApp sellers across West Africa and beyond. Pick a shop, browse its live catalog, and order without leaving WhatsApp."
            )}
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
              <span className="pl-4 pr-2 text-arctic-500">
                <SaasIcon name="search" size={18} />
              </span>
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder={tr(
                  "Rechercher une boutique, un produit, une ville (ex: Lomé, Mode, Wax)...",
                  "Search shops, products, or cities (e.g. Lomé, Fashion, Ankara)..."
                )}
                className="w-full bg-transparent px-2 py-2.5 a-body-md text-arctic-900 outline-none placeholder:text-arctic-400"
              />
              <button
                type="submit"
                className="rounded-shape-full bg-arctic-900 px-6 py-2.5 a-label-md font-bold text-arctic-50 transition hover:bg-arctic-800"
              >
                {tr("Rechercher", "Search")}
              </button>
            </div>
          </form>

          {/* Marketplace Quick Stats */}
          <div className="mx-auto mt-7 flex max-w-2xl flex-wrap items-center justify-center gap-4 text-xs text-arctic-600 sm:gap-8">
            <div className="flex items-center gap-1.5">
              <SaasIcon name="map-pin" size={14} className="text-brand-dark" />
              <span className="font-bold text-arctic-900">{REGIONS.length}</span>
              <span>
                {tr("villes & marchés couverts", "cities & markets covered")}
              </span>
            </div>
            <span className="hidden text-arctic-300 sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <SaasIcon name="store" size={14} className="text-brand-dark" />
              <span className="font-bold text-arctic-900">{CATEGORIES.length}</span>
              <span>{tr("rayons spécialisés", "specialized categories")}</span>
            </div>
            <span className="hidden text-arctic-300 sm:inline">•</span>
            <div className="flex items-center gap-1.5">
              <SaasIcon name="shield-check" size={14} className="text-emerald-700" />
              <span className="font-bold text-emerald-700">
                {tr("Paiement direct", "Inline Payment")}
              </span>
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
              {tr("Filtres actifs :", "Active filters:")}
            </span>
            {selectedCategoryObj && (
              <Link
                href={makeFilterUrl({ category: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-900 shadow-xs hover:bg-arctic-50"
              >
                <CategoryIcon slug={selectedCategoryObj.slug} size={13} className="text-brand-dark" />
                <span>
                  {tr(
                    CATEGORY_FR[selectedCategoryObj.slug] ||
                      selectedCategoryObj.label,
                    selectedCategoryObj.label
                  )}
                </span>
                <SaasIcon name="x" size={12} className="text-arctic-500 hover:text-arctic-900" />
              </Link>
            )}
            {selectedRegionObj && (
              <Link
                href={makeFilterUrl({ region: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-900 shadow-xs hover:bg-arctic-50"
              >
                <SaasIcon name="map-pin" size={13} className="text-brand-dark" />
                <span>
                  {selectedRegionObj.label} ({selectedRegionObj.country})
                </span>
                <SaasIcon name="x" size={12} className="text-arctic-500 hover:text-arctic-900" />
              </Link>
            )}
            {query && (
              <Link
                href={makeFilterUrl({ q: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-900 shadow-xs hover:bg-arctic-50"
              >
                <span>&ldquo;{query}&rdquo;</span>
                <SaasIcon name="x" size={12} className="text-arctic-500 hover:text-arctic-900" />
              </Link>
            )}
            <Link
              href="/marketplace"
              className="ml-auto text-xs font-bold text-brand-dark underline hover:text-arctic-900"
            >
              {tr("Réinitialiser tous les filtres", "Reset all filters")}
            </Link>
          </div>
        )}

        {/* ============================================================
         * 3. CATEGORY SPOTLIGHT CARDS
         * ============================================================ */}
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="a-label-md uppercase tracking-wider text-arctic-700">
              {tr("Explorer par rayon", "Browse by category")}
            </h2>
            {activeCategory && (
              <Link
                href={makeFilterUrl({ category: "" })}
                className="text-xs font-semibold text-brand-dark hover:underline"
              >
                {tr("Tous les rayons", "All categories")}
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
                  className={`flex flex-col items-center justify-center gap-2 rounded-shape-lg border p-3.5 text-center transition-all duration-short hover:-translate-y-0.5 ${
                    isSelected
                      ? "border-arctic-900 bg-arctic-900 text-arctic-50 shadow-elev-1"
                      : "border-arctic-300/60 bg-white/75 text-arctic-800 hover:border-brand/60 hover:bg-white"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-shape-md ${
                      isSelected
                        ? "bg-arctic-50/15 text-arctic-50"
                        : "bg-brand/10 text-brand-dark"
                    }`}
                  >
                    <CategoryIcon slug={c.slug} size={18} />
                  </span>
                  <span className="text-xs font-bold">
                    {tr(CATEGORY_FR[c.slug] || c.label, c.label)}
                  </span>
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
              {tr("Filtrer par ville & pays", "Filter by city & country")}
            </h2>
            {activeRegion && (
              <Link
                href={makeFilterUrl({ region: "" })}
                className="text-xs font-semibold text-brand-dark hover:underline"
              >
                {tr("Toutes les villes", "All cities")}
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
                      ? "border-arctic-900 bg-arctic-900 text-arctic-50 font-semibold shadow-xs"
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
              <div className="a-eyebrow">
                {tr("Catalogue Marchands", "Merchant Directory")}
              </div>
              <h2 className="a-headline-md text-arctic-900">
                {activeCategory || activeRegion || query
                  ? tr("Boutiques correspondantes", "Matching shops")
                  : tr("Boutiques à la une", "Featured shops")}
              </h2>
            </div>
            <span className="rounded-full bg-arctic-200/70 px-3 py-1 a-body-sm font-semibold text-arctic-800">
              {shops.length}{" "}
              {shops.length === 1
                ? tr("boutique disponible", "shop available")
                : tr("boutiques disponibles", "shops available")}
            </span>
          </div>

          {shops.length === 0 ? (
            <div className="glass glass-edge rounded-shape-xl p-8">
              <AuroraIsoscout
                variant="products"
                title={tr(
                  "Aucune boutique trouvée pour cette recherche",
                  "No shops found for this search"
                )}
                body={tr(
                  "Essayez de modifier vos filtres de ville ou de catégorie, ou lancez la première boutique Japora sur ce créneau.",
                  "Try adjusting your city or category filters, or open the first Japora shop in this category."
                )}
                action={
                  <div className="flex flex-wrap justify-center gap-3">
                    <Link href="/marketplace" className="btn-primary">
                      {tr("Voir toutes les boutiques", "View all shops")}
                    </Link>
                    <Link href="/signup" className="btn-ghost">
                      {tr("Ouvrir ma boutique ici →", "Open my shop here →")}
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
        <section className="mb-16 rounded-shape-xl border border-arctic-300/60 bg-white/80 p-6 shadow-elev-1 sm:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <span className="a-eyebrow">
              {tr("Expérience Acheteur", "Buyer Experience")}
            </span>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              {tr(
                "Comment commander sur une boutique du Marketplace ?",
                "How to order from a Marketplace shop?"
              )}
            </h2>
            <p className="mt-2 text-xs text-arctic-600 sm:text-sm">
              {tr(
                "Pas besoin de créer un compte acheteur ni de télécharger une application. Tout se passe en 3 étapes simples.",
                "No buyer account or app download required. Everything happens in 3 simple steps."
              )}
            </p>
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {[
              {
                step: "1",
                title: tr("Choisissez vos articles", "Pick your items"),
                desc: tr(
                  "Parcourez le catalogue en ligne du vendeur, vérifiez le stock en temps réel, sélectionnez votre taille et votre zone de livraison.",
                  "Browse the vendor's online catalog, check live stock, pick your size, and select your delivery neighborhood."
                ),
                badge: tr("Catalogue en direct", "Live Catalog"),
              },
              {
                step: "2",
                title: tr(
                  "Validez sur WhatsApp ou via le Bot",
                  "Confirm on WhatsApp or via the Bot"
                ),
                desc: tr(
                  "Votre panier s'ouvre directement dans la discussion WhatsApp du marchand ou avec son assistant IA qui confirme immédiatement la disponibilité.",
                  "Your cart opens directly in the vendor's WhatsApp chat or AI assistant, confirming availability right away."
                ),
                badge: tr("Zéro attente", "Zero Wait"),
              },
              {
                step: "3",
                title: tr(
                  "Payez par Mobile Money & recevez",
                  "Pay via Mobile Money & receive"
                ),
                desc: tr(
                  "Réglez par T-Money, Flooz, Wave, Orange Money ou à la livraison. Vous recevez votre confirmation de commande instantanément.",
                  "Pay with T-Money, Flooz, Wave, Orange Money, or Cash on Delivery. You receive your order confirmation immediately."
                ),
                badge: tr("Paiement sécurisé", "Secure Payment"),
              },
            ].map((item) => (
              <div
                key={item.step}
                className="rounded-shape-lg border border-arctic-200/80 bg-arctic-50/70 p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-arctic-900 font-display text-xs font-bold text-arctic-50">
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
         * 7. REGIONAL HUBS DIRECTORY
         * ============================================================ */}
        <section className="mb-16">
          <div className="mb-6">
            <div className="a-eyebrow">
              {tr("Présence Pan-Africaine", "Pan-African Presence")}
            </div>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              {tr(
                "Explorer les pôles commerciaux par région",
                "Explore market hubs by region"
              )}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                code: "TG",
                zone: tr("Togo (Marché pilote)", "Togo (Launch Market)"),
                cities: REGIONS.filter((r) => r.country === "Togo"),
                rails: "T-Money & Flooz",
              },
              {
                code: "XOF",
                zone: tr(
                  "Afrique de l'Ouest Francophone",
                  "Francophone West Africa"
                ),
                cities: REGIONS.filter((r) =>
                  [
                    "Bénin",
                    "Côte d'Ivoire",
                    "Senegal",
                    "Burkina Faso",
                    "Mali",
                    "Niger",
                  ].includes(r.country)
                ),
                rails: "Flooz, Wave, Orange & MoMo",
              },
              {
                code: "GH/NG",
                zone: tr(
                  "Afrique de l'Ouest Anglophone",
                  "Anglophone West Africa"
                ),
                cities: REGIONS.filter((r) =>
                  ["Ghana", "Nigeria"].includes(r.country)
                ),
                rails: "Paystack, Flutterwave & MoMo",
              },
              {
                code: "EA/SA",
                zone: tr(
                  "Afrique de l'Est & Australe",
                  "East & Southern Africa"
                ),
                cities: REGIONS.filter((r) =>
                  [
                    "Kenya",
                    "Uganda",
                    "Rwanda",
                    "Tanzania",
                    "South Africa",
                  ].includes(r.country)
                ),
                rails: "M-Pesa Daraja & Cards",
              },
            ].map((hub) => (
              <div
                key={hub.zone}
                className="glass flex flex-col justify-between rounded-shape-lg p-5"
              >
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand-dark">
                      <SaasIcon name="globe" size={12} />
                      <span>{hub.code}</span>
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-arctic-900">
                    {hub.zone}
                  </h3>
                  <p className="mt-1 text-[11px] font-medium text-brand-dark">
                    {tr("Rails :", "Rails:")} {hub.rails}
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
          <div className="rounded-shape-xl bg-gradient-to-r from-stone-900 via-stone-800 to-slate-900 p-8 text-white shadow-elev-3 ring-1 ring-white/10 sm:p-10">
            <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-center">
              <div className="max-w-xl space-y-2">
                <span className="inline-block rounded-full bg-white/10 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-200">
                  {tr("Vous êtes commerçant ?", "Are you a merchant?")}
                </span>
                <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                  {tr(
                    "Référencez votre boutique gratuitement dans le Marketplace",
                    "List your shop for free in the Marketplace"
                  )}
                </h2>
                <p className="text-xs leading-relaxed text-stone-300 sm:text-sm">
                  {tr(
                    "Créez votre boutique en quelques instants, activez l'option « Marketplace public » dans vos paramètres et laissez de nouveaux clients vous découvrir chaque jour.",
                    "Open your shop in moments, enable the public marketplace toggle in your settings, and let new local buyers discover you every day."
                  )}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-3">
                <Link
                  href="/signup"
                  className="a-btn a-btn--cafe px-6 py-3 text-xs font-bold"
                >
                  <span>{tr("Ouvrir ma boutique", "Open my shop")}</span>
                  <SaasIcon name="arrow-right" size={14} />
                </Link>
                <Link
                  href="/how-to-use"
                  className="a-btn border border-white/25 bg-white/10 px-5 py-3 text-xs text-white hover:bg-white/20"
                >
                  {tr("Comment ça marche", "How it works")}
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
