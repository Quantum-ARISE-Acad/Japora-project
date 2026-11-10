import Link from "next/link";
import { getCurrentVendor } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuroraHeroPreview from "@/components/aurora/AuroraHeroPreview";
import { listShops } from "@/lib/directory";
import { REGIONS, CATEGORIES, findRegion, findCategory } from "@/lib/regions";
import VerifiedBadge from "@/components/VerifiedBadge";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

/**
 * Aurora landing — the flagship surface for the M3-Expressive redesign.
 * Comprehensive B2B (merchants) + B2C (marketplace shoppers) experience.
 */

export default async function LandingPage() {
  const vendor = await getCurrentVendor();
  if (vendor) redirect("/dashboard");

  let featuredShops: Awaited<ReturnType<typeof listShops>> = [];
  try {
    featuredShops = await listShops({ take: 6 });
  } catch (e) {
    console.warn("Could not list shops on homepage", e);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-6xl flex-1 px-4">
        {/* ============================================================
         * 1. HERO SECTION — Flagship Value Proposition
         * ============================================================ */}
        <section className="grid items-center gap-12 py-12 md:grid-cols-[1.08fr,1fr] md:py-20">
          <div className="a-fade-in">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-shape-full border border-brand/35 bg-white/75 px-3.5 py-1.5 shadow-elev-1 backdrop-blur-glass-thin">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-600" />
              <span className="a-label-md text-arctic-900">
                Commerce WhatsApp &amp; Marketplace en Afrique
              </span>
              <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                0 FCFA / mois
              </span>
            </div>

            <h1 className="a-display-md mt-5 text-arctic-900 sm:[font-size:48px] sm:[line-height:56px]">
              Vendez sur WhatsApp.
              <br />
              <span className="text-brand-dark">Encaissez sans friction.</span>
            </h1>

            <p className="a-body-lg a-measure mt-4 text-arctic-700 leading-relaxed">
              Japora transforme votre numéro WhatsApp en une boutique professionnelle complète : un bot répond aux prix 24h/24, vos clients paient par{" "}
              <strong className="font-semibold text-arctic-900">
                T-Money, Flooz, Wave ou Orange Money
              </strong>
              , et vous recevez votre bilan comptable chaque soir à 18h.
            </p>

            {/* Primary CTAs */}
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                href="/start"
                className="a-btn a-btn--cafe a-btn--lg font-bold shadow-elev-2"
              >
                <span>Ouvrir ma boutique en 90 sec</span>
                <span>→</span>
              </Link>
              <Link
                href="/marketplace"
                className="btn-ghost a-btn--lg flex items-center gap-2"
              >
                <span>🛍️</span>
                <span>Explorer le Marketplace</span>
              </Link>
            </div>

            {/* Trust Micro-pills */}
            <div className="mt-7 grid grid-cols-3 gap-3 border-t border-arctic-200/70 pt-5 sm:max-w-lg">
              <div>
                <div className="a-num font-display text-lg font-bold text-arctic-900">
                  Gardez 97%
                </div>
                <div className="text-[11px] text-arctic-600">
                  0% d&apos;abonnement fixe
                </div>
              </div>
              <div>
                <div className="a-num font-display text-lg font-bold text-arctic-900">
                  ~90 sec
                </div>
                <div className="text-[11px] text-arctic-600">
                  Inscription par code WhatsApp
                </div>
              </div>
              <div>
                <div className="a-num font-display text-lg font-bold text-arctic-900">
                  24h / 24
                </div>
                <div className="text-[11px] text-arctic-600">
                  Bot &amp; catalogue actifs
                </div>
              </div>
            </div>
          </div>

          <div className="relative">
            <AuroraHeroPreview />
          </div>
        </section>

        {/* ============================================================
         * 2. PAYMENT RAILS & PAN-AFRICAN COVERAGE STRIP
         * ============================================================ */}
        <section className="mb-16">
          <div className="glass glass-edge rounded-shape-xl px-6 py-5">
            <div className="flex flex-col items-center justify-between gap-4 lg:flex-row">
              <div className="text-center lg:text-left">
                <div className="a-eyebrow">Rails de paiement &amp; Marchés</div>
                <p className="mt-0.5 text-xs font-semibold text-arctic-800">
                  Conçu d&apos;abord pour le Togo et la zone UEMOA (FCFA), prêt pour toute l&apos;Afrique
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                {[
                  { name: "T-Money", region: "🇹🇬 Togo", live: true },
                  { name: "Flooz (Moov)", region: "🇹🇬 🇧🇯 UEMOA", live: true },
                  { name: "CinetPay", region: "🌍 Afrique Ouest", live: true },
                  { name: "Wave", region: "🇸🇳 🇨🇮 Sénégal / CI", live: true },
                  { name: "Orange Money", region: "🌍 Zone Franc", live: true },
                  { name: "MTN MoMo", region: "🇧🇯 🇬🇭 🇨🇮", live: true },
                  { name: "Paystack & M-Pesa", region: "🇳🇬 🇰🇪", live: true },
                ].map((p) => (
                  <div
                    key={p.name}
                    className="inline-flex items-center gap-2 rounded-shape-full border border-arctic-300/70 bg-white/80 px-3 py-1.5 text-xs shadow-xs"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                    <span className="font-bold text-arctic-900">{p.name}</span>
                    <span className="text-[10px] text-arctic-500">{p.region}</span>
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
            <span className="a-eyebrow">Annuaire Public &amp; Découverte</span>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              Trouvez une boutique vérifiée ou un produit près de chez vous
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              Explorez les catalogues des commerçants indépendants de Lomé, Cotonou, Abidjan, Dakar et au-delà. Commandez directement sur leur WhatsApp.
            </p>

            {/* Direct Search Bar */}
            <form
              action="/marketplace"
              method="GET"
              className="mt-6 flex flex-col gap-2.5 sm:flex-row"
            >
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-arctic-500">
                  🔍
                </span>
                <input
                  type="text"
                  name="q"
                  placeholder="Rechercher une boutique, robe wax, iPhone, cosmétiques, Lomé…"
                  className="w-full rounded-shape-full border border-arctic-300/90 bg-white py-3.5 pl-11 pr-4 text-sm text-arctic-900 shadow-sm focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/25"
                />
              </div>
              <button
                type="submit"
                className="btn-primary whitespace-nowrap rounded-shape-full px-7 py-3.5 font-bold"
              >
                Rechercher dans le Marketplace
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
                  <span>{c.icon}</span>
                  <span>{c.label}</span>
                </Link>
              ))}
            </div>

            {/* Quick Region Links */}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-xs text-arctic-600">
              <span className="font-semibold text-arctic-700">Villes phares :</span>
              {REGIONS.slice(0, 7).map((r) => (
                <Link
                  key={r.slug}
                  href={`/marketplace/${r.slug}`}
                  className="rounded-md px-2 py-0.5 font-medium text-arctic-700 hover:bg-arctic-200/60 hover:text-arctic-900"
                >
                  📍 {r.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Featured Shops Grid */}
          <div className="mt-10 border-t border-arctic-200/70 pt-8">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-2">
              <div>
                <div className="a-eyebrow">Sélection du moment</div>
                <h3 className="a-title-lg font-display text-arctic-900">
                  Boutiques populaires à découvrir
                </h3>
              </div>
              <Link
                href="/marketplace"
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-dark hover:underline"
              >
                <span>Voir toutes les boutiques du Marketplace</span>
                <span>→</span>
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
                            <div className="truncate text-xs text-arctic-500">
                              📍 {regionObj ? `${regionObj.label}, ${regionObj.country}` : shop.region || "Togo"} ·{" "}
                              {categoryObj ? `${categoryObj.icon} ${categoryObj.label}` : shop.category || "Commerce"}
                            </div>
                          </div>
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-arctic-600">
                          {shop.tagline ||
                            shop.bio ||
                            "Boutique officielle disponible sur WhatsApp. Commandez en ligne et payez par Mobile Money."}
                        </p>

                        {/* Mini Product Thumbnails if available */}
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
                              Catalogue actif
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 flex items-center justify-between border-t border-arctic-100 pt-3 text-xs font-semibold text-arctic-800 group-hover:text-brand-dark">
                        <span>Visiter la vitrine &amp; commander</span>
                        <span className="transition-transform group-hover:translate-x-1">
                          →
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-shape-lg border border-arctic-200/80 bg-white/70 p-8 text-center">
                <p className="text-sm font-semibold text-arctic-800">
                  Découvrez les premières boutiques vérifiées sur le Marketplace Japora.
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <Link href="/marketplace" className="btn-primary text-xs">
                    Ouvrir le Marketplace
                  </Link>
                  <Link href="/start" className="btn-ghost text-xs">
                    Inscrire ma boutique
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
            <div className="a-eyebrow">L&apos;automatisation au service du marchand</div>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              Trois piliers pour faire tourner votre boutique sans effort
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              Restez concentré sur vos produits et vos clients VIP. Japora automatise tout le reste directement dans WhatsApp.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                k: "bot",
                badge: "Pilier 01 · Réponse 24h/24",
                title: "Un Bot dans votre WhatsApp",
                body:
                  "Répond automatiquement aux « C'est combien ? » et « C'est disponible ? » depuis votre catalogue en temps réel. Boutons interactifs, gestion des tailles et message d'absence inclus.",
                bullets: [
                  "Boutons interactifs (Menu, Commander, Solde)",
                  "Horaires d'ouverture & message d'absence auto",
                  "Import en 1 clic depuis WhatsApp Business",
                ],
                accent:
                  "linear-gradient(135deg, rgb(var(--gold) / 0.14), transparent 70%)",
              },
              {
                k: "pay",
                badge: "Pilier 02 · Encaissement",
                title: "Payé là où sont vos clients",
                body:
                  "T-Money, Flooz, Wave, Orange Money ou paiement à la livraison. Le client règle dans la conversation et votre commande passe en « ✓ Payé » dès confirmation.",
                bullets: [
                  "PayGate Global (T-Money & Flooz natifs au Togo)",
                  "CinetPay, Wave, Orange Money & MTN MoMo",
                  "Liens de paiement rapides pour acomptes",
                ],
                accent:
                  "linear-gradient(135deg, rgb(var(--c-300) / 0.5), transparent 70%)",
              },
              {
                k: "summary",
                badge: "Pilier 03 · Pilotage",
                title: "Le bilan du soir à 18h00",
                body:
                  "Chaque soir, recevez sur WhatsApp le résumé clair de votre journée : chiffre d'affaires, commandes à livrer, meilleur produit et alertes de rupture de stock.",
                bullets: [
                  "Récapitulatif WhatsApp quotidien automatique",
                  "Comptabilité mensuelle P&L exportable",
                  "Alertes de stock bas avant la rupture",
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
                  <p className="a-body-md mt-2 text-arctic-700 leading-relaxed">
                    {f.body}
                  </p>
                  <ul className="mt-4 space-y-1.5 border-t border-arctic-200/70 pt-3 text-xs text-arctic-800">
                    {f.bullets.map((b) => (
                      <li key={b} className="flex items-start gap-2">
                        <span className="font-bold text-brand-dark">✓</span>
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
            <div className="a-eyebrow">Pourquoi changer ?</div>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              Passez du chaos des messages vocaux à un commerce structuré
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            {/* Sans Japora */}
            <div className="rounded-shape-xl border border-arctic-300/70 bg-white/60 p-6 sm:p-8">
              <div className="inline-flex items-center gap-2 rounded-full bg-red-500/10 px-3 py-1 text-xs font-bold text-red-700">
                <span>✕</span>
                <span>Vendre sur WhatsApp sans outil</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-arctic-900">
                Des heures perdues chaque jour à répéter les mêmes infos
              </h3>
              <ul className="mt-4 space-y-3 text-xs sm:text-sm text-arctic-700">
                {[
                  "Répéter « C'est combien ? » et renvoyer 30 photos par jour dans chaque discussion.",
                  "Clients qui disparaissent au moment de payer ou faux rendez-vous de livraison.",
                  "Captures d'écran T-Money/Flooz difficiles à vérifier et risques d'erreurs.",
                  "Oubli des clients qui ont acheté à crédit (« carnet de dettes » sur papier).",
                  "Aucune visibilité réelle sur le bénéfice net à la fin du mois.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-red-600 font-bold">✕</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Avec Japora */}
            <div className="glass glass-edge relative overflow-hidden rounded-shape-xl border-brand/40 p-6 sm:p-8 shadow-elev-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800">
                <span>✓</span>
                <span>Avec votre boutique Japora</span>
              </div>
              <h3 className="mt-3 font-display text-lg font-bold text-arctic-900">
                Votre boutique tourne 24h/24, même quand vous dormez
              </h3>
              <ul className="mt-4 space-y-3 text-xs sm:text-sm text-arctic-800">
                {[
                  "Un seul lien catalogue élégant + QR code imprimable pour votre stand au marché.",
                  "Le bot WhatsApp répond instantanément avec prix, tailles et stock en direct.",
                  "Paiement Mobile Money intégré ou acompte sécurisé avant la préparation du colis.",
                  "Suivi automatique des créances clients (Pay-later) avec relances en un clic.",
                  "Tableau Kanban des commandes + bilan comptable tous les soirs à 18h00.",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span className="mt-0.5 text-emerald-700 font-bold">✓</span>
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
            <span className="a-eyebrow">Boîte à outils tout-en-un</span>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              Tout ce dont un entrepreneur africain a besoin pour grandir
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              De la gestion des livraisons par quartier jusqu&apos;aux coopératives de marché, chaque outil a été pensé pour le terrain.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: "📦",
                tag: "Logistique locale",
                title: "Tarifs de livraison par quartier",
                desc: "Configurez vos zones (Lomé Centre, Agoè, Baguida, Akpakpa, Cocody…) avec calcul automatique des frais.",
              },
              {
                icon: "🔗",
                tag: "Encaissement",
                title: "Liens de paiement & Acomptes",
                desc: "Générez un lien de paiement Mobile Money en 5 secondes pour sécuriser une commande sur-mesure ou une précommande.",
              },
              {
                icon: "📒",
                tag: "CRM & Crédit",
                title: "Fichier clients & Créances",
                desc: "Historique d'achats par numéro WhatsApp, statut VIP fidélité automatique et suivi des ventes à crédit.",
              },
              {
                icon: "📣",
                tag: "Fidélisation",
                title: "Diffusions & Alertes Nouveautés",
                desc: "Vos clients s'abonnent à votre boutique (🔔 Follow) et reçoivent une alerte dès qu'un nouvel arrivage tombe.",
              },
              {
                icon: "📲",
                tag: "Réseaux sociaux",
                title: "Kit Statut WhatsApp, IG & TikTok",
                desc: "Téléchargez des visuels produits prêts à poster sur votre Statut WhatsApp avec légende pré-rédigée.",
              },
              {
                icon: "🤝",
                tag: "Croissance",
                title: "Affiliés & Coopératives",
                desc: "Créez des codes affiliés pour vos apporteurs d'affaires ou rejoignez une coopérative de commerçants locale.",
              },
              {
                icon: "📊",
                tag: "Finance",
                title: "Comptabilité P&L Mensuelle",
                desc: "Revenus confirmés, dépenses manuelles et marge nette calculés automatiquement et exportables en CSV/JSON.",
              },
              {
                icon: "⚡",
                tag: "Performance 2G/3G",
                title: "PWA Légère & Compression Photo",
                desc: "Application installable sur Android/iOS avec compression d'images automatique pour économiser vos forfaits data.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="glass glass-edge flex flex-col justify-between rounded-shape-lg p-5 transition-all duration-short hover:-translate-y-1 hover:shadow-elev-2"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-2xl">{item.icon}</span>
                    <span className="rounded-full bg-arctic-200/75 px-2 py-0.5 text-[10px] font-bold text-arctic-700">
                      {item.tag}
                    </span>
                  </div>
                  <h3 className="font-display text-sm font-bold text-arctic-900 mb-1.5">
                    {item.title}
                  </h3>
                  <p className="text-xs text-arctic-600 leading-relaxed">
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
        <section className="mb-20 rounded-shape-xl border border-arctic-300/60 bg-white/75 p-6 sm:p-10 backdrop-blur-md">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-arctic-200/70 pb-6 sm:flex-row sm:items-end">
            <div>
              <div className="a-eyebrow">Parcours simplifié</div>
              <h2 className="a-headline-lg mt-1 text-arctic-900">
                Comment fonctionne Japora au quotidien ?
              </h2>
            </div>
            <Link
              href="/how-to-use"
              className="btn-ghost text-xs font-bold"
            >
              Voir le guide interactif complet →
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                step: "01",
                title: "Ouvrez votre boutique",
                desc: "Entrez votre numéro WhatsApp sur /start. Vous recevez un code à 6 chiffres et votre espace est prêt en 90 secondes.",
              },
              {
                step: "02",
                title: "Ajoutez vos articles",
                desc: "Prenez vos produits en photo, indiquez le prix en FCFA et les tailles, ou importez votre catalogue WhatsApp Business.",
              },
              {
                step: "03",
                title: "Partagez votre lien ou QR",
                desc: "Mettez votre lien en Statut WhatsApp, sur TikTok/Instagram ou affichez le QR code sur votre étal au marché.",
              },
              {
                step: "04",
                title: "Encaissez & livrez",
                desc: "Le bot répond aux questions, le client paie par Mobile Money et vous suivez chaque livraison sur votre tableau Kanban.",
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
         * 8. WATARU ECOSYSTEM SYNERGY — Japora + Soko CRM + WEscrow
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <span className="a-eyebrow">Suite Wataru Commerce</span>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              Un écosystème complet pour sécuriser et accélérer vos échanges
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              Japora s&apos;intègre nativement avec Soko CRM et WEscrow grâce à une connexion unique (SSO) pour accompagner votre croissance.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                name: "Japora",
                badge: "Boutiques & Marketplace",
                desc: "Votre vitrine en ligne, catalogue interactif, bot WhatsApp automatisé, gestion des stocks et encaissement Mobile Money.",
                highlight: "Vous êtes ici",
                active: true,
              },
              {
                name: "Soko CRM",
                badge: "WhatsApp CRM & Matching",
                desc: "Capturez chaque opportunité commerciale sur WhatsApp, qualifiez les acheteurs et relancez automatiquement les paniers abandonnés.",
                highlight: "Synchronisation native",
                active: false,
              },
              {
                name: "WEscrow",
                badge: "Paiement Séquestre Safe Hands",
                desc: "Protégez les transactions de grande valeur entre acheteurs et marchands grâce au compte séquestre sécurisé jusqu'à la livraison.",
                highlight: "Protection acheteur & vendeur",
                active: false,
              },
            ].map((p) => (
              <div
                key={p.name}
                className={`rounded-shape-xl p-6 transition-all ${
                  p.active
                    ? "glass glass-edge border-brand/50 shadow-elev-2"
                    : "border border-arctic-300/60 bg-white/65"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-bold text-arctic-900">
                    {p.name}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                      p.active
                        ? "bg-brand text-white"
                        : "bg-arctic-200 text-arctic-800"
                    }`}
                  >
                    {p.highlight}
                  </span>
                </div>
                <div className="mt-1 text-xs font-semibold text-brand-dark">
                  {p.badge}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-arctic-600">
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 9. TRANSPARENT PRICING PREVIEW — Starter 0% vs Pay-as-you-sell 97%
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="a-eyebrow">Tarification alignée sur votre succès</span>
            <h2 className="a-headline-lg mt-2 text-arctic-900">
              Gratuit pour démarrer. Vous ne payez que lorsque vous vendez.
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              Aucun abonnement mensuel obligatoire, aucune carte bancaire demandée à l&apos;inscription.
            </p>
          </div>

          <div className="mx-auto grid max-w-4xl gap-6 sm:grid-cols-2">
            {/* Starter */}
            <div className="card flex flex-col justify-between p-6 sm:p-8">
              <div>
                <div className="flex items-center justify-between">
                  <span className="a-eyebrow">Offre Starter</span>
                  <span className="rounded-full bg-arctic-200 px-2.5 py-0.5 text-[10px] font-bold text-arctic-800">
                    Gratuit à vie
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="a-num font-display text-4xl font-extrabold text-arctic-900">
                    0 FCFA
                  </span>
                  <span className="text-xs text-arctic-600">/ mois · 0% commission</span>
                </div>
                <p className="mt-2 text-xs text-arctic-600 leading-relaxed">
                  Idéal pour lancer votre catalogue. Vos clients commandent sur WhatsApp et vous règlent directement sur votre propre numéro T-Money ou Flooz.
                </p>
                <ul className="mt-5 space-y-2 text-xs text-arctic-800">
                  {[
                    "Catalogue produits illimité + lien & QR code de stand",
                    "Bot WhatsApp 24h/24 pour répondre aux prix",
                    "Tableau Kanban des commandes & fichier clients",
                    "Bilan quotidien envoyé à 18h sur WhatsApp",
                    "Présence dans le Marketplace public Japora",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="font-bold text-brand-dark">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link href="/start" className="btn-ghost mt-6 w-full justify-center">
                Commencer gratuitement →
              </Link>
            </div>

            {/* Pay as you sell */}
            <div className="glass glass-edge relative flex flex-col justify-between rounded-shape-xl p-6 sm:p-8 shadow-elev-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="a-eyebrow">Paiement Intégré</span>
                  <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold uppercase text-brand-dark">
                    Le plus choisi
                  </span>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="a-num font-display text-4xl font-extrabold text-arctic-900">
                    Gardez 97%
                  </span>
                  <span className="text-xs font-semibold text-brand-dark">
                    (3% tout compris)
                  </span>
                </div>
                <p className="mt-2 text-xs text-arctic-600 leading-relaxed">
                  Encaissez directement dans le chat (T-Money, Flooz, Wave, Orange). Les frais Mobile Money sont inclus dans les 3%.
                </p>
                <ul className="mt-5 space-y-2 text-xs text-arctic-800">
                  {[
                    "Tout ce qui est inclus dans l'offre Starter",
                    "Confirmation « ✓ Payé » automatique instantanée",
                    "0 FCFA de frais sur les petites commandes (< 2 000 FCFA)",
                    "Commission plafonnée à 1 000 FCFA maximum par commande",
                    "Éligibilité au badge officiel « Boutique Vérifiée »",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <span className="font-bold text-emerald-700">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <Link href="/start" className="a-btn a-btn--cafe flex-1 justify-center text-xs font-bold">
                  Ouvrir ma boutique
                </Link>
                <Link href="/pricing" className="btn-ghost justify-center text-xs">
                  Simuler mes frais
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
         * 10. MERCHANT TESTIMONIALS
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-8 max-w-xl text-center">
            <span className="a-eyebrow">Témoignages Commerçants</span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              Ils développent leur activité chaque jour avec Japora
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                quote:
                  "Mes clientes choisissent directement leur taille dans le catalogue et paient par T-Money. Je gagne plus de 2 heures chaque jour et je n'ai plus d'erreurs de commande.",
                author: "Afiwa M.",
                role: "Mode, Bazin & Prêt-à-porter",
                city: "Lomé (Grand Marché Adawlato)",
                metric: "+42% de commandes confirmées",
              },
              {
                quote:
                  "Le bot WhatsApp répond aux demandes de prix la nuit quand je dors. Le matin, je consulte mon tableau de bord et je n'ai plus qu'à préparer les livraisons.",
                author: "Moussa D.",
                role: "Smartphones & Accessoires High-Tech",
                city: "Cotonou (Dantokpa)",
                metric: "Réponse auto en < 2 sec",
              },
              {
                quote:
                  "Les liens de paiement pour les acomptes ont éliminé les faux rendez-vous. Mes clientes paient 30% d'avance sur Flooz ou Wave avant l'expédition.",
                author: "Fanta K.",
                role: "Cosmétiques naturels & Mèches",
                city: "Abidjan (Treichville)",
                metric: "0 impayé à la livraison",
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
                  <p className="text-xs sm:text-sm italic leading-relaxed text-arctic-800">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                </div>
                <div className="mt-5 border-t border-arctic-200/60 pt-3">
                  <div className="text-xs font-bold text-arctic-900">{t.author}</div>
                  <div className="text-[11px] text-arctic-600">
                    {t.role} · 📍 {t.city}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ============================================================
         * 11. FREQUENTLY ASKED QUESTIONS (FAQ)
         * ============================================================ */}
        <section className="mb-20">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <span className="a-eyebrow">Questions Fréquentes</span>
            <h2 className="a-headline-lg mt-1 text-arctic-900">
              Tout savoir avant de lancer votre boutique
            </h2>
          </div>

          <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-2">
            {[
              {
                q: "Ai-je besoin d'installer une nouvelle application ?",
                a: "Non. Japora fonctionne directement avec le WhatsApp que vous et vos clients utilisez déjà. Votre tableau de bord est accessible sur votre téléphone ou ordinateur (et installable en PWA).",
              },
              {
                q: "Combien coûte réellement Japora ?",
                a: "L'ouverture et l'utilisation du catalogue (mode Starter) sont 100% gratuites. Si vous activez l'encaissement Mobile Money automatisé via Japora, la commission est de 3% tout compris (plafonnée à 1 000 FCFA, et gratuite sous 2 000 FCFA).",
              },
              {
                q: "Comment mes clients paient-ils leurs commandes ?",
                a: "Ils peuvent payer via T-Money, Flooz, Wave, Orange Money, MTN MoMo, par carte bancaire, ou directement à la livraison selon les options que vous activez dans votre boutique.",
              },
              {
                q: "Puis-je importer mes produits existants de WhatsApp Business ?",
                a: "Oui ! Depuis votre page Produits, un bouton d'import en 1 clic récupère votre catalogue WhatsApp Business existant pour vous éviter de tout ressaisir.",
              },
              {
                q: "Comment obtenir le badge « Boutique Vérifiée » ?",
                a: "Vérifiez votre numéro WhatsApp par code OTP et complétez vos premières commandes payées avec succès. Le badge s'active automatiquement pour renforcer la confiance des acheteurs.",
              },
              {
                q: "Puis-je utiliser Japora pour mon stand physique au marché ?",
                a: "Absolument. Japora génère une affiche QR code prête à imprimer pour votre stand. Les passants scannent le code et accèdent immédiatement à tout votre catalogue sur leur téléphone.",
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
         * 12. CLOSING CALL-TO-ACTION BANNER
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
                Prêt en 90 secondes · Sans abonnement
              </span>
              <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-4xl">
                Prêt à professionnaliser votre commerce sur WhatsApp ?
              </h2>
              <p className="mx-auto max-w-xl text-xs leading-relaxed text-arctic-200 sm:text-sm">
                Rejoignez les marchands qui automatisent leurs prises de commandes, encaissent par Mobile Money et développent leur visibilité sur le Marketplace Japora.
              </p>
              <div className="flex flex-wrap justify-center gap-3 pt-3">
                <Link
                  href="/start"
                  className="a-btn a-btn--cafe a-btn--lg font-bold shadow-lg"
                >
                  Ouvrir ma boutique gratuitement →
                </Link>
                <Link
                  href="/marketplace"
                  className="a-btn a-btn--lg border border-white/25 bg-white/10 text-white hover:bg-white/20"
                >
                  Explorer le Marketplace
                </Link>
                <Link
                  href="/how-to-use"
                  className="a-btn a-btn--lg border border-white/15 bg-transparent text-arctic-200 hover:text-white"
                >
                  Voir comment ça marche
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
