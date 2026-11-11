/**
 * Public marketplace — region filter. Aurora skinned.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listShops } from "@/lib/directory";
import { CATEGORIES, REGIONS, findRegion, findCategory } from "@/lib/regions";
import { AuroraIsoscout } from "@/components/aurora";
import VerifiedBadge from "@/components/VerifiedBadge";

export const revalidate = 300;

type Params = { params: Promise<{ region: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { region } = await params;
  const r = findRegion(region);
  if (!r) return { title: "Region not found — Japora" };
  return {
    title: `WhatsApp shops in ${r.label} — Japora`,
    description: `Trusted WhatsApp sellers in ${r.label}, ${r.country}. Fashion, food, beauty, more.`,
  };
}

function ShopCard({
  shop,
}: {
  shop: {
    id: string;
    shopName: string;
    shopSlug: string;
    bio: string;
    avatarUrl: string;
    region: string;
    category: string;
    tagline: string;
    verified: boolean;
  };
}) {
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
      <div className="mt-auto flex flex-wrap gap-1.5">
        {category ? (
          <span className="rounded-shape-sm border border-arctic-400/45 bg-arctic-200/65 px-2 py-0.5 a-label-md text-arctic-900 backdrop-blur-glass-thin">
            {category.icon} {category.label}
          </span>
        ) : null}
        <span className="a-label-md text-arctic-700 group-hover:underline">View shop →</span>
      </div>
    </Link>
  );
}

export default async function MarketplaceRegionPage({ params }: Params) {
  const { region } = await params;
  const r = findRegion(region);
  if (!r) notFound();

  const shops = await listShops({ region, take: 24 });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-transparent bg-white/0 backdrop-blur-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-800 font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
            <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
          </Link>
          <Link href="/marketplace" className="a-label-md text-arctic-700 hover:text-arctic-900">
            ← All regions
          </Link>
        </div>
      </header>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="a-label-md text-arctic-700">{r.country}</p>
          <h1 className="a-headline-lg mt-1 text-arctic-900 sm:[font-size:var(--aurora-display-sm)] sm:[line-height:44px]">
            Shops in {r.label}
          </h1>
          <p className="a-body-lg a-measure mt-2 text-arctic-700">
            Browse WhatsApp sellers in {r.label}. Tap a shop to view their catalog and chat.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="mb-10">
          <h2 className="mb-3 a-label-md text-arctic-700">Filter by category</h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                href={`/marketplace/${r.slug}/${c.slug}`}
                className="a-chip"
              >
                <span className="mr-1">{c.icon}</span>
                {c.label}
              </Link>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="a-label-md text-arctic-700">Other regions:</span>
            {REGIONS.filter((x) => x.slug !== r.slug)
              .slice(0, 6)
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

        <section>
          <div className="mb-5 flex items-end justify-between">
            <h2 className="a-headline-md text-arctic-900">
              {shops.length} {shops.length === 1 ? "shop" : "shops"}
            </h2>
          </div>
          {shops.length === 0 ? (
            <div className="glass glass-edge rounded-shape-lg p-6">
              <AuroraIsoscout
                variant="products"
                title={`No public shops in ${r.label} yet`}
                body="Be the first to list your hustle here. Toggle the public-marketplace switch in your settings and your shop appears in this grid."
                action={
                  <Link href="/signup" className="btn-primary">
                    Open the first one
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
    </div>
  );
}
