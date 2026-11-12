"use client";

import Link from "next/link";
import type { ShopCard } from "@/lib/directory";
import { REGIONS, CATEGORIES, findRegion, findCategory } from "@/lib/regions";
import VerifiedBadge from "@/components/VerifiedBadge";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { SaasIcon, CategoryIcon, type SaasIconName } from "@/components/ui/SaasIcons";

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

export default function LandingClient({
  featuredShops,
}: {
  featuredShops: ShopCard[];
}) {
  const { tr } = usePublicLang();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-6xl flex-1 px-4">
        {/* ============================================================
         * 1. HERO SECTION — Image on the Left, Pitch on the Right
         * ============================================================ */}
        <section className="grid items-center gap-10 py-10 md:grid-cols-[1.05fr,1.1fr] md:py-16 lg:gap-14">
          {/* LEFT: Generated Lifestyle Boutique Image + Floating Live Overlays */}
          <div className="relative order-1 a-fade-in">
            {/* Soft aurora glow behind the image */}
            <div
              aria-hidden
              className="absolute -inset-4 -z-10 rounded-[36px] opacity-75 blur-2xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgb(var(--gold) / 0.32), rgb(var(--c-300) / 0.4) 65%, transparent)",
              }}
            />

            <div className="glass glass-edge relative overflow-hidden rounded-shape-xl p-2.5 shadow-elev-3">
              <div className="relative overflow-hidden rounded-shape-lg aspect-[4/3] bg-arctic-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/hero-merchant.jpg"
                  alt={tr(
                    "Commerçante africaine gérant sa boutique en ligne et ses ventes WhatsApp avec Japora",
                    "African merchant managing her online shop and WhatsApp sales with Japora"
                  )}
                  className="h-full w-full object-cover object-center transition-transform duration-long hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                {/* Top-left floating badge */}
                <div className="absolute left-3.5 top-3.5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
                  <span className="h-2 w-2 animate-ping rounded-full bg-emerald-400" />
                  <span>
                    {tr(
                      "Boutique en ligne + Bot WhatsApp actif",
                      "Online Storefront + Active WhatsApp Bot"
                    )}
                  </span>
                </div>

                {/* Bottom overlay inside the image frame */}
                <div className="absolute bottom-3.5 left-3.5 right-3.5 flex flex-wrap items-center justify-between gap-2 rounded-shape-md border border-white/25 bg-white/90 p-3 text-arctic-900 shadow-elev-2 backdrop-blur-md">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-700 text-white">
                      <SaasIcon name="check" size={16} />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-arctic-900">
                        {tr(
                          "Nouvelle commande payée · T-Money",
                          "New paid order · T-Money"
                        )}
                      </div>
                      <div className="text-[11px] text-arctic-600">
                        {tr(
                          "2× Robe Bazin Brodé · Livraison Lomé Centre",
                          "2× Embroidered Bazin Dress · Lomé Center Delivery"
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="a-num font-display text-sm font-extrabold text-emerald-700">
                      +24 500 FCFA
                    </div>
                    <div className="text-[10px] font-semibold text-arctic-500">
                      {tr("Stock mis à jour", "Stock updated")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom mini KPI strip under image */}
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-shape-md bg-white/75 px-2.5 py-2">
                  <div className="text-[10px] font-semibold text-arctic-500">
                    {tr("Réponse Bot", "Bot Reply")}
                  </div>
                  <div className="a-num text-xs font-bold text-arctic-900">
                    &lt; 2 sec (24h/24)
                  </div>
                </div>
                <div className="rounded-shape-md bg-white/75 px-2.5 py-2">
                  <div className="text-[10px] font-semibold text-arctic-500">
                    {tr("Encaissement", "Payments")}
                  </div>
                  <div className="text-xs font-bold text-brand-dark">
                    T-Money · Flooz · Wave
                  </div>
                </div>
                <div className="rounded-shape-md bg-white/75 px-2.5 py-2">
                  <div className="text-[10px] font-semibold text-arctic-500">
                    {tr("Bilan quotidien", "Daily Summary")}
                  </div>
                  <div className="text-xs font-bold text-emerald-800">
                    {tr("Chaque soir à 18h", "Every evening at 6 PM")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Headline, Refined Pitch & CTAs */}
          <div className="order-2 a-fade-in">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-shape-full border border-brand/35 bg-white/80 px-3.5 py-1.5 shadow-elev-1 backdrop-blur-glass-thin">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
              <span className="a-label-md text-arctic-900">
                {tr(
                  "La plateforme e-commerce & WhatsApp des marchands africains",
                  "The e-commerce & WhatsApp platform for African merchants"
                )}
              </span>
            </div>

            <h1 className="a-display-md mt-5 text-arctic-900 sm:[font-size:44px] sm:[line-height:52px]">
              {tr(
                "Vendez en ligne et sur WhatsApp,",
                "Sell online and on WhatsApp,"
              )}{" "}
              <span className="text-brand-dark">
                {tr(
                  "suivez vos ventes et encaissez en toute simplicité.",
                  "track your sales and get paid effortlessly."
                )}
              </span>
            </h1>

            <p className="a-body-lg a-measure mt-4 leading-relaxed text-arctic-700">
              {tr(
                "Créez votre boutique en ligne en quelques instants, laissez votre assistant WhatsApp répondre aux clients 24h/24, encaissez par Mobile Money (T-Money, Flooz, Wave, Orange Money) et pilotez vos stocks, vos livraisons et votre chiffre d'affaires en temps réel.",
                "Create your online storefront in moments, let your WhatsApp assistant reply to customers 24/7, accept Mobile Money payments (T-Money, Flooz, Wave, Orange Money), and manage your inventory, deliveries, and revenue in real time."
              )}
            </p>

            {/* Primary CTAs */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="a-btn a-btn--cafe a-btn--lg font-bold shadow-elev-2"
              >
                <span>
                  {tr(
                    "Ouvrir ma boutique gratuitement",
                    "Open my free shop now"
                  )}
                </span>
                <SaasIcon name="arrow-right" size={16} />
              </Link>
              <Link
                href="/marketplace"
                className="btn-ghost a-btn--lg flex items-center gap-2"
              >
                <SaasIcon name="store" size={16} className="text-brand-dark" />
                <span>
                  {tr("Explorer le Marketplace", "Explore the Marketplace")}
                </span>
              </Link>
            </div>

            {/* Trust Micro-pills */}
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-arctic-200/70 pt-5">
              <div>
                <div className="a-num font-display text-lg font-bold text-arctic-900">
                  ~2 min
                </div>
                <div className="text-[11px] text-arctic-600">
                  {tr(
                    "Mise en ligne de votre boutique",
                    "Quick storefront setup"
                  )}
                </div>
              </div>
              <div>
                <div className="a-num font-display text-lg font-bold text-arctic-900">
                  24h / 24
                </div>
                <div className="text-[11px] text-arctic-600">
                  {tr(
                    "Catalogue & Bot automatisés",
                    "Automated Catalog & Bot"
                  )}
                </div>
              </div>
              <div>
                <div className="a-num font-display text-lg font-bold text-arctic-900">
                  100%
                </div>
                <div className="text-[11px] text-arctic-600">
                  {tr(
                    "Suivi des commandes & stocks",
                    "Orders & inventory tracking"
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 2. PAYMENT RAILS & PAN-AFRICAN COVERAGE STRIP
         * ============================================================ */}
        <section className="mb-16">
          <div className="glass glass-edge rounded-shape-xl px-6 py-5">
            <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
              <div className="text-center lg:text-left">
                <div className="a-eyebrow">
                  {tr(
                    "Rails de paiement & Marchés",
                    "Payment Rails & Markets"
                  )}
                </div>
                <p className="mt-0.5 text-xs font-semibold text-arctic-800">
                  {tr(
                    "Conçu pour le Togo, la zone UEMOA (FCFA) et toute l'Afrique",
                    "Built for Togo, Francophone West Africa (XOF), and across Africa"
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { name: "T-Money", region: "TG · Togo" },
                  { name: "Flooz (Moov)", region: "TG · BJ · UEMOA" },
                  { name: "CinetPay", region: "West Africa" },
                  { name: "Wave", region: "SN · CI" },
                  { name: "Orange Money", region: "Zone Franc" },
                  { name: "MTN MoMo", region: "BJ · GH · CI" },
                  { name: "Paystack & M-Pesa", region: "NG · KE" },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="inline-flex items-center gap-2 rounded-shape-full border border-arctic-300/70 bg-white/80 px-3 py-1.5 text-xs shadow-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    <span className="font-bold text-arctic-900">{p.name}</span>
                    <span className="rounded bg-arctic-100 px-1.5 py-0.5 text-[10px] font-semibold text-arctic-600">
                      {p.region}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 3. PUBLIC SHOP SEARCH & MARKETPLACE DISCOVERY
         * ============================================================ */}
        <section className="mb-20 rounded-shape-xl border border-arctic-300/60 bg-gradient-to-b from-white/95 to-arctic-50/85 p-6 shadow-elev-2 backdrop-blur-md md:p-10">
          <div className="mx-auto max-w-3xl text-center">
            <span className="a-eyebrow">
              {tr(
                "Annuaire Public & Découverte",
                "Public Directory & Discovery"
              )}
            </span>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              {tr(
                "Trouvez une boutique vérifiée ou un produit près de chez vous",
                "Find a verified shop or product near you"
              )}
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              {tr(
                "Explorez les catalogues des commerçants indépendants de Lomé, Cotonou, Abidjan, Dakar et au-delà. Commandez en ligne ou directement sur leur WhatsApp.",
                "Browse catalogs from independent merchants across Lomé, Cotonou, Abidjan, Dakar, and beyond. Order online or directly in their WhatsApp."
              )}
            </p>

            {/* Direct Search Bar */}
            <form
              action="/marketplace"
              method="GET"
              className="mt-6 flex flex-col gap-2.5 sm:flex-row"
            >
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-arctic-500">
                  <SaasIcon name="search" size={18} />
                </span>
                <input
                  type="text"
                  name="q"
                  placeholder={tr(
                    "Rechercher une boutique, robe wax, iPhone, cosmétiques, Lomé…",
                    "Search for a shop, ankara dress, iPhone, cosmetics, Lomé…"
                  )}
                  className="w-full rounded-shape-full border border-arctic-300/90 bg-white py-3.5 pl-11 pr-4 text-sm text-arctic-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                />
              </div>
              <button
                type="submit"
                className="btn-primary whitespace-nowrap rounded-shape-full px-7 py-3.5 font-bold"
              >
                {tr("Rechercher", "Search Marketplace")}
              </button>
            </form>

            {/* Quick Category Pills */}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((c) => (
                <Link
                  key={c.slug}
                  href={`/marketplace?category=${c.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-shape-full border border-arctic-300/70 bg-white/85 px-3.5 py-1.5 text-xs font-semibold text-arctic-800 shadow-xs transition-all hover:-translate-y-0.5 hover:border-brand hover:bg-white"
                >
                  <CategoryIcon slug={c.slug} size={14} className="text-brand-dark" />
                  <span>{tr(CATEGORY_FR[c.slug] || c.label, c.label)}</span>
                </Link>
              ))}
            </div>

            {/* Quick Region Links */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-arctic-600">
              <span className="font-semibold text-arctic-700">
                {tr("Villes phares :", "Top cities:")}
              </span>
              {REGIONS.slice(0, 7).map((r) => (
                <Link
                  key={r.slug}
                  href={`/marketplace/${r.slug}`}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium text-arctic-700 hover:bg-arctic-200/60 hover:text-arctic-900"
                >
                  <SaasIcon name="map-pin" size={12} className="text-brand-dark" />
                  <span>{r.label}</span>
                </Link>
              ))}
            </div>
          </div>

          {/* Featured Shops Grid */}
          <div className="mt-10 border-t border-arctic-200/70 pt-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="a-eyebrow">
                  {tr("Sélection du moment", "Featured Selection")}
                </div>
                <h3 className="a-title-lg font-display text-arctic-900">
                  {tr(
                    "Boutiques populaires à découvrir",
                    "Popular shops to discover"
                  )}
                </h3>
              </div>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-dark hover:underline"
              >
                <span>
                  {tr(
                    "Voir toutes les boutiques du Marketplace",
                    "View all shops in Marketplace"
                  )}
                </span>
                <SaasIcon name="arrow-right" size={14} />
              </Link>
            </div>

            {featuredShops.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {featuredShops.map((shop) => {
                  const regionObj = findRegion(shop.region);
                  const categoryObj = findCategory(shop.category);
                  return (
                    <Link
                      key={shop.id}
                      href={`/shop/${shop.shopSlug}`}
                      className="group flex flex-col justify-between rounded-shape-xl border border-arctic-200/80 bg-white/90 p-5 shadow-sm transition-all duration-short hover:-translate-y-1 hover:border-brand/60 hover:shadow-elev-2"
                    >
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
                            <div className="grid h-12 w-12 place-items-center rounded-full bg-arctic-100 text-lg font-bold text-arctic-800">
                              {shop.shopName?.charAt(0)?.toUpperCase() || "B"}
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 truncate font-bold text-arctic-900 group-hover:text-brand-dark">
                              <span className="truncate">{shop.shopName}</span>
                              {shop.verified && (
                                <VerifiedBadge size="sm" withLabel={false} />
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-arctic-500">
                              <SaasIcon name="map-pin" size={12} className="text-arctic-400" />
                              <span className="truncate">
                                {regionObj
                                  ? `${regionObj.label}, ${regionObj.country}`
                                  : shop.region || "Togo"}
                              </span>
                              <span>·</span>
                              <span className="inline-flex items-center gap-1 truncate">
                                <CategoryIcon
                                  slug={categoryObj?.slug}
                                  size={12}
                                  className="text-brand-dark"
                                />
                                {categoryObj
                                  ? tr(
                                      CATEGORY_FR[categoryObj.slug] ||
                                        categoryObj.label,
                                      categoryObj.label
                                    )
                                  : shop.category || tr("Commerce", "General")}
                              </span>
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-arctic-600">
                          {shop.tagline ||
                            shop.bio ||
                            tr(
                              "Boutique officielle disponible en ligne et sur WhatsApp.",
                              "Official shop available online and on WhatsApp."
                            )}
                        </p>

                        {shop.products && shop.products.length > 0 && (
                          <div className="mt-3 flex items-center gap-2">
                            {shop.products.map((p) => (
                              <div
                                key={p.id}
                                className="h-11 w-11 overflow-hidden rounded-shape-sm border border-arctic-200 bg-arctic-100/60"
                                title={p.name}
                              >
                                {p.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    src={p.imageUrl}
                                    alt={p.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-[10px] font-bold text-arctic-600">
                                    {p.name.charAt(0)}
                                  </div>
                                )}
                              </div>
                            ))}
                            <span className="text-[11px] font-medium text-arctic-500">
                              {tr("Catalogue actif", "Live catalog")}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-arctic-100 pt-3 text-xs font-semibold text-arctic-800 group-hover:text-brand-dark">
                        <span>
                          {tr(
                            "Visiter la vitrine & commander",
                            "Visit shop & order"
                          )}
                        </span>
                        <span className="transition-transform group-hover:translate-x-1">
                          <SaasIcon name="arrow-right" size={14} />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-shape-lg border border-arctic-200/80 bg-white/70 p-8 text-center">
                <p className="text-sm font-semibold text-arctic-800">
                  {tr(
                    "Découvrez les premières boutiques vérifiées sur le Marketplace Japora.",
                    "Discover the first verified shops on the Japora Marketplace."
                  )}
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Link href="/marketplace" className="btn-primary text-xs">
                    {tr("Ouvrir le Marketplace", "Open Marketplace")}
                  </Link>
                  <Link href="/signup" className="btn-ghost text-xs">
                    {tr("Inscrire ma boutique", "List my shop")}
                  </Link>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================
         * 4. CORE PILLARS TRIO — Bot, Payment, 6 PM Summary
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <div className="a-eyebrow">
              {tr(
                "L'automatisation au service du marchand",
                "Automation built for merchants"
              )}
            </div>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              {tr(
                "Trois piliers pour vendre en ligne, sur WhatsApp et suivre votre activité",
                "Three pillars to sell online, on WhatsApp, and track your business"
              )}
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              {tr(
                "Restez concentré sur vos produits et vos clients. Japora automatise la prise de commande, le paiement et le suivi comptable.",
                "Stay focused on your products and customers. Japora automates order taking, payments, and daily bookkeeping."
              )}
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                k: "bot",
                badge: tr("Pilier 01 · Réponse 24h/24", "Pillar 01 · 24/7 Replies"),
                title: tr("Un Bot dans votre WhatsApp", "A Bot in your WhatsApp"),
                body: tr(
                  "Répond automatiquement aux « C'est combien ? » et « C'est disponible ? » depuis votre catalogue en temps réel. Boutons interactifs, gestion des tailles et message d'absence inclus.",
                  "Automatically answers 'How much?' and 'Is this in stock?' from your live catalog. Interactive buttons, size selection, and away messages included."
                ),
                bullets: [
                  tr(
                    "Boutons interactifs (Menu, Commander, Solde)",
                    "Interactive buttons (Menu, Order, Balance)"
                  ),
                  tr(
                    "Horaires d'ouverture & message d'absence auto",
                    "Business hours & automated away message"
                  ),
                  tr(
                    "Import en 1 clic depuis WhatsApp Business",
                    "1-click import from WhatsApp Business"
                  ),
                ],
                accent:
                  "linear-gradient(135deg, rgb(var(--gold) / 0.14), transparent 70%)",
              },
              {
                k: "pay",
                badge: tr("Pilier 02 · Encaissement", "Pillar 02 · Payments"),
                title: tr(
                  "Encaissez là où sont vos clients",
                  "Get paid where your customers are"
                ),
                body: tr(
                  "T-Money, Flooz, Wave, Orange Money ou paiement à la livraison. Le client règle dans la conversation et votre commande passe en « Payé » dès confirmation.",
                  "T-Money, Flooz, Wave, Orange Money, or Cash on Delivery. Customers pay inline and your order flips to 'Paid' the moment money clears."
                ),
                bullets: [
                  tr(
                    "PayGate Global (T-Money & Flooz natifs au Togo)",
                    "PayGate Global (native T-Money & Flooz in Togo)"
                  ),
                  tr(
                    "CinetPay, Wave, Orange Money & MTN MoMo",
                    "CinetPay, Wave, Orange Money & MTN MoMo"
                  ),
                  tr(
                    "Liens de paiement rapides pour acomptes",
                    "Quick payment links for deposits & pre-orders"
                  ),
                ],
                accent:
                  "linear-gradient(135deg, rgb(var(--c-300) / 0.5), transparent 70%)",
              },
              {
                k: "summary",
                badge: tr("Pilier 03 · Suivi des ventes", "Pillar 03 · Sales Tracking"),
                title: tr(
                  "Suivi en direct & bilan à 18h00",
                  "Live tracking & 6 PM daily summary"
                ),
                body: tr(
                  "Pilotez toutes vos commandes sur un tableau Kanban clair et recevez chaque soir à 18h sur WhatsApp le résumé de votre journée : chiffre d'affaires, meilleur produit et alertes de stock.",
                  "Manage every order on a clean Kanban board and receive a 6 PM WhatsApp recap every evening: daily revenue, top seller, and low-stock alerts."
                ),
                bullets: [
                  tr(
                    "Tableau Kanban : Nouvelle → Confirmée → Payée → Livrée",
                    "Kanban board: New → Confirmed → Paid → Delivered"
                  ),
                  tr(
                    "Comptabilité mensuelle P&L exportable",
                    "Exportable monthly P&L bookkeeping"
                  ),
                  tr(
                    "Alertes de stock bas avant la rupture",
                    "Low-stock alerts before you run out"
                  ),
                ],
                accent:
                  "linear-gradient(135deg, rgb(var(--gold) / 0.10), transparent 70%)",
              },
            ].map((f, i) => (
              <article
                key={f.k}
                className="glass glass-edge a-hover-lift relative flex flex-col justify-between rounded-shape-xl p-6"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 rounded-shape-xl opacity-70"
                  style={{ background: f.accent }}
                />
                <div className="relative">
                  <div className="flex items-center justify-between">
                    <FeatureGlyph k={f.k} />
                    <span className="rounded-full border border-arctic-300/70 bg-white/70 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                      {f.badge}
                    </span>
                  </div>
                  <h3 className="a-title-lg mt-4 font-display text-arctic-900">
                    {f.title}
                  </h3>
                  <p className="a-body-md mt-2 leading-relaxed text-arctic-700">
                    {f.body}
                  </p>
                  <ul className="mt-4 space-y-1.5 border-t border-arctic-200/70 pt-3 text-xs text-arctic-800">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <SaasIcon name="check" size={14} className="mt-0.5 text-brand-dark" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 5. BEFORE / AFTER COMPARISON — Sans Japora vs Avec Japora
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <div className="a-eyebrow">
              {tr("Pourquoi passer à Japora ?", "Why switch to Japora?")}
            </div>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              {tr(
                "Passez du chaos des messages vocaux à un commerce structuré",
                "Move from voice-note chaos to a structured online business"
              )}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Sans Japora */}
            <div className="rounded-shape-xl border border-arctic-300/70 bg-white/60 p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-700">
                <SaasIcon name="x" size={14} />
                <span>
                  {tr(
                    "Vendre sur WhatsApp sans outil",
                    "Selling on WhatsApp without tools"
                  )}
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-arctic-900">
                {tr(
                  "Des heures perdues chaque jour à répéter les mêmes infos",
                  "Hours lost every day repeating the same information"
                )}
              </h3>
              <ul className="mt-4 space-y-3 text-xs text-arctic-700 sm:text-sm">
                {[
                  tr(
                    "Répéter « C'est combien ? » et renvoyer 30 photos par jour dans chaque discussion.",
                    "Answering 'How much?' and forwarding 30 product photos in every chat."
                  ),
                  tr(
                    "Clients qui disparaissent au moment de payer ou faux rendez-vous de livraison.",
                    "Buyers disappearing at checkout or missed delivery appointments."
                  ),
                  tr(
                    "Captures d'écran Mobile Money difficiles à vérifier et risques d'erreurs.",
                    "Hard-to-verify Mobile Money screenshots and manual mistakes."
                  ),
                  tr(
                    "Oubli des clients qui ont acheté à crédit (« carnet de dettes » sur papier).",
                    "Forgetting customers who bought on credit in paper notebooks."
                  ),
                  tr(
                    "Aucune visibilité réelle sur les ventes et le bénéfice net à la fin du mois.",
                    "Zero clear visibility on total sales and net profit at the end of the month."
                  ),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <SaasIcon name="x" size={15} className="mt-0.5 text-red-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Avec Japora */}
            <div className="glass glass-edge relative overflow-hidden rounded-shape-xl border-brand/40 p-6 shadow-elev-2 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800">
                <SaasIcon name="check" size={14} />
                <span>
                  {tr(
                    "Avec votre boutique Japora",
                    "With your Japora shop"
                  )}
                </span>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-arctic-900">
                {tr(
                  "Votre boutique vend et suit chaque commande 24h/24",
                  "Your shop sells and tracks every order 24/7"
                )}
              </h3>
              <ul className="mt-4 space-y-3 text-xs text-arctic-800 sm:text-sm">
                {[
                  tr(
                    "Un seul lien catalogue élégant + QR code imprimable pour votre stand au marché.",
                    "One clean catalog link + printable QR code for your physical market stall."
                  ),
                  tr(
                    "Le bot WhatsApp répond instantanément avec prix, tailles et stock en direct.",
                    "The WhatsApp bot replies instantly with live prices, sizes, and stock."
                  ),
                  tr(
                    "Paiement Mobile Money intégré ou acompte sécurisé avant la préparation du colis.",
                    "Inline Mobile Money payment or deposit secured before packing the order."
                  ),
                  tr(
                    "Suivi automatique des créances clients (Pay-later) avec relances en un clic.",
                    "Automated customer credit ledger (Pay-later) with one-tap reminders."
                  ),
                  tr(
                    "Tableau Kanban des commandes + bilan comptable tous les soirs à 18h00.",
                    "Kanban order board + automated daily summary every evening at 6 PM."
                  ),
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <SaasIcon name="check" size={15} className="mt-0.5 text-emerald-700" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 6. COMPLETE MERCHANT TOOLKIT — 8 Bento Cards
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="a-eyebrow">
              {tr("Boîte à outils tout-en-un", "All-in-One Merchant Toolkit")}
            </span>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              {tr(
                "Tout ce dont vous avez besoin pour vendre et suivre vos ventes",
                "Everything you need to sell online and track your sales"
              )}
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              {tr(
                "De la gestion des livraisons par quartier jusqu'à la comptabilité mensuelle, chaque fonctionnalité est pensée pour votre réussite.",
                "From neighborhood delivery zones to monthly bookkeeping, every feature is crafted for your growth."
              )}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  icon: "truck" as SaasIconName,
                  tag: tr("Logistique locale", "Local Logistics"),
                  title: tr(
                    "Tarifs de livraison par quartier",
                    "Neighborhood Delivery Zones"
                  ),
                  desc: tr(
                    "Configurez vos zones (Lomé Centre, Agoè, Baguida, Akpakpa, Cocody…) avec calcul automatique des frais.",
                    "Set your delivery rates by neighborhood (Lomé Center, Agoè, Cocody…) with automatic fee calculation."
                  ),
                },
                {
                  icon: "link" as SaasIconName,
                  tag: tr("Encaissement", "Payments"),
                  title: tr(
                    "Liens de paiement & Acomptes",
                    "Payment Links & Deposits"
                  ),
                  desc: tr(
                    "Générez un lien de paiement Mobile Money en 5 secondes pour sécuriser une commande sur-mesure ou une précommande.",
                    "Create a Mobile Money payment link in 5 seconds to secure custom orders or pre-order deposits."
                  ),
                },
                {
                  icon: "users" as SaasIconName,
                  tag: tr("CRM & Crédit", "CRM & Credit"),
                  title: tr(
                    "Fichier clients & Créances",
                    "Customer Ledger & Receivables"
                  ),
                  desc: tr(
                    "Historique d'achats par numéro WhatsApp, statut VIP fidélité automatique et suivi des ventes à crédit.",
                    "Purchase history by WhatsApp phone number, automatic VIP loyalty tiers, and pay-later credit tracking."
                  ),
                },
                {
                  icon: "megaphone" as SaasIconName,
                  tag: tr("Fidélisation", "Retention"),
                  title: tr(
                    "Diffusions & Alertes Nouveautés",
                    "Broadcasts & New Drop Alerts"
                  ),
                  desc: tr(
                    "Vos clients s'abonnent à votre boutique (Suivre) et reçoivent une alerte dès qu'un nouvel arrivage tombe.",
                    "Shoppers follow your store and get notified on WhatsApp whenever you post a new arrival."
                  ),
                },
                {
                  icon: "smartphone" as SaasIconName,
                  tag: tr("Réseaux sociaux", "Social Kit"),
                  title: tr(
                    "Kit Statut WhatsApp, IG & TikTok",
                    "WhatsApp Status, IG & TikTok Kit"
                  ),
                  desc: tr(
                    "Téléchargez des visuels produits prêts à poster sur votre Statut WhatsApp avec légende pré-rédigée.",
                    "Download ready-to-post product cards formatted for WhatsApp Status, Instagram, and TikTok."
                  ),
                },
                {
                  icon: "network" as SaasIconName,
                  tag: tr("Croissance", "Growth"),
                  title: tr(
                    "Affiliés & Coopératives",
                    "Affiliates & Cooperatives"
                  ),
                  desc: tr(
                    "Créez des codes affiliés pour vos apporteurs d'affaires ou rejoignez une coopérative de commerçants locale.",
                    "Generate affiliate codes for promoters or join a local merchant cooperative to sell together."
                  ),
                },
                {
                  icon: "chart" as SaasIconName,
                  tag: tr("Finance", "Bookkeeping"),
                  title: tr(
                    "Comptabilité P&L Mensuelle",
                    "Monthly P&L Bookkeeping"
                  ),
                  desc: tr(
                    "Revenus confirmés, dépenses manuelles et marge nette calculés automatiquement et exportables en CSV/JSON.",
                    "Confirmed revenue, manual expenses, and net profit automatically calculated and exportable to CSV/JSON."
                  ),
                },
                {
                  icon: "zap" as SaasIconName,
                  tag: tr("Performance 2G/3G", "2G/3G Ready"),
                  title: tr(
                    "PWA Légère & Compression Photo",
                    "Lightweight PWA & Image Compression"
                  ),
                  desc: tr(
                    "Application installable sur Android/iOS avec compression d'images automatique pour économiser vos forfaits data.",
                    "Installable on Android/iOS with client-side image compression so you never waste mobile data."
                  ),
                },
              ] as const
            ).map((item) => (
              <div
                key={item.title}
                className="glass glass-edge flex flex-col justify-between rounded-shape-lg p-5 transition-all duration-short hover:-translate-y-1 hover:shadow-elev-2"
              >
                <div>
                  <div className="mb-3.5 flex items-center justify-between">
                    <span className="grid h-9 w-9 place-items-center rounded-shape-md border border-brand/30 bg-brand/10 text-brand-dark">
                      <SaasIcon name={item.icon} size={18} />
                    </span>
                    <span className="rounded-full bg-arctic-200/75 px-2 py-0.5 text-[10px] font-bold text-arctic-700">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="mb-1.5 font-display text-sm font-bold text-arctic-900">
                    {item.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-arctic-600">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 7. HOW IT WORKS — 4-Step Visual Preview + Link to /how-to-use
         * ============================================================ */}
        <section className="mb-20 rounded-shape-xl border border-arctic-300/60 bg-white/75 p-6 backdrop-blur-md sm:p-10">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-arctic-200/70 pb-6 sm:flex-row sm:items-end">
            <div>
              <div className="a-eyebrow">
                {tr("Parcours simplifié", "Simple Workflow")}
              </div>
              <h2 className="a-headline-lg mt-1 text-arctic-900">
                {tr(
                  "Comment fonctionne Japora au quotidien ?",
                  "How does Japora work day to day?"
                )}
              </h2>
            </div>
            <Link
              href="/how-to-use"
              className="btn-ghost inline-flex items-center gap-1.5 text-xs font-bold"
            >
              <span>
                {tr(
                  "Voir le guide interactif complet",
                  "See the full interactive guide"
                )}
              </span>
              <SaasIcon name="arrow-right" size={14} />
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: tr("Créez votre boutique", "Create your shop"),
                desc: tr(
                  "Inscrivez votre boutique en quelques clics avec votre numéro WhatsApp commercial et votre devise locale (FCFA).",
                  "Register your shop in a few clicks with your business WhatsApp number and local currency (XOF)."
                ),
              },
              {
                step: "02",
                title: tr("Ajoutez vos articles", "Add your products"),
                desc: tr(
                  "Prenez vos produits en photo, indiquez le prix et les tailles, ou importez votre catalogue WhatsApp Business.",
                  "Upload product photos, set prices and sizes, or import your existing WhatsApp Business catalog in one tap."
                ),
              },
              {
                step: "03",
                title: tr("Partagez votre lien ou QR", "Share your link or QR"),
                desc: tr(
                  "Mettez votre lien en Statut WhatsApp, sur TikTok/Instagram ou affichez le QR code sur votre étal au marché.",
                  "Drop your link in your WhatsApp Status, Instagram/TikTok bio, or print your QR code for your market stall."
                ),
              },
              {
                step: "04",
                title: tr("Encaissez & suivez vos ventes", "Get paid & track sales"),
                desc: tr(
                  "Le bot répond aux questions, le client paie par Mobile Money et vous suivez chaque commande sur votre tableau Kanban.",
                  "The bot answers questions, buyers pay via Mobile Money, and you track every order on your Kanban board."
                ),
              },
            ].map((s) => (
              <div key={s.step} className="relative flex flex-col">
                <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-full border border-brand/50 bg-brand/10 font-display text-sm font-bold text-brand-dark">
                  {s.step}
                </div>
                <h3 className="font-display text-base font-bold text-arctic-900">
                  {s.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-arctic-600">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 8. MERCHANT TESTIMONIALS
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-8 max-w-xl text-center">
            <span className="a-eyebrow">
              {tr("Témoignages Commerçants", "Merchant Stories")}
            </span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              {tr(
                "Ils développent leur activité chaque jour avec Japora",
                "Growing their business every day with Japora"
              )}
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                quote: tr(
                  "Mes clientes choisissent directement leur taille dans le catalogue et paient par T-Money. Je gagne plus de 2 heures chaque jour et je n'ai plus d'erreurs de commande.",
                  "My customers pick their size directly in the catalog and pay via T-Money. I save over 2 hours a day with zero order mistakes."
                ),
                author: "Afiwa M.",
                role: tr("Mode, Bazin & Prêt-à-porter", "Fashion & Ready-to-Wear"),
                city: "Lomé (Adawlato)",
                metric: tr("+42% de ventes suivies", "+42% tracked sales"),
              },
              {
                quote: tr(
                  "Le bot WhatsApp répond aux demandes de prix la nuit quand je dors. Le matin, je consulte mon tableau de bord et je n'ai plus qu'à préparer les livraisons.",
                  "The WhatsApp bot answers price checks at night while I sleep. In the morning I check my dashboard and just pack the deliveries."
                ),
                author: "Moussa D.",
                role: tr(
                  "Smartphones & Accessoires High-Tech",
                  "Smartphones & Tech Accessories"
                ),
                city: "Cotonou (Dantokpa)",
                metric: tr("Réponse auto < 2 sec", "Auto-reply < 2 sec"),
              },
              {
                quote: tr(
                  "Les liens de paiement pour les acomptes ont éliminé les faux rendez-vous. Mes clientes paient 30% d'avance sur Flooz ou Wave avant l'expédition.",
                  "Payment links for deposits eliminated no-shows. Buyers pay a 30% deposit via Flooz or Wave before we ship."
                ),
                author: "Fanta K.",
                role: tr("Cosmétiques naturels & Mèches", "Natural Cosmetics & Beauty"),
                city: "Abidjan (Treichville)",
                metric: tr("0 impayé à la livraison", "0 unpaid deliveries"),
              },
            ].map((t) => (
              <div
                key={t.author}
                className="glass glass-edge flex flex-col justify-between rounded-shape-xl p-6"
              >
                <div>
                  <div className="mb-3 inline-block rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                    {t.metric}
                  </div>
                  <p className="text-xs italic leading-relaxed text-arctic-800 sm:text-sm">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="mt-5 border-t border-arctic-200/60 pt-3">
                  <div className="text-xs font-bold text-arctic-900">{t.author}</div>
                  <div className="mt-0.5 flex items-center gap-1 text-[11px] text-arctic-600">
                    <span>{t.role}</span>
                    <span>·</span>
                    <SaasIcon name="map-pin" size={11} className="text-brand-dark" />
                    <span>{t.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 9. FREQUENTLY ASKED QUESTIONS (FAQ)
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <span className="a-eyebrow">
              {tr("Questions Fréquentes", "Frequently Asked Questions")}
            </span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              {tr(
                "Tout savoir avant de lancer votre boutique",
                "Everything you need to know before launching"
              )}
            </h2>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {[
              {
                q: tr(
                  "Ai-je besoin d'installer une nouvelle application ?",
                  "Do I need to install a new app?"
                ),
                a: tr(
                  "Non. Japora fonctionne directement avec le WhatsApp que vous et vos clients utilisez déjà. Votre tableau de bord est accessible sur votre téléphone ou ordinateur (et installable en PWA).",
                  "No. Japora works directly with the WhatsApp you and your customers already use. Your dashboard works on any phone or computer browser (and is installable as a PWA)."
                ),
              },
              {
                q: tr(
                  "Comment suivre mes ventes et ma comptabilité ?",
                  "How do I track my sales and bookkeeping?"
                ),
                a: tr(
                  "Chaque commande apparaît sur votre tableau Kanban (Nouvelle, Confirmée, Payée, Livrée). De plus, vous recevez un bilan automatique chaque soir à 18h sur WhatsApp et un rapport P&L mensuel.",
                  "Every order appears on your Kanban board (New, Confirmed, Paid, Delivered). Plus, you get an automated 6 PM WhatsApp summary every evening and a monthly P&L report."
                ),
              },
              {
                q: tr(
                  "Comment mes clients paient-ils leurs commandes ?",
                  "How do my customers pay for their orders?"
                ),
                a: tr(
                  "Ils peuvent payer via T-Money, Flooz, Wave, Orange Money, MTN MoMo, par carte bancaire, ou directement à la livraison selon les options que vous activez.",
                  "They can pay via T-Money, Flooz, Wave, Orange Money, MTN MoMo, card, or Cash on Delivery depending on the options you enable."
                ),
              },
              {
                q: tr(
                  "Puis-je importer mes produits existants de WhatsApp Business ?",
                  "Can I import my existing WhatsApp Business products?"
                ),
                a: tr(
                  "Oui ! Depuis votre page Produits, un bouton d'import en 1 clic récupère votre catalogue WhatsApp Business existant pour vous éviter de tout ressaisir.",
                  "Yes! From your Products page, a one-tap import button pulls your existing WhatsApp Business catalog so you don't have to retype anything."
                ),
              },
              {
                q: tr(
                  "Comment obtenir le badge « Boutique Vérifiée » ?",
                  "How do I get the 'Verified Shop' badge?"
                ),
                a: tr(
                  "Complétez le profil de votre boutique avec votre numéro WhatsApp commercial et vos premières commandes payées avec succès. Le badge s'active automatiquement.",
                  "Complete your shop profile with your business WhatsApp number and your first paid orders. The badge unlocks automatically to boost buyer trust."
                ),
              },
              {
                q: tr(
                  "Puis-je utiliser Japora pour mon stand physique au marché ?",
                  "Can I use Japora for my physical market stall?"
                ),
                a: tr(
                  "Absolument. Japora génère une affiche QR code prête à imprimer pour votre stand. Les passants scannent le code et accèdent immédiatement à tout votre catalogue.",
                  "Absolutely. Japora generates a printable QR code poster for your stall. Shoppers scan it to browse your full catalog on their phone."
                ),
              },
            ].map((faq) => (
              <div
                key={faq.q}
                className="rounded-shape-lg border border-arctic-300/60 bg-white/75 p-5 shadow-xs"
              >
                <h3 className="font-display text-sm font-bold text-arctic-900">
                  {faq.q}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-arctic-600">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 10. CLOSING CALL-TO-ACTION BANNER
         * ============================================================ */}
        <section className="mb-20">
          <div className="relative overflow-hidden rounded-shape-xl bg-gradient-to-br from-arctic-900 via-arctic-800 to-slate-900 p-8 text-center text-white shadow-elev-3 sm:p-14">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full opacity-25 blur-3xl"
              style={{ background: "rgb(var(--gold))" }}
            />
            <div className="relative z-10 mx-auto max-w-2xl space-y-4">
              <span className="inline-block rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-amber-200">
                {tr(
                  "Inscription rapide · Sans abonnement",
                  "Quick setup · Free to start"
                )}
              </span>
              <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
                {tr(
                  "Prêt à vendre en ligne, sur WhatsApp et suivre toutes vos ventes ?",
                  "Ready to sell online, on WhatsApp, and track all your sales?"
                )}
              </h2>
              <p className="mx-auto max-w-xl text-xs leading-relaxed text-arctic-200 sm:text-sm">
                {tr(
                  "Rejoignez les marchands qui automatisent leurs prises de commandes, encaissent par Mobile Money et développent leur visibilité sur le Marketplace Japora.",
                  "Join merchants who automate order taking, accept Mobile Money payments, and grow their visibility on the Japora Marketplace."
                )}
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-3">
                <Link
                  href="/signup"
                  className="a-btn a-btn--cafe a-btn--lg font-bold shadow-lg"
                >
                  <span>
                    {tr(
                      "Ouvrir ma boutique gratuitement",
                      "Open my shop for free"
                    )}
                  </span>
                  <SaasIcon name="arrow-right" size={16} />
                </Link>
                <Link
                  href="/marketplace"
                  className="a-btn a-btn--lg border border-white/25 bg-white/10 text-white hover:bg-white/20"
                >
                  {tr("Explorer le Marketplace", "Explore the Marketplace")}
                </Link>
                <Link
                  href="/how-to-use"
                  className="a-btn a-btn--lg border border-white/15 bg-transparent text-arctic-200 hover:text-white"
                >
                  {tr("Voir comment ça marche", "See how it works")}
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

/** Minimalist SVG glyphs — line-art, ink + gold accent (theme-aware). */
function FeatureGlyph({ k }: { k: string }) {
  const stroke = "rgb(var(--c-800))";
  const accent = "rgb(var(--gold))";
  if (k === "bot") {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
        <rect x="6" y="9" width="24" height="18" rx="6" stroke={stroke} strokeWidth="1.6" />
        <circle cx="14" cy="18" r="1.4" fill={stroke} />
        <circle cx="22" cy="18" r="1.4" fill={stroke} />
        <path d="M14 23h8" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M18 5v4M11 7l2 2M25 7l-2 2" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (k === "pay") {
    return (
      <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
        <rect x="4" y="9" width="28" height="18" rx="3" stroke={stroke} strokeWidth="1.6" />
        <path d="M4 14h28" stroke={stroke} strokeWidth="1.6" />
        <circle cx="26" cy="21" r="2.2" fill={accent} />
        <path d="M9 21h6" stroke={accent} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden>
      <path
        d="M6 26 L13 18 L19 22 L30 10"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="30" cy="10" r="2.4" fill={accent} />
      <path d="M5 30h26" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
