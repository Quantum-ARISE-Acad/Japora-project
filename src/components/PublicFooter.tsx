"use client";

import Link from "next/link";
import { REGIONS, CATEGORIES } from "@/lib/regions";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { CategoryIcon } from "@/components/ui/SaasIcons";

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

export default function PublicFooter() {
  const { tr } = usePublicLang();
  const topRegions = REGIONS.slice(0, 6);
  const topCategories = CATEGORIES.slice(0, 6);

  return (
    <footer className="border-t border-arctic-300/50 bg-white/75 backdrop-blur-glass-thin">
      {/* Upper Trust Strip */}
      <div className="border-b border-arctic-200/60 bg-arctic-100/50">
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-4 px-4 py-6 sm:grid-cols-4">
          {[
            {
              title: tr("Paiements Mobile Money", "Mobile Money Payments"),
              desc: tr(
                "T-Money, Flooz, Celtiis, MoMo & carte",
                "T-Money, Flooz, Celtiis, MoMo & card"
              ),
              badge: tr("Instant", "Instant"),
            },
            {
              title: tr("Vendeurs Vérifiés", "Verified Sellers"),
              desc: tr(
                "Numéro WhatsApp & historique contrôlés",
                "Verified WhatsApp number & order history"
              ),
              badge: tr("Confiance", "Trusted"),
            },
            {
              title: tr("Bot WhatsApp 24h/24", "24/7 WhatsApp Bot"),
              desc: tr(
                "Réponses automatiques aux prix & stocks",
                "Automated price & stock answers day and night"
              ),
              badge: tr("IA Active", "AI Powered"),
            },
            {
              title: tr("Suivi Complet des Ventes", "Complete Sales Tracking"),
              desc: tr(
                "Tableau Kanban, CRM clients & bilan chaque soir à 18h",
                "Kanban board, customer CRM & 6 PM daily summary"
              ),
              badge: tr("Pilotage", "Analytics"),
            },
          ].map((item) => (
            <div key={item.title} className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-dark">
                  {item.badge}
                </span>
              </div>
              <div className="mt-1 text-xs font-bold text-arctic-900">{item.title}</div>
              <div className="text-[11px] leading-relaxed text-arctic-600">{item.desc}</div>
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
            <p className="max-w-xs text-xs leading-relaxed text-arctic-600">
              {tr(
                "La plateforme de commerce en ligne et sur WhatsApp en Afrique. Créez votre catalogue, automatisez vos réponses, encaissez par Mobile Money et suivez vos ventes en temps réel.",
                "The online and WhatsApp commerce platform for Africa. Build your catalog, automate replies, get paid via Mobile Money, and track your sales in real time."
              )}
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {["T-Money", "Flooz", "Wave", "Orange Money", "MTN MoMo", "CinetPay"].map((rail) => (
                <span
                  key={rail}
                  className="rounded-shape-sm border border-arctic-300/60 bg-arctic-50 px-2 py-0.5 text-[10px] font-semibold text-arctic-700"
                >
                  {rail}
                </span>
              ))}
            </div>
          </div>

          {/* Column 2: Plateforme */}
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-arctic-900">
              {tr("Plateforme", "Platform")}
            </h2>
            <ul className="space-y-2 text-xs text-arctic-600">
              <li>
                <Link href="/marketplace" className="inline-flex min-h-6 items-center hover:text-arctic-900 hover:underline">
                  {tr("Explorer le Marketplace", "Explore Marketplace")}
                </Link>
              </li>
              <li>
                <Link href="/how-to-use" className="inline-flex min-h-6 items-center hover:text-arctic-900 hover:underline">
                  {tr("Comment ça marche", "How it works")}
                </Link>
              </li>
              <li>
                <Link href="/signup" className="inline-flex min-h-6 items-center hover:text-arctic-900 hover:underline">
                  {tr("Créer une boutique", "Create a Shop")}
                </Link>
              </li>
              <li>
                <Link href="/login" className="inline-flex min-h-6 items-center hover:text-arctic-900 hover:underline">
                  {tr("Connexion Vendeur", "Vendor Sign in")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3: Catégories */}
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-arctic-900">
              {tr("Rayons Populaires", "Popular Categories")}
            </h2>
            <ul className="space-y-2 text-xs text-arctic-600">
              {topCategories.map((c) => (
                <li key={c.slug}>
                  <Link
                    href={`/marketplace?category=${c.slug}`}
                    className="inline-flex min-h-6 items-center gap-1.5 hover:text-arctic-900 hover:underline"
                  >
                    <CategoryIcon slug={c.slug} size={14} className="text-brand-dark" />
                    <span>{tr(CATEGORY_FR[c.slug] || c.label, c.label)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Villes & Marchés */}
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-arctic-900">
              {tr("Villes & Marchés", "Cities & Markets")}
            </h2>
            <ul className="space-y-2 text-xs text-arctic-600">
              {topRegions.map((r) => (
                <li key={r.slug}>
                  <Link
                    href={`/marketplace/${r.slug}`}
                    className="inline-flex min-h-6 items-center hover:text-arctic-900 hover:underline"
                  >
                    {r.label} ({r.country})
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/marketplace"
                  className="inline-flex min-h-6 items-center font-semibold text-brand-dark hover:underline"
                >
                  {tr(
                    `Toutes les régions (${REGIONS.length})`,
                    `All regions (${REGIONS.length})`
                  )}
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 5: Ressources & Légal */}
          <div>
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-arctic-900">
              {tr("Outils & Légal", "Tools & Legal")}
            </h2>
            <ul className="space-y-2 text-xs text-arctic-600">
              <li>
                <span className="font-semibold text-arctic-800">
                  {tr("Catalogue & QR Code", "Catalog & Stall QR")}
                </span>
              </li>
              <li>
                <span className="font-semibold text-arctic-800">
                  {tr("Bot WhatsApp & CRM", "WhatsApp Bot & CRM")}
                </span>
              </li>
              <li>
                <span className="font-semibold text-arctic-800">
                  {tr("Comptabilité & Bilan 18h", "Bookkeeping & 6 PM Recap")}
                </span>
              </li>
              <li className="border-t border-arctic-200/60 pt-2">
                <Link href="/terms" className="inline-flex min-h-6 items-center hover:text-arctic-900 hover:underline">
                  {tr("Conditions d'utilisation", "Terms of Service")}
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="inline-flex min-h-6 items-center hover:text-arctic-900 hover:underline">
                  {tr("Politique de confidentialité", "Privacy Policy")}
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
            <span>
              {tr(
                "Vendez en ligne et sur WhatsApp. Suivez vos ventes.",
                "Sell online and on WhatsApp. Track your sales."
              )}
            </span>
            <span>·</span>
            <span className="text-arctic-600">Lomé · Cotonou · Abidjan · Dakar · Lagos · Nairobi</span>
          </div>
          {/* 16px tall was under the 24x24 floor of WCAG 2.5.8; these are
              discrete links in a row, not words inside a sentence. */}
          <div className="flex flex-wrap items-center gap-x-4">
            <Link
              href="/how-to-use"
              className="inline-flex min-h-[24px] items-center hover:text-arctic-900"
            >
              {tr("Comment ça marche", "How it works")}
            </Link>
            <Link
              href="/terms"
              className="inline-flex min-h-[24px] items-center hover:text-arctic-900"
            >
              {tr("Conditions", "Terms")}
            </Link>
            <Link
              href="/privacy"
              className="inline-flex min-h-[24px] items-center hover:text-arctic-900"
            >
              {tr("Confidentialité", "Privacy")}
            </Link>
            <Link
              href="/signup"
              className="inline-flex min-h-[24px] items-center font-bold text-arctic-900 hover:underline"
            >
              {tr("Ouvrir ma boutique", "Open my shop")}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
