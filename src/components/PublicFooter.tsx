import Link from "next/link";
import { REGIONS, CATEGORIES } from "@/lib/regions";

export default function PublicFooter() {
  const topRegions = REGIONS.slice(0, 6);
  const topCategories = CATEGORIES.slice(0, 6);

  return (
    <footer className="border-t border-arctic-300/50 bg-white/75 backdrop-blur-glass-thin">
      {/* Upper Trust Strip */}
      <div className="border-b border-arctic-200/60 bg-arctic-100/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
          {[
            {
              title: "Paiements Mobile Money",
              desc: "T-Money, Flooz, Wave, Orange & MTN MoMo",
              badge: "Instant",
            },
            {
              title: "Vendeurs Vérifiés",
              desc: "Numéro WhatsApp & historique contrôlés",
              badge: "Confiance",
            },
            {
              title: "Bot WhatsApp 24h/24",
              desc: "Réponses automatiques aux prix & stocks",
              badge: "IA Active",
            },
            {
              title: "0 FCFA d'abonnement",
              desc: "Démarrez gratuitement, gardez 97% par vente",
              badge: "Transparent",
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                  {item.badge}
                </span>
              </div>
              <div className="text-xs font-bold text-arctic-900 mt-1">{item.title}</div>
              <div className="text-[11px] text-arctic-600 leading-relaxed">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Footer Grid */}
      <div className="mx-auto max-w-6xl px-4 py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr,1fr,1fr,1fr,1fr]">
          {/* Column 1: Brand & Mission */}
          <div className="space-y-4">
            <Link href="/" className="group inline-flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-900 font-display text-lg font-extrabold text-arctic-50">
                J
              </span>
              <span className="font-display text-lg font-bold tracking-tight text-arctic-900">
                Japora
              </span>
            </Link>
            <p className="text-xs leading-relaxed text-arctic-600 max-w-xs">
              La plateforme de commerce conversationnel et le marketplace des marchands WhatsApp en Afrique. Créez votre catalogue, automatisez vos réponses et encaissez par Mobile Money sans quitter WhatsApp.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["T-Money", "Flooz", "Wave", "Orange Money", "MTN MoMo", "CinetPay"].map((rail) => (
                <span
                  key={rail}
                  className="rounded-md border border-arctic-300/60 bg-arctic-50 px-2 py-0.5 text-[10px] font-semibold text-arctic-700"
                >
                  {rail}
                </span>
              ))}
            </div>
          </div>

          {/* Column 2: Plateforme */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-arctic-900 mb-3">
              Plateforme
            </h3>
            <ul className="space-y-2 text-xs text-arctic-600">
              <li>
                <Link href="/marketplace" className="hover:text-arctic-900 hover:underline">
                  Explorer le Marketplace
                </Link>
              </li>
              <li>
                <Link href="/how-to-use" className="hover:text-arctic-900 hover:underline">
                  Comment ça marche (How it works)
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="hover:text-arctic-900 hover:underline">
                  Tarifs &amp; Commissions
                </Link>
              </li>
              <li>
                <Link href="/start" className="hover:text-arctic-900 hover:underline">
                  Inscription rapide WhatsApp OTP
                </Link>
              </li>
              <li>
                <Link href="/signup" className="hover:text-arctic-900 hover:underline">
                  Créer une boutique par Email
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-arctic-900 hover:underline">
                  Connexion Vendeur
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Catégories */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-arctic-900 mb-3">
              Rayons Populaires
            </h3>
            <ul className="space-y-2 text-xs text-arctic-600">
              {topCategories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/marketplace?category=${c.slug}`}
                    className="inline-flex items-center gap-1.5 hover:text-arctic-900 hover:underline"
                  >
                    <span>{c.icon}</span>
                    <span>{c.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Villes & Marchés */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-arctic-900 mb-3">
              Villes &amp; Marchés
            </h3>
            <ul className="space-y-2 text-xs text-arctic-600">
              {topRegions.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/marketplace/${r.slug}`}
                    className="hover:text-arctic-900 hover:underline"
                  >
                    {r.label} ({r.country})
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/marketplace"
                  className="font-semibold text-brand-dark hover:underline"
                >
                  Toutes les régions ({REGIONS.length}) →
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Écosystème & Légal */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-arctic-900 mb-3">
              Suite Wataru &amp; Légal
            </h3>
            <ul className="space-y-2 text-xs text-arctic-600">
              <li>
                <span className="font-semibold text-arctic-800">Japora</span> — Boutiques &amp; Catalogues
              </li>
              <li>
                <span className="font-semibold text-arctic-800">Soko CRM</span> — Matching &amp; Opportunités
              </li>
              <li>
                <span className="font-semibold text-arctic-800">WEscrow</span> — Séquestre Safe Hands
              </li>
              <li className="pt-2 border-t border-arctic-200/60">
                <Link href="/terms" className="hover:text-arctic-900 hover:underline">
                  Conditions d&apos;utilisation (Terms)
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-arctic-900 hover:underline">
                  Politique de confidentialité (Privacy)
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Copyright & Quick Links */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 border-t border-arctic-200/60 pt-6 text-xs text-arctic-600 sm:flex-row">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-arctic-900">© {new Date().getFullYear()} Japora</span>
            <span>·</span>
            <span>Sell on WhatsApp. Get paid. Grow your hustle.</span>
            <span>·</span>
            <span className="text-arctic-500">Lomé · Cotonou · Abidjan · Dakar · Lagos · Nairobi</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/how-to-use" className="hover:text-arctic-900">
              How it works
            </Link>
            <Link href="/pricing" className="hover:text-arctic-900">
              Pricing
            </Link>
            <Link href="/terms" className="hover:text-arctic-900">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-arctic-900">
              Privacy
            </Link>
            <Link href="/signup" className="font-bold text-arctic-900 hover:underline">
              Start your shop →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

