/**
 * Public shop profile — Aurora skinned.
 *
 * Distinct from /c/[slug] (the orderable catalog). This is the marketplace
 * identity card: avatar, bio, region + category badges, WhatsApp Assistant QR Code,
 * and two big CTAs (browse catalog, chat on WhatsApp).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getShop } from "@/lib/directory";
import { findRegion, findCategory } from "@/lib/regions";
import { waMeLink } from "@/lib/utils";
import Glyph from "@/components/Glyph";
import ShopWhatsAppQrBanner from "@/components/ShopWhatsAppQrBanner";

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) return { title: "Shop not found — Japora" };
  return {
    title: `${shop.shopName} on Japora`,
    description: shop.bio || shop.tagline || `Chat with ${shop.shopName} on WhatsApp.`,
  };
}

export default async function PublicShopPage({ params }: Params) {
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) notFound();

  const region = findRegion(shop.region);
  const category = findCategory(shop.category);
  const initial = shop.shopName.charAt(0).toUpperCase() || "S";
  const waLink = shop.whatsappNumber
    ? waMeLink(shop.whatsappNumber, `Hi ${shop.shopName}! I found you on Japora.`)
    : null;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-transparent bg-white/0 backdrop-blur-0">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-800 font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
            <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
          </Link>
          <Link href="/marketplace" className="a-label-md text-arctic-700 hover:text-arctic-900">
            ← Marketplace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-10 space-y-6">
        <section className="glass glass-edge overflow-hidden rounded-shape-xl">
          <div
            className="h-32"
            style={{
              background:
                "linear-gradient(135deg, var(--arctic-200) 0%, var(--arctic-400) 45%, var(--arctic-700) 100%)",
            }}
          />
          <div className="px-6 pb-8 pt-0 sm:px-10">
            <div className="-mt-12 flex items-end gap-4 sm:gap-6">
              {shop.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.avatarUrl}
                  alt={`${shop.shopName} avatar`}
                  className="h-24 w-24 rounded-shape-lg border-4 border-white/85 object-cover shadow-elev-2 sm:h-28 sm:w-28"
                />
              ) : (
                <div className="grid h-24 w-24 place-items-center rounded-shape-lg border-4 border-white/85 bg-arctic-200/85 text-3xl font-black text-arctic-900 shadow-elev-2 backdrop-blur-glass-thin sm:h-28 sm:w-28">
                  {initial}
                </div>
              )}
            </div>

            <div className="mt-5">
              <h1 className="a-headline-lg text-arctic-900 sm:[font-size:var(--aurora-display-sm)] sm:[line-height:44px]">
                {shop.shopName}
              </h1>
              {shop.tagline ? (
                <p className="a-body-lg mt-1 text-arctic-700">{shop.tagline}</p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {region ? (
                  <Link href={`/marketplace/${region.slug}`} className="a-chip">
                    📍 {region.label}, {region.country}
                  </Link>
                ) : null}
                {category && region ? (
                  <Link
                    href={`/marketplace/${region.slug}/${category.slug}`}
                    className="a-chip"
                  >
                    {category.icon} {category.label}
                  </Link>
                ) : category ? (
                  <span className="a-chip">
                    {category.icon} {category.label}
                  </span>
                ) : null}
              </div>

              {shop.bio ? (
                <p className="a-body-md a-measure mt-6 whitespace-pre-line text-arctic-700">
                  {shop.bio}
                </p>
              ) : (
                <p className="a-body-sm mt-6 italic text-arctic-500">
                  This shop hasn&apos;t added a bio yet.
                </p>
              )}

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link href={`/c/${shop.shopSlug}`} className="btn-primary a-btn--lg flex-1">
                  Browse catalog →
                </Link>
                <Link
                  href={`/c/${shop.shopSlug}?assistant=open`}
                  className="btn-ghost a-btn--lg flex-1 gap-1.5 border border-emerald-500/40 text-emerald-800"
                >
                  ✨ Poser une question à l&apos;IA
                </Link>
                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost a-btn--lg flex-1 gap-1.5"
                  >
                    <Glyph name="chat" size={17} /> Chat on WhatsApp
                  </a>
                ) : (
                  <span className="btn a-btn--lg flex-1 cursor-not-allowed border border-arctic-400/45 bg-white/40 text-arctic-500">
                    WhatsApp not set
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        <ShopWhatsAppQrBanner
          shopName={shop.shopName}
          shopSlug={shop.shopSlug}
          whatsappNumber={shop.whatsappNumber || ""}
        />

        <p className="mt-6 text-center a-label-md text-arctic-600">
          Powered by Japora — Sell on WhatsApp. Get paid. Grow your hustle.
        </p>
      </main>
    </div>
  );
}
