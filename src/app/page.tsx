import Link from "next/link";
import { getCurrentVendor } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuroraHeroPreview from "@/components/aurora/AuroraHeroPreview";
import ThemeToggle from "@/components/ThemeToggle";
import { listShops } from "@/lib/directory";
import VerifiedBadge from "@/components/VerifiedBadge";

/**
 * Aurora landing — the flagship surface for the M3-Expressive redesign.
 */

export default async function LandingPage() {
  const vendor = await getCurrentVendor();
  if (vendor) redirect("/dashboard");

  let featuredShops: any[] = [];
  try {
    featuredShops = await listShops({ take: 6 });
  } catch (e) {
    console.warn("Could not list shops on homepage", e);
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-arctic-200/40 bg-white/70 backdrop-blur-md transition-all duration-medium ease-emphasized">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-800 font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105"
            >J</span>
            <span className="a-title-md tracking-[-0.01em] text-arctic-900 font-bold">Japora</span>
          </Link>

          <nav className="flex items-center gap-2">
            <Link
              href="/marketplace"
              className="a-label-md flex items-center gap-1.5 rounded-shape-full bg-arctic-800 px-3.5 py-1.5 font-bold text-arctic-50 shadow-elev-1 transition-all duration-short hover:bg-arctic-700 hover:scale-105"
            >
              <span>🛍️</span>
              <span>Marketplace des Boutiques</span>
            </Link>
            <Link
              href="/how-to-use"
              className="hidden a-label-md text-arctic-700 hover:text-arctic-900 sm:mr-1 sm:inline font-medium"
            >
              Comment ça marche
            </Link>
            <ThemeToggle className="mr-0.5" />
            <Link href="/login" className="btn-ghost">
              Connexion
            </Link>
            <Link href="/signup" className="btn-primary">
              Créer ma boutique
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4">
        {/* Hero */}
        <section className="grid items-center gap-12 py-12 md:grid-cols-[1.05fr,1fr] md:py-20">
          <div className="a-fade-in">
            <span className="inline-flex items-center gap-2 rounded-shape-full border border-arctic-400/45 bg-white/65 px-3 py-1 backdrop-blur-glass-thin">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-arctic-800" />
              <span className="a-label-md text-arctic-800">Commerce WhatsApp & Marketplace Afrique</span>
            </span>

            <h1 className="a-display-md mt-4 text-arctic-900 sm:[font-size:var(--aurora-display-lg)] sm:[line-height:64px]">
              Vos boutiques WhatsApp,
              <br />
              <span className="text-arctic-700">accessibles à tous.</span>
            </h1>

            <p className="a-body-lg a-measure mt-4 text-arctic-700">
              Découvrez les meilleurs vendeurs vérifiés de votre région ou créez votre boutique en ligne connectée à votre numéro WhatsApp avec paiement Flooz &amp; T-Money intégré.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/marketplace" className="btn-primary flex items-center gap-2">
                <span>🔍</span>
                <span>Explorer le Marketplace</span>
              </Link>
              <Link href="/start" className="btn-ghost">
                Ouvrir ma boutique gratuite →
              </Link>
            </div>
          </div>

          <div className="relative">
            <AuroraHeroPreview />
          </div>
        </section>

        {/* Public Shop Search & Discovery Section */}
        <section className="mb-20 rounded-shape-2xl border border-arctic-200/60 bg-gradient-to-b from-white/90 to-arctic-50/80 p-6 md:p-10 shadow-elev-1 backdrop-blur-md">
          <div className="mx-auto max-w-3xl text-center">
            <span className="inline-block text-2xl mb-1">🏪</span>
            <h2 className="a-title-xl font-bold text-arctic-900">
              Trouvez une boutique ou un produit
            </h2>
            <p className="mt-2 a-body-md text-arctic-600">
              Recherchez parmi les marchands indépendants, parcourez leurs catalogues et passez commande directement sur WhatsApp.
            </p>

            {/* Direct Search Bar */}
            <form action="/marketplace" method="GET" className="mt-6 flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-arctic-400">
                  🔍
                </span>
                <input
                  type="text"
                  name="q"
                  placeholder="Nom de la boutique, robe bazin, smartphone, Lomé, Abidjan…"
                  className="w-full rounded-shape-full border border-arctic-300/80 bg-white py-3.5 pl-11 pr-4 text-arctic-900 shadow-sm focus:border-arctic-800 focus:outline-none focus:ring-2 focus:ring-arctic-800/20"
                />
              </div>
              <button
                type="submit"
                className="btn-primary whitespace-nowrap px-6 py-3.5 font-bold"
              >
                Rechercher
              </button>
            </form>

            {/* Quick category links */}
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {[
                { id: "fashion", label: "👗 Mode & Wax" },
                { id: "electronics", label: "📱 High-Tech" },
                { id: "beauty", label: "💄 Beauté & Mèches" },
                { id: "food", label: "🍲 Épicerie & Vins" },
                { id: "home", label: "🛋️ Maison & Déco" },
              ].map((c) => (
                <Link
                  key={c.id}
                  href={`/marketplace?category=${c.id}`}
                  className="rounded-shape-full border border-arctic-200 bg-white/70 px-3 py-1 text-xs font-medium text-arctic-700 hover:border-arctic-500 hover:bg-white transition-all"
                >
                  {c.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Featured Shops Grid */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="a-title-md font-bold text-arctic-900">Boutiques populaires à découvrir</h3>
              <Link href="/marketplace" className="text-xs font-semibold text-arctic-700 hover:text-arctic-900 hover:underline">
                Voir toutes les boutiques ({featuredShops.length}+) →
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredShops.map((shop) => (
                <Link
                  key={shop.id}
                  href={`/shop/${shop.shopSlug}`}
                  className="group flex flex-col justify-between rounded-shape-xl border border-arctic-200/60 bg-white/80 p-5 shadow-sm transition-all duration-short hover:-translate-y-1 hover:border-arctic-400 hover:shadow-elev-2"
                >
                  <div>
                    <div className="flex items-center gap-3">
                      {shop.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={shop.avatarUrl}
                          alt=""
                          className="h-12 w-12 rounded-full object-cover border border-arctic-200"
                        />
                      ) : (
                        <div className="grid h-12 w-12 place-items-center rounded-full bg-arctic-100 font-bold text-arctic-800 text-lg">
                          {shop.shopName?.charAt(0)?.toUpperCase() || "B"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-arctic-900 group-hover:text-arctic-700 truncate">
                          <span className="truncate">{shop.shopName}</span>
                          {shop.verified && <VerifiedBadge size="sm" withLabel={false} />}
                        </div>
                        <div className="text-xs text-arctic-500 truncate">
                          📍 {shop.region || "Togo"} · {shop.category || "Commerce"}
                        </div>
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-arctic-600 line-clamp-2">
                      {shop.tagline || shop.bio || "Boutique officielle disponible sur WhatsApp."}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-arctic-100 flex items-center justify-between text-xs font-medium text-arctic-800 group-hover:text-arctic-900">
                    <span>Visiter la boutique</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Feature trio — M3 expressive cards with cursor halo */}
        <section className="grid gap-4 pb-20 md:grid-cols-3">
          {[
            {
              k: "bot",
              title: "Bot in your WhatsApp",
              body:
                "Auto-answers “how much?” from your live catalog. You handle the tricky ones.",
              accent:
                "linear-gradient(135deg, rgb(var(--gold) / 0.14), transparent 70%)",
            },
            {
              k: "pay",
              title: "Get paid where they pay",
              body:
                "T-Money, Flooz, Moov, Orange Money — settled inline. You see ✓ Paid the moment money clears.",
              accent:
                "linear-gradient(135deg, rgb(var(--c-300) / 0.5), transparent 70%)",
            },
            {
              k: "summary",
              title: "6 PM hustle summary",
              body:
                "Orders, unpaid, top seller, what to restock. The day, distilled. Sent to your WhatsApp.",
              accent:
                "linear-gradient(135deg, rgb(var(--gold) / 0.10), transparent 70%)",
            },
          ].map((f, i) => (
            <article
              key={f.k}
              className="glass glass-edge a-hover-lift relative rounded-shape-lg p-6"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-shape-lg opacity-70"
                style={{ background: f.accent }}
              />
              <div className="relative">
                <FeatureGlyph k={f.k} />
                <h3 className="a-title-lg mt-3 text-arctic-900">{f.title}</h3>
                <p className="a-body-md a-measure mt-2 text-arctic-700">{f.body}</p>
              </div>
            </article>
          ))}
        </section>

        {/* Numbers strip — monochrome social proof */}
        <section className="mb-16">
          <div className="glass glass-edge grid grid-cols-2 gap-4 rounded-shape-lg p-6 sm:grid-cols-4">
            {[
              ["Keep 97%", "when you sell"],
              ["0", "monthly fee"],
              ["~90 sec", "to your first shop"],
              ["100", "Lighthouse mobile"],
            ].map(([n, l]) => (
              <div key={l} className="text-center">
                <div className="a-headline-lg text-arctic-900">{n}</div>
                <div className="a-label-md mt-1 text-arctic-700">{l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="mb-20">
          <div className="text-center max-w-xl mx-auto mb-10">
            <span className="text-xs uppercase font-bold tracking-widest text-brand-dark">
              Tout pour vendre en toute simplicité
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-arctic-900 mt-2">
              Pensé pour les commerçants d&apos;Afrique de l&apos;Ouest
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                icon: "📦",
                title: "Gestion des Livraisons",
                desc: "Définissez vos tarifs par quartier (Lomé Centre, Agoè...) et collectez l'adresse en un clic.",
              },
              {
                icon: "⭐",
                title: "Avis & Confiance",
                desc: "Recueillez les retours de vos clients fidèles pour rassurer vos nouveaux acheteurs.",
              },
              {
                icon: "🔗",
                title: "Liens de Paiement",
                desc: "Envoyez des liens Mobile Money pour vos acomptes ou commandes sur-mesure.",
              },
              {
                icon: "🗂️",
                title: "Collections & Rayons",
                desc: "Organisez votre catalogue par saison, arrivage ou promotion pour stimuler les ventes.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="glass rounded-shape-lg p-5 border border-arctic-400/30 hover:border-arctic-400/70 transition-all hover:-translate-y-1"
              >
                <span className="text-3xl block mb-3">{item.icon}</span>
                <h3 className="font-bold text-sm text-arctic-900 mb-1.5">{item.title}</h3>
                <p className="text-xs text-arctic-600 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="mb-20">
          <div className="text-center max-w-xl mx-auto mb-8">
            <span className="text-xs uppercase font-bold tracking-widest text-emerald-600">
              Témoignages Commerçants
            </span>
            <h2 className="text-2xl font-bold text-arctic-900 mt-1">
              Ils vendent chaque jour avec Japora
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                quote: "Mes clientes choisissent directement leur taille et paient par T-Money. Je gagne 2h par jour.",
                author: "Afiwa M.",
                role: "Mode & Prêt-à-porter",
                city: "Lomé (Adawlato)",
              },
              {
                quote: "Le bot répond au prix la nuit quand je dors. Le matin, je n'ai plus qu'à emballer les colis.",
                author: "Moussa D.",
                role: "Électronique & Accessoires",
                city: "Cotonou (Dantokpa)",
              },
              {
                quote: "Les liens de paiement pour les acomptes ont éliminé les faux rendez-vous de livraison.",
                author: "Fanta K.",
                role: "Cosmétiques naturels",
                city: "Abidjan (Treichville)",
              },
            ].map((t) => (
              <div
                key={t.author}
                className="glass p-6 rounded-2xl border border-arctic-400/30 flex flex-col justify-between"
              >
                <p className="text-xs italic text-arctic-700 leading-relaxed mb-4">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div>
                  <div className="font-bold text-xs text-arctic-900">{t.author}</div>
                  <div className="text-[11px] text-arctic-500">
                    {t.role} · {t.city}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA Banner */}
        <section className="mb-20">
          <div className="rounded-3xl bg-gradient-to-br from-arctic-900 via-arctic-800 to-slate-900 text-white p-8 sm:p-12 text-center shadow-xl relative overflow-hidden">
            <div className="relative z-10 max-w-xl mx-auto space-y-4">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Prêt à faire décoller votre commerce ?
              </h2>
              <p className="text-xs sm:text-sm text-arctic-300">
                Créez votre boutique en ligne en 90 secondes. Aucun abonnement mensuel, commencez 100% gratuitement.
              </p>
              <div className="pt-2 flex flex-wrap justify-center gap-3">
                <Link
                  href="/start"
                  className="px-6 py-3 rounded-full bg-white text-arctic-900 font-bold text-xs sm:text-sm hover:bg-arctic-100 transition-colors shadow-lg"
                >
                  Ouvrir ma boutique maintenant →
                </Link>
                <Link
                  href="/marketplace"
                  className="px-6 py-3 rounded-full bg-arctic-800/80 hover:bg-arctic-750 text-white font-medium text-xs sm:text-sm border border-white/20 transition-colors"
                >
                  Découvrir les boutiques
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-arctic-400/30 bg-white/55 backdrop-blur-glass-thin">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6">
          <span className="a-body-sm text-arctic-700">© Japora</span>
          <nav className="flex items-center gap-5">
            <Link href="/how-to-use" className="a-label-md text-arctic-700 hover:text-arctic-900">
              How it works
            </Link>
            <Link href="/pricing" className="a-label-md text-arctic-700 hover:text-arctic-900">
              Pricing
            </Link>
            <Link href="/terms" className="a-label-md text-arctic-700 hover:text-arctic-900">
              Terms
            </Link>
            <Link href="/privacy" className="a-label-md text-arctic-700 hover:text-arctic-900">
              Privacy
            </Link>
            <Link
              href="/signup"
              className="a-label-md font-bold text-arctic-900 hover:underline"
            >
              Start your shop →
            </Link>
          </nav>
        </div>
      </footer>
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
