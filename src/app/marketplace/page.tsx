/**
 * Public marketplace home — top-level discovery for Japora.
 *
 * Aurora-skinned: glass region/category chips, glass shop cards with the
 * cursor-follow halo on hover. Dynamic filtering by category, region, and search term.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { listShops, type ShopCard as ShopCardType } from "@/lib/directory";
import { REGIONS, CATEGORIES, findRegion, findCategory } from "@/lib/regions";
import { AuroraIsoscout } from "@/components/aurora";
import VerifiedBadge from "@/components/VerifiedBadge";
import ThemeToggle from "@/components/ThemeToggle";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "Japora — Discover WhatsApp shops near you",
  description:
    "Trusted WhatsApp sellers across Africa. Fashion, food, beauty, electronics. Tap a shop, browse, order. You never leave WhatsApp.",
};

function ShopCard({ shop }: { shop: ShopCardType }) {
  const region = findRegion(shop.region);
  const category = findCategory(shop.category);
  const initial = shop.shopName.charAt(0).toUpperCase() || "S";

  return (
    <Link
      href={`/shop/${shop.shopSlug}`}
      className="glass glass-edge group flex flex-col gap-3 rounded-shape-lg p-5 transition-all duration-short ease-spring hover:-translate-y-1 hover:shadow-elev-2"
    >
      <div className="flex items-center gap-3">
        {shop.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={shop.avatarUrl}
            alt=""
            className="h-12 w-12 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-full bg-arctic-200/85 a-label-lg text-arctic-900 backdrop-blur-glass-thin">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <div className="a-title-md flex items-center gap-1.5 truncate text-arctic-900 transition-colors duration-short group-hover:text-arctic-700">
            <span className="truncate">{shop.shopName}</span>
            {shop.verified && <VerifiedBadge size="sm" withLabel={false} className="shrink-0" />}
          </div>
          {shop.tagline ? (
            <div className="a-body-sm truncate text-arctic-600">{shop.tagline}</div>
          ) : null}
        </div>
      </div>

      {shop.bio ? (
        <p className="a-body-md line-clamp-2 text-arctic-700">{shop.bio}</p>
      ) : (
        <p className="a-body-sm italic text-arctic-500">No bio yet</p>
      )}

      {/* Mini Product Previews */}
      {shop.products && shop.products.length > 0 && (
        <div className="flex items-center gap-2 py-1">
          {shop.products.map((p) => (
            <div
              key={p.id}
              className="group/item relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-shape-md border border-arctic-300/40 bg-arctic-100/50"
              title={p.name}
            >
              {p.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="grid h-full w-full place-items-center text-[10px] font-semibold text-arctic-600">
                  {p.name.charAt(0)}
                </div>
              )}
            </div>
          ))}
          <span className="text-xs text-arctic-500 ml-1">Catalogue</span>
        </div>
      )}

      <div className="mt-auto flex flex-wrap gap-1.5 pt-1">
        {region ? (
          <span className="rounded-shape-sm border border-arctic-400/45 bg-white/65 px-2 py-0.5 a-label-md text-arctic-800 backdrop-blur-glass-thin">
            {region.label}
          </span>
        ) : null}
        {category ? (
          <span className="rounded-shape-sm border border-arctic-400/45 bg-arctic-200/65 px-2 py-0.5 a-label-md text-arctic-900 backdrop-blur-glass-thin">
            {category.icon} {category.label}
          </span>
        ) : null}
      </div>
    </Link>
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
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-transparent bg-white/0 backdrop-blur-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-800 font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
            <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
          </Link>
          <nav className="flex items-center gap-1.5">
            <Link
              href="/how-to-use"
              className="hidden a-label-md text-arctic-700 hover:text-arctic-900 sm:mr-1 sm:inline"
            >
              How it works
            </Link>
            <ThemeToggle className="mr-0.5" />
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
            <Link href="/signup" className="btn-primary">
              Open a shop
            </Link>
          </nav>
        </div>
      </header>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-12 text-center md:py-16">
          <h1 className="a-display-sm text-arctic-900 sm:a-display-md a-fade-in">
            Discover WhatsApp shops
            <br />
            <span className="text-arctic-700">near you.</span>
          </h1>
          <p className="a-body-lg a-measure mx-auto mt-4 text-arctic-700">
            Trusted WhatsApp sellers across Africa. Tap a shop, browse the catalog, order.
            You never leave WhatsApp.
          </p>

          {/* Prominent Search Bar */}
          <form method="GET" action="/marketplace" className="mx-auto mt-8 max-w-xl">
            {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
            {activeRegion && <input type="hidden" name="region" value={activeRegion} />}
            <div className="flex items-center rounded-shape-full border border-arctic-300/50 bg-white/80 p-1.5 shadow-elev-1 backdrop-blur-glass-md focus-within:border-arctic-600 focus-within:ring-2 focus-within:ring-arctic-400/20">
              <span className="pl-3.5 pr-2 text-arctic-500">🔍</span>
              <input
                type="text"
                name="q"
                defaultValue={query}
                placeholder="Search shops or products..."
                className="w-full bg-transparent px-2 py-2 a-body-md text-arctic-900 outline-none placeholder:text-arctic-400"
              />
              <button
                type="submit"
                className="rounded-shape-full bg-arctic-800 px-5 py-2 a-label-md text-white transition hover:bg-arctic-900"
              >
                Search
              </button>
            </div>
          </form>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        {/* Active Filters Bar */}
        {(activeCategory || activeRegion || query) && (
          <div className="mb-6 flex flex-wrap items-center gap-2 rounded-shape-md border border-arctic-300/40 bg-arctic-100/60 p-3">
            <span className="a-label-md text-arctic-600">Active filters:</span>
            {selectedCategoryObj && (
              <Link
                href={makeFilterUrl({ category: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-800 shadow-sm hover:bg-arctic-50"
              >
                {selectedCategoryObj.icon} {selectedCategoryObj.label}
                <span className="text-arctic-500 hover:text-arctic-900">✕</span>
              </Link>
            )}
            {selectedRegionObj && (
              <Link
                href={makeFilterUrl({ region: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-800 shadow-sm hover:bg-arctic-50"
              >
                📍 {selectedRegionObj.label}
                <span className="text-arctic-500 hover:text-arctic-900">✕</span>
              </Link>
            )}
            {query && (
              <Link
                href={makeFilterUrl({ q: "" })}
                className="inline-flex items-center gap-1.5 rounded-shape-full bg-white px-3 py-1 text-xs font-semibold text-arctic-800 shadow-sm hover:bg-arctic-50"
              >
                &ldquo;{query}&rdquo;
                <span className="text-arctic-500 hover:text-arctic-900">✕</span>
              </Link>
            )}
            <Link
              href="/marketplace"
              className="ml-auto text-xs font-semibold text-arctic-600 underline hover:text-arctic-900"
            >
              Reset all
            </Link>
          </div>
        )}

        <section className="mb-8">
          <h2 className="mb-3 a-label-md text-arctic-700">Browse by region</h2>
          <div className="flex flex-wrap gap-2">
            {REGIONS.map((r) => {
              const isSelected = activeRegion === r.slug;
              return (
                <Link
                  key={r.slug}
                  href={makeFilterUrl({ region: isSelected ? "" : r.slug })}
                  className={`a-chip transition-all ${
                    isSelected
                      ? "border-arctic-800 bg-arctic-800 text-white font-semibold"
                      : "hover:border-arctic-500"
                  }`}
                >
                  {r.label}
                  <span className={`ml-1 a-label-md ${isSelected ? "text-arctic-200" : "text-arctic-600"}`}>
                    {r.country}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <section className="mb-10">
          <h2 className="mb-3 a-label-md text-arctic-700">Browse by category</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const isSelected = activeCategory === c.slug;
              return (
                <Link
                  key={c.slug}
                  href={makeFilterUrl({ category: isSelected ? "" : c.slug })}
                  className={`a-chip transition-all ${
                    isSelected
                      ? "border-arctic-800 bg-arctic-800 text-white font-semibold"
                      : "hover:border-arctic-500"
                  }`}
                >
                  <span className="mr-1">{c.icon}</span>
                  {c.label}
                </Link>
              );
            })}
          </div>
        </section>

        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="a-headline-md text-arctic-900">
              {activeCategory || activeRegion || query ? "Matching shops" : "Featured shops"}
            </h2>
            <span className="a-body-sm text-arctic-600">{shops.length} shops</span>
          </div>
          {shops.length === 0 ? (
            <div className="glass glass-edge rounded-shape-lg p-6">
              <AuroraIsoscout
                variant="products"
                title="No shops found"
                body="Try modifying your filters or search terms."
                action={
                  <Link href="/marketplace" className="btn-primary">
                    View all shops
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="border-t border-arctic-400/30 bg-white/55 backdrop-blur-glass-thin">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center a-body-sm text-arctic-700">
          Japora — Sell on WhatsApp. Get paid. Grow your hustle.
        </div>
      </footer>
    </div>
  );
}
