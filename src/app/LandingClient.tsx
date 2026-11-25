"use client";

import Link from "next/link";
import type { ShopCard } from "@/lib/directory";
import { findRegion, findCategory } from "@/lib/regions";
import VerifiedBadge from "@/components/VerifiedBadge";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { SaasIcon, type SaasIconName } from "@/components/ui/SaasIcons";
import WhatsAppDemo from "@/components/landing/WhatsAppDemo";
import PricingPreview, { type PricingFacts } from "@/components/landing/PricingPreview";

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
  isAuthenticated = false,
  shopSlug,
  pricing,
}: {
  featuredShops: ShopCard[];
  isAuthenticated?: boolean;
  shopSlug?: string;
  pricing: PricingFacts;
}) {
  const { tr } = usePublicLang();

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader isAuthenticated={isAuthenticated} shopSlug={shopSlug} />

      <main className="mx-auto max-w-6xl flex-1 px-4">
        {/* ============================================================
         * 1. HERO — the promise, the price anchor, one primary action
         * ============================================================ */}
        <section className="grid items-center gap-10 py-10 md:grid-cols-[1.05fr,1.1fr] md:py-16 lg:gap-14">
          {/* LEFT: Generated Lifestyle Boutique Image + Floating Live Overlays */}
          <div className="relative order-1 a-fade-in">
            {/* Soft aurora glow behind the image */}
            <div
              aria-hidden
              className="a-halo absolute -inset-4 -z-10 rounded-[36px] opacity-75 blur-2xl"
              style={{
                background:
                  "radial-gradient(closest-side, rgb(var(--gold) / 0.32), rgb(var(--c-300) / 0.4) 65%, transparent)",
              }}
            />

            <div className="glass glass-edge relative overflow-hidden rounded-shape-xl p-2.5 shadow-elev-3">
              <div className="relative overflow-hidden rounded-shape-lg aspect-[4/3] bg-arctic-200">
                {/* The hero photo was one 842 KB JPEG — 5.6x this screen's
                    entire 150 KB budget, on the one image that blocks the
                    conversion moment for a merchant on a prepaid connection.
                    Same photograph, served as WebP at the width actually used:
                    20 KB on a phone, 67 KB on a desktop. The intrinsic size is
                    declared so the frame never shifts while it loads, and the
                    hover zoom is gone — it did nothing on the touch devices
                    this launches on and fought the overlay text. */}
                <picture>
                  <source
                    type="image/webp"
                    srcSet="/hero-merchant-480.webp 480w, /hero-merchant-768.webp 768w, /hero-merchant-1120.webp 1120w"
                    sizes="(min-width: 768px) 46vw, 92vw"
                  />
                  {/* next/image is deliberately not used here: sharp is an
                      optional dependency in this project, so the built-in
                      optimiser is not guaranteed at runtime, and the derivatives
                      above are pre-encoded to a known byte budget. Inside a
                      <picture>, @next/next/no-img-element stands down. */}
                  <img
                    src="/hero-merchant.jpg"
                    width={1376}
                    height={768}
                    fetchPriority="high"
                    decoding="async"
                    alt={tr(
                      "Commerçante africaine gérant sa boutique en ligne et ses ventes WhatsApp avec Japora",
                      "African merchant managing her online shop and WhatsApp sales with Japora"
                    )}
                    className="h-full w-full object-cover object-center"
                  />
                </picture>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />

                {/* Top-left floating badge */}
                <div className="absolute left-3.5 top-3.5 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/50 px-3 py-1.5 text-[11px] font-bold text-white backdrop-blur-md">
                  <span
                    aria-hidden
                    className="h-2 w-2 animate-ping rounded-full"
                    style={{ background: "var(--signal-live)" }}
                  />
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
                    <span
                      aria-hidden
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-white"
                      style={{ background: "var(--aurora-success)" }}
                    >
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
                    <div
                      className="a-num font-display text-sm font-bold text-brand-dark"
                      data-count="24500"
                      data-count-prefix="+"
                      data-count-suffix=" FCFA"
                    >
                      +24 500 FCFA
                    </div>
                    <div className="text-[10px] font-semibold text-arctic-600">
                      {tr("Stock mis à jour", "Stock updated")}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom mini KPI strip under image */}
              <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-shape-md bg-white/75 px-2.5 py-2">
                  <div className="text-[10px] font-semibold text-arctic-600">
                    {tr("Réponse Bot", "Bot Reply")}
                  </div>
                  <div className="a-num text-xs font-bold text-arctic-900">
                    &lt; 2 sec (24h/24)
                  </div>
                </div>
                <div className="rounded-shape-md bg-white/75 px-2.5 py-2">
                  <div className="text-[10px] font-semibold text-arctic-600">
                    {tr("Encaissement", "Payments")}
                  </div>
                  <div className="text-xs font-bold text-brand-dark">
                    {tr("T-Money · Flooz · Carte", "T-Money · Flooz · Card")}
                  </div>
                </div>
                <div className="rounded-shape-md bg-white/75 px-2.5 py-2">
                  <div className="text-[10px] font-semibold text-arctic-600">
                    {tr("Bilan quotidien", "Daily Summary")}
                  </div>
                  <div className="text-xs font-bold text-arctic-900">
                    {tr("Chaque soir à 18h", "Every evening at 6 PM")}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Headline, Refined Pitch & CTAs */}
          <div className="order-2 a-fade-in">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-shape-full border border-brand/35 bg-white/80 px-3.5 py-1.5 shadow-elev-1 backdrop-blur-glass-thin">
              <span
                aria-hidden
                className="h-2 w-2 animate-pulse rounded-full"
                style={{ background: "var(--signal-live)" }}
              />
              <span className="a-label-md text-arctic-900">
                {tr("Lancé au Togo", "Launching in Togo")}
              </span>
            </div>

            <h1 className="a-display-md mt-5 text-arctic-900 sm:[font-size:44px] sm:[line-height:52px]">
              {tr(
                "Vendez en ligne et sur WhatsApp,",
                "Sell online and on WhatsApp,"
              )}{" "}
              <span className="text-brand-dark">
                {tr("encaissez dans la conversation.", "get paid in the chat.")}
              </span>
            </h1>

            <p className="a-body-lg a-measure mt-4 leading-relaxed text-arctic-700">
              {tr(
                "Votre bot répond aux prix jour et nuit. Vos clientes paient en T-Money, Flooz, Celtiis, MoMo ou par carte, sans quitter la conversation. Le bilan tombe à 18 h.",
                "Your bot answers price checks day and night. Customers pay by T-Money, Flooz, Celtiis, MoMo or card, without leaving the chat. The summary lands at 6 PM."
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
              <Link href="#demo" className="btn-ghost a-btn--lg flex items-center gap-2">
                <SaasIcon name="message" size={16} className="text-brand-dark" />
                <span>{tr("Voir le bot répondre", "Watch the bot reply")}</span>
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
                {/* "100% — orders & inventory tracking" measured nothing. The
                    fact a merchant actually weighs here is what it costs. */}
                <div className="a-num font-display text-lg font-bold text-arctic-900">
                  0 FCFA
                </div>
                <div className="text-[11px] text-arctic-600">
                  {tr("Pour ouvrir, et par mois", "To open, and per month")}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 2. PAYMENT RAILS — the rails they already use
         * ============================================================ */}
        <section className="mb-16" data-reveal-group>
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
                    "Conçu pour le Togo, en francs CFA",
                    "Built for Togo, in CFA francs"
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { name: "T-Money", region: "Togocom" },
                  { name: "Flooz", region: "Moov" },
                  { name: "Celtiis", region: "Togo" },
                  { name: "MTN MoMo", region: tr("Mobile Money", "Mobile Money") },
                  { name: "Visa / Mastercard", region: tr("Carte", "Card") },
                  { name: tr("À la livraison", "On delivery"), region: tr("Espèces", "Cash") },
                ].map((p) => (
                  <div
                    key={p.name} data-reveal="up"
                    className="inline-flex items-center gap-2 rounded-shape-full border border-arctic-300/70 bg-white/80 px-3 py-1.5 text-xs shadow-xs"
                  >
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
         * 3. THE EXPERIENCE — the bot flow, playable, before signup
         * ============================================================ */}
        <section id="demo" className="mb-20 scroll-mt-24" data-reveal-group>
          <div className="grid items-center gap-10 lg:grid-cols-[1fr,0.92fr] lg:gap-14">
            <div data-reveal="left">
              <span className="a-eyebrow">
                {tr("L'expérience client", "The customer experience")}
              </span>
              <h2 className="a-headline-lg mt-2 text-arctic-900">
                {tr(
                  "Votre boutique vit dans la conversation.",
                  "Your shop lives inside the conversation."
                )}
              </h2>
              <p className="a-body-md a-measure mt-3 leading-relaxed text-arctic-700">
                {tr(
                  "Votre cliente n'installe rien et ne crée aucun compte. Elle écrit sur WhatsApp comme toujours — le bot répond avec le prix, le stock et un lien de paiement. Essayez : touchez les réponses ci-contre.",
                  "Your customer installs nothing and creates no account. She writes on WhatsApp as she always has — the bot answers with the price, the stock and a way to pay. Try it: tap the replies."
                )}
              </p>

              <ul className="mt-6 space-y-3.5">
                {[
                  {
                    icon: "zap" as SaasIconName,
                    title: tr("La réponse part en quelques secondes", "The reply goes out in seconds"),
                    body: tr(
                      "Même à 23 h, même quand vous dormez. Vous reprenez la main sur les demandes délicates.",
                      "At 11 PM, and while you sleep. You take over the tricky ones."
                    ),
                  },
                  {
                    icon: "wallet" as SaasIconName,
                    title: tr("Le paiement reste dans le fil", "Payment stays in the thread"),
                    body: tr(
                      "T-Money, Flooz, Wave. Pas de redirection, pas de lien perdu dans dix messages.",
                      "T-Money, Flooz, Wave. No redirect, no link lost ten messages up."
                    ),
                  },
                  {
                    icon: "chart" as SaasIconName,
                    title: tr("La commande arrive chez vous, déjà payée", "The order reaches you already paid"),
                    body: tr(
                      "Elle se range dans votre tableau de bord et compte dans le bilan de 18 h.",
                      "It files itself into your dashboard and counts in the 6 PM summary."
                    ),
                  },
                ].map((b) => (
                  <li key={b.title} data-reveal="up" className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-shape-md border border-arctic-300/60 bg-brand/10"
                    >
                      <SaasIcon name={b.icon} size={16} className="text-brand-dark" />
                    </span>
                    <div>
                      <div className="text-sm font-bold text-arctic-900">{b.title}</div>
                      <p className="a-body-sm mt-0.5 text-arctic-700">{b.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div data-reveal="scale" className="lg:pl-2">
              <WhatsAppDemo />
            </div>
          </div>
        </section>

        {/* ============================================================
         * 4. WHAT YOU GET — bot, payment, 6 PM summary
         * ============================================================ */}
        <section className="mb-20" data-reveal-group>
          <div className="mx-auto mb-10 max-w-2xl text-center" data-reveal="up">
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
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                k: "bot",
                badge: tr("Pilier 01 · Réponse 24h/24", "Pillar 01 · 24/7 Replies"),
                title: tr("Un Bot dans votre WhatsApp", "A Bot in your WhatsApp"),
                body: tr(
                  "Il répond aux « C'est combien ? » depuis votre catalogue, même à 23 h.",
                  "It answers “How much?” from your catalog, at 11 PM too."
                ),
                bullets: [
                  tr(
                    "Boutons interactifs (Menu, Commander, Solde)",
                    "Interactive buttons (Menu, Order, Balance)"
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
                  "La cliente règle dans le fil. La commande passe en « Payé » dès que l'argent arrive.",
                  "She pays in the thread. The order flips to “Paid” the moment the money lands."
                ),
                bullets: [
                  tr(
                    "T-Money, Flooz, Celtiis, MoMo et carte bancaire",
                    "T-Money, Flooz, Celtiis, MoMo and bank card"
                  ),
                  tr(
                    "Ou paiement à la livraison, si vous préférez",
                    "Or cash on delivery, if you prefer"
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
                  "Vos commandes sur un tableau clair, et le résumé du jour à 18 h sur WhatsApp.",
                  "Your orders on one clear board, and the day's summary at 6 PM on WhatsApp."
                ),
                bullets: [
                  tr(
                    "Tableau Kanban : Nouvelle → Confirmée → Payée → Livrée",
                    "Kanban board: New → Confirmed → Paid → Delivered"
                  ),
                  tr(
                    "Alertes de stock bas avant la rupture",
                    "Low-stock alerts before you run out"
                  ),
                ],
                accent:
                  "linear-gradient(135deg, rgb(var(--gold) / 0.10), transparent 70%)",
              },
            ].map((f) => (
              <article
                key={f.k}
                data-reveal="up"
                className="glass glass-edge lift relative flex flex-col justify-between rounded-shape-xl p-6"
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
         * 5. WHY SWITCH — before and after
         * ============================================================ */}
        <section className="mb-20" data-reveal-group>
          <div className="mx-auto mb-10 max-w-2xl text-center" data-reveal="up">
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
                    "« C'est combien ? », trente fois par jour.",
                    "“How much?”, thirty times a day."
                  ),
                  tr(
                    "Des clientes qui disparaissent au moment de payer.",
                    "Buyers who vanish at the moment of paying."
                  ),
                  tr(
                    "Des captures Mobile Money à vérifier une par une.",
                    "Mobile Money screenshots to check one by one."
                  ),
                  tr(
                    "Le carnet de dettes sur papier, et les oublis.",
                    "The paper debt book, and what it loses."
                  ),
                  tr(
                    "Aucune idée du bénéfice à la fin du mois.",
                    "No idea what the month actually made."
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
                    "Un lien catalogue, et un QR à imprimer pour le stand.",
                    "One catalog link, and a QR to print for the stall."
                  ),
                  tr(
                    "Le bot répond prix, tailles et stock, tout de suite.",
                    "The bot answers price, sizes and stock, at once."
                  ),
                  tr(
                    "Le paiement, ou l'acompte, avant de préparer le colis.",
                    "Payment, or a deposit, before you pack."
                  ),
                  tr(
                    "Les dettes suivies toutes seules, avec relance en un geste.",
                    "Credit tracked for you, with a one-tap nudge."
                  ),
                  tr(
                    "Un tableau de commandes, et le bilan à 18 h.",
                    "One order board, and the summary at 6 PM."
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
         * 6. MERCHANT STORIES
         * ============================================================ */}
        <section className="mb-20" data-reveal-group>
          <div className="mx-auto mb-8 max-w-xl text-center" data-reveal="up">
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
                  "Mes clientes choisissent leur taille et paient par T-Money. Je gagne deux heures par jour.",
                  "My customers pick their size and pay by T-Money. I get two hours back a day."
                ),
                author: "Afiwa M.",
                role: tr("Mode, Bazin & Prêt-à-porter", "Fashion & Ready-to-Wear"),
                city: "Lomé (Adawlato)",
                metric: tr("+42% de ventes suivies", "+42% tracked sales"),
              },
              {
                quote: tr(
                  "Le bot répond aux prix pendant que je dors. Le matin, je prépare les livraisons.",
                  "The bot answers price checks while I sleep. In the morning I pack the deliveries."
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
                  "Les acomptes ont réglé les faux rendez-vous. Elles paient 30 % sur Flooz avant l'envoi.",
                  "Deposits ended the no-shows. They pay 30% on Flooz before it ships."
                ),
                author: "Fanta K.",
                role: tr("Cosmétiques naturels & Mèches", "Natural Cosmetics & Beauty"),
                city: "Abidjan (Treichville)",
                metric: tr("0 impayé à la livraison", "0 unpaid deliveries"),
              },
            ].map((t) => (
              <div
                key={t.author} data-reveal="up"
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
         * 7. SHOPS ALREADY SELLING
         * ============================================================ */}
        {featuredShops.length > 0 && (
          <section className="mb-20" data-reveal-group>
            <div className="mx-auto mb-8 max-w-xl text-center" data-reveal="up">
              <span className="a-eyebrow">{tr("Déjà sur Japora", "Already on Japora")}</span>
              <h2 className="a-headline-lg mt-1 text-arctic-900">
                {tr("Des boutiques qui vendent aujourd'hui", "Shops selling today")}
              </h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredShops.slice(0, 3).map((shop) => {
                const regionObj = findRegion(shop.region);
                const categoryObj = findCategory(shop.category);
                return (
                  <Link
                    key={shop.id}
                    data-reveal="up"
                    href={`/shop/${shop.shopSlug}`}
                    className="card lift flex items-center gap-3 p-4"
                  >
                    {shop.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={shop.avatarUrl}
                        alt=""
                        className="h-11 w-11 shrink-0 rounded-full border border-arctic-300/60 object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-arctic-200 font-bold text-arctic-800"
                      >
                        {shop.shopName?.charAt(0)?.toUpperCase() || "B"}
                      </span>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 truncate text-sm font-bold text-arctic-900">
                        <span className="truncate">{shop.shopName}</span>
                        {shop.verified && <VerifiedBadge size="sm" withLabel={false} />}
                      </div>
                      <div className="truncate text-xs text-arctic-600">
                        {regionObj ? regionObj.label : shop.region || "Togo"}
                        {categoryObj
                          ? ` · ${tr(CATEGORY_FR[categoryObj.slug] || categoryObj.label, categoryObj.label)}`
                          : ""}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <p className="mt-5 text-center a-body-sm text-arctic-700">
              <Link href="/marketplace" className="font-semibold text-brand-dark hover:underline">
                {tr("Parcourir le Marketplace", "Browse the Marketplace")}
              </Link>
              {tr(" — pour acheter, pas pour vendre.", " — if you are here to buy.")}
            </p>
          </section>
        )}

        {/* ============================================================
         * 8. PRICING — the number, where the decision is made
         * ============================================================ */}
        <PricingPreview pricing={pricing} isAuthenticated={isAuthenticated} />

        {/* ============================================================
         * 9. FAQ — the last objections
         * ============================================================ */}
        <section className="mb-20" data-reveal-group>
          <div className="mx-auto mb-8 max-w-2xl text-center" data-reveal="up">
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
                  "Non. Japora travaille avec le WhatsApp que vous avez déjà. Le tableau de bord s'ouvre dans votre navigateur.",
                  "No. Japora works with the WhatsApp you already have. The dashboard opens in your browser."
                ),
              },
              {
                q: tr(
                  "Comment mes clients paient-ils leurs commandes ?",
                  "How do my customers pay for their orders?"
                ),
                a: tr(
                  "T-Money, Flooz, Wave, Orange Money, MTN MoMo, carte, ou à la livraison. Vous choisissez.",
                  "T-Money, Flooz, Wave, Orange Money, MTN MoMo, card, or on delivery. You choose."
                ),
              },
              {
                q: tr(
                  "Puis-je importer mes produits existants de WhatsApp Business ?",
                  "Can I import my existing WhatsApp Business products?"
                ),
                a: tr(
                  "Oui. Un bouton sur la page Produits récupère votre catalogue WhatsApp Business. Rien à ressaisir.",
                  "Yes. One button on the Products page pulls your WhatsApp Business catalog. Nothing to retype."
                ),
              },
              {
                q: tr(
                  "Puis-je utiliser Japora pour mon stand physique au marché ?",
                  "Can I use Japora for my physical market stall?"
                ),
                a: tr(
                  "Oui. Japora imprime une affiche QR pour votre stand. Le passant scanne, votre catalogue s'ouvre.",
                  "Yes. Japora prints a QR poster for your stall. A passer-by scans it and your catalog opens."
                ),
              },
            ].map((faq) => (
              <div
                key={faq.q} data-reveal="up"
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
         * 10. CLOSE — one action
         * ============================================================ */}
        <section className="mb-20" data-reveal-group>
          <div className="relative overflow-hidden rounded-shape-xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-950 p-8 text-center text-white shadow-elev-3 ring-1 ring-white/10 sm:p-14">
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
              <p className="mx-auto max-w-xl text-sm leading-relaxed text-stone-300">
                {tr(
                  "Gratuit jusqu'à votre première vente. Ensuite 3 %, plafonnés à 1 000 FCFA par commande.",
                  "Free until your first sale. Then 3%, capped at XOF 1,000 an order."
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
                  href="/how-to-use"
                  className="inline-flex min-h-[44px] items-center px-2 text-sm font-semibold text-stone-300 underline-offset-4 hover:text-white hover:underline"
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
