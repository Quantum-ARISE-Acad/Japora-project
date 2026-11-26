/**
 * Public shop profile — Aurora skinned.
 *
 * Distinct from /c/[slug] (the orderable catalog). This is the marketplace
 * identity card: avatar, bio, region + category badges, featured products
 * preview, WhatsApp Assistant QR Code, and big CTAs (browse catalog, chat on WhatsApp).
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getShop } from "@/lib/directory";
import { findRegion, findCategory, categoryName, countryName } from "@/lib/regions";
import { waMeLink, formatMoney } from "@/lib/utils";
import Glyph from "@/components/Glyph";
import VerifiedBadge from "@/components/VerifiedBadge";
import ShopWhatsAppQrBanner from "@/components/ShopWhatsAppQrBanner";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { SaasIcon, CategoryIcon } from "@/components/ui/SaasIcons";
import { getPublicLocale, publicText } from "@/lib/public-locale";
import { getServerTr } from "@/lib/public-locale";

export const revalidate = 300;

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const shop = await getShop(slug);
  const tr = await getServerTr();
  if (!shop) return { title: tr("Boutique introuvable — Japora", "Shop not found — Japora") };
  return {
    title: tr(`${shop.shopName} sur Japora — Boutique WhatsApp`, `${shop.shopName} on Japora — WhatsApp shop`),
    description: shop.bio || shop.tagline || tr(`Commandez chez ${shop.shopName} sur WhatsApp.`, `Order from ${shop.shopName} on WhatsApp.`),
  };
}

export default async function PublicShopPage({ params }: Params) {
  const tr = await getServerTr();
  const { slug } = await params;
  const shop = await getShop(slug);
  if (!shop) notFound();

  const locale = await getPublicLocale();
  const t = (fr: string, en: string) => publicText(fr, en, locale);
  const region = findRegion(shop.region);
  const category = findCategory(shop.category);
  const initial = shop.shopName.charAt(0).toUpperCase() || "S";
  const cur = shop.currency || "XOF";
  const waLink = shop.whatsappNumber
    ? waMeLink(shop.whatsappNumber, `Bonjour ${shop.shopName} ! Je vous ai trouvé sur Japora.`)
    : null;

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 space-y-8">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-2 text-xs text-arctic-600">
          <Link
            href="/marketplace"
            className="inline-flex min-h-[24px] items-center font-semibold hover:text-arctic-900"
          >
            ← {t("Retour au Marketplace", "Back to Marketplace")}
          </Link>
          {region && (
            <>
              <span>·</span>
              <Link
                href={`/marketplace/${region.slug}`}
                className="inline-flex min-h-[24px] items-center gap-1 hover:text-arctic-900"
              >
                <SaasIcon name="map-pin" size={13} className="text-brand-dark" />
                <span>{region.label}</span>
              </Link>
            </>
          )}
          {category && (
            <>
              <span>·</span>
              <Link
                href={`/marketplace?category=${category.slug}`}
                className="inline-flex min-h-[24px] items-center gap-1 hover:text-arctic-900"
              >
                <CategoryIcon slug={category.slug} size={13} className="text-brand-dark" />
                <span>{tr(...categoryName(category))}</span>
              </Link>
            </>
          )}
        </nav>

        {/* Main Identity Card */}
        <section className="glass glass-edge overflow-hidden rounded-shape-xl shadow-elev-2">
          <div
            className="h-36 sm:h-44 relative z-0"
            style={{
              background:
                "linear-gradient(135deg, rgb(var(--c-800)) 0%, rgb(var(--c-700)) 48%, rgb(var(--gold-fill)) 100%)",
            }}
          >
            <div className="absolute right-4 top-4 flex items-center gap-2 rounded-full border border-arctic-50/25 bg-arctic-900/30 px-3 py-1 text-[11px] font-bold text-arctic-50 backdrop-blur-md">
              <span
                aria-hidden
                className="h-2 w-2 animate-pulse rounded-full"
                style={{ background: "var(--signal-live)" }}
              />
              <span>{t("Vitrine officielle Japora", "Official Japora storefront")}</span>
            </div>
          </div>

          <div className="relative z-10 px-6 pb-8 pt-0 sm:px-10">
            <div className="-mt-12 flex flex-wrap items-end justify-between gap-4 sm:gap-6">
              {shop.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={shop.avatarUrl}
                  alt={tr(`Logo de ${shop.shopName}`, `${shop.shopName} logo`)}
                  className="relative z-20 h-24 w-24 rounded-shape-lg border-4 border-white bg-white object-cover shadow-elev-2 sm:h-28 sm:w-28"
                />
              ) : (
                <div className="relative z-20 grid h-24 w-24 place-items-center rounded-shape-lg border-4 border-white bg-arctic-200 text-3xl font-black text-arctic-900 shadow-elev-2 sm:h-28 sm:w-28">
                  {initial}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2">
                {region ? (
                  <Link
                    href={`/marketplace/${region.slug}`}
                    className="a-chip inline-flex items-center gap-1.5"
                  >
                    <SaasIcon name="map-pin" size={13} className="text-brand-dark" />
                    <span>
                      {region.label}, {tr(...countryName(region.country))}
                    </span>
                  </Link>
                ) : null}
                {category && region ? (
                  <Link
                    href={`/marketplace/${region.slug}/${category.slug}`}
                    className="a-chip inline-flex items-center gap-1.5"
                  >
                    <CategoryIcon slug={category.slug} size={13} className="text-brand-dark" />
                    <span>{tr(...categoryName(category))}</span>
                  </Link>
                ) : category ? (
                  <span className="a-chip inline-flex items-center gap-1.5">
                    <CategoryIcon slug={category.slug} size={13} className="text-brand-dark" />
                    <span>{tr(...categoryName(category))}</span>
                  </span>
                ) : null}
              </div>
            </div>

            <div className="mt-5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="a-headline-lg text-arctic-900 sm:[font-size:var(--aurora-display-sm)] sm:[line-height:44px]">
                  {shop.shopName}
                </h1>
                {shop.verified && <VerifiedBadge size="md" />}
              </div>

              {shop.tagline ? (
                <p className="a-body-lg mt-1 font-medium text-brand-dark">
                  {shop.tagline}
                </p>
              ) : null}

              {shop.bio ? (
                <p className="a-body-md a-measure mt-4 whitespace-pre-line text-arctic-700 leading-relaxed">
                  {shop.bio}
                </p>
              ) : (
                <p className="a-body-sm mt-4 italic text-arctic-600">
                  {t(`Bienvenue sur la boutique officielle ${shop.shopName}. Parcourez le catalogue en ligne et commandez directement sur WhatsApp.`, `Welcome to ${shop.shopName}'s official shop. Browse the online catalog and order directly on WhatsApp.`)}
                </p>
              )}

              {/* Primary CTAs */}
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={`/c/${shop.shopSlug}`}
                  className="a-btn a-btn--cafe a-btn--lg flex-1 gap-2 font-bold shadow-elev-1"
                >
                  <SaasIcon name="catalog" size={16} />
                  <span>{t("Voir le catalogue", "View the catalog")}</span>
                  <SaasIcon name="arrow-right" size={15} />
                </Link>
                <Link
                  href={`/c/${shop.shopSlug}?assistant=open`}
                  className="btn-ghost a-btn--lg flex-1 gap-1.5 border border-emerald-500/40 text-emerald-800"
                >
                  <SaasIcon name="sparkles" size={16} />
                  <span>{t("Poser une question à l’IA", "Ask the AI a question")}</span>
                </Link>
                {waLink ? (
                  <a
                    href={waLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-ghost a-btn--lg flex-1 gap-1.5"
                  >
                    <Glyph name="chat" size={17} /> {t("Discuter sur WhatsApp", "Chat on WhatsApp")}
                  </a>
                ) : (
                  <span className="btn a-btn--lg flex-1 cursor-not-allowed border border-arctic-400/45 bg-white/40 text-arctic-600">
                    {t("WhatsApp non configuré", "WhatsApp not configured")}
                  </span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Featured Products Preview */}
        {shop.products && shop.products.length > 0 && (
          <section className="glass glass-edge rounded-shape-xl p-6 sm:p-8">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <div className="a-eyebrow">{t("Aperçu des articles", "Product preview")}</div>
                <h2 className="a-title-lg font-display text-arctic-900">
                  {t(`Articles en vedette chez ${shop.shopName}`, `Featured products at ${shop.shopName}`)}
                </h2>
              </div>
              <Link
                href={`/c/${shop.shopSlug}`}
                className="inline-flex min-h-[24px] items-center gap-1 text-xs font-bold text-brand-dark hover:underline"
              >
                <span>{t("Tout voir dans le catalogue", "View full catalog")}</span>
                <SaasIcon name="arrow-right" size={13} />
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {shop.products.map((p) => (
                <Link
                  key={p.id}
                  href={`/c/${shop.shopSlug}?product=${p.id}`}
                  className="group flex flex-col justify-between overflow-hidden rounded-shape-lg border border-arctic-200/80 bg-white/85 p-3.5 transition-all hover:-translate-y-1 hover:border-brand hover:shadow-elev-1"
                >
                  <div className="relative h-40 w-full overflow-hidden rounded-shape-md bg-arctic-100">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        className="h-full w-full object-cover transition-transform duration-short group-hover:scale-105"
                      />
                    ) : (
                      <div className="grid h-full w-full place-items-center text-2xl font-bold text-arctic-600">
                        {p.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-bold text-arctic-900 group-hover:text-brand-dark">
                      {p.name}
                    </span>
                    <span className="a-num shrink-0 text-xs font-extrabold text-brand-dark">
                      {formatMoney(p.priceCents, cur)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Shop WhatsApp QR Banner */}
        <ShopWhatsAppQrBanner
          shopName={shop.shopName}
          shopSlug={shop.shopSlug}
          whatsappNumber={shop.whatsappNumber || ""}
        />
      </main>

      <PublicFooter />
    </div>
  );
}
