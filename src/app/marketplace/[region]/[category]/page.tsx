/**
 * Public marketplace — region + category filter. Aurora skinned.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { listShops } from "@/lib/directory";
import { CATEGORIES, findRegion, findCategory } from "@/lib/regions";
import { AuroraIsoscout } from "@/components/aurora";
import VerifiedBadge from "@/components/VerifiedBadge";

export const revalidate = 300;

type Params = { params: Promise<{ region: string; category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { region, category } = await params;
  const r = findRegion(region);
  const c = findCategory(category);
  if (!r || !c) return { title: "Not found — Japora" };
  return {
    title: `${c.label} shops in ${r.label} — Japora`,
    description: `Browse ${c.label.toLowerCase()} WhatsApp shops in ${r.label}, ${r.country}.`,
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
            className="h-14 w-14 rounded-full object-cover"
          />
        ) : (
          <div className="grid h-14 w-14 place-items-center rounded-full bg-arctic-200/85 a-title-md text-arctic-900 backdrop-blur-glass-thin">
            {initial}
          </div>
        )}
        <div className="min-w-0">
          <div className="a-title-lg flex items-center gap-1.5 truncate text-arctic-900 transition-colors duration-short group-hover:text-arctic-700">
            <span className="truncate">{shop.shopName}</span>
            {shop.verified && <VerifiedBadge withLabel={false} className="shrink-0" />}
          </div>
          {shop.tagline ? (
            <div className="a-body-sm truncate text-arctic-600">{shop.tagline}</div>
          ) : null}
        </div>
      </div>
      {shop.bio ? (
        <p className="a-body-md line-clamp-3 text-arctic-700">{shop.bio}</p>
      ) : (
        <p className="a-body-sm italic text-arctic-500">No bio yet</p>
      )}
      <div className="mt-auto a-label-md text-arctic-700 group-hover:underline">
        View shop →
      </div>
    </Link>
  );
}

export default async function MarketplaceRegionCategoryPage({ params }: Params) {
  const { region, category } = await params;
  const r = findRegion(region);
  const c = findCategory(category);
  if (!r || !c) notFound();

  const shops = await listShops({ region, category, take: 24 });

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-transparent bg-white/0 backdrop-blur-0">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-800 font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
            <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
          </Link>
          <nav className="flex items-center gap-2 a-label-md">
            <Link href="/marketplace" className="text-arctic-700 hover:text-arctic-900">
              All
            </Link>
            <span className="text-arctic-400">/</span>
            <Link href={`/marketplace/${r.slug}`} className="text-arctic-700 hover:text-arctic-900">
              {r.label}
            </Link>
            <span className="text-arctic-400">/</span>
            <span className="font-semibold text-arctic-900">{c.label}</span>
          </nav>
        </div>
      </header>

      <section>
        <div className="mx-auto max-w-6xl px-4 py-10 md:py-14">
          <p className="a-label-md text-arctic-700">{r.label} · {r.country}</p>
          <h1 className="a-headline-lg mt-1 text-arctic-900 sm:[font-size:var(--aurora-display-sm)] sm:[line-height:44px]">
            {c.icon} {c.label} shops
          </h1>
          <p className="a-body-lg a-measure mt-2 text-arctic-700">
            Trusted WhatsApp {c.label.toLowerCase()} sellers in {r.label}. Tap a shop to view
            their catalog and chat.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pb-16">
        <section className="mb-8">
          <h2 className="mb-3 a-label-md text-arctic-700">
            Other categories in {r.label}
          </h2>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.filter((x) => x.slug !== c.slug).map((x) => (
              <Link
                key={x.slug}
                href={`/marketplace/${r.slug}/${x.slug}`}
                className="a-chip"
              >
                <span className="mr-1">{x.icon}</span>
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
                title={`No ${c.label.toLowerCase()} shops in ${r.label} yet`}
                body={`Be the first to list ${c.label.toLowerCase()} in ${r.label}. Toggle the public-marketplace switch in your settings and you'll appear here.`}
                action={
                  <Link href="/signup" className="btn-primary">
                    Be the first
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
