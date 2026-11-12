import Link from "next/link";
import type { Metadata } from "next";
import { getCurrentVendor } from "@/lib/auth";
import {
  PRICING,
  PRICING_FEE_PERCENT,
  PRICING_KEEP_PERCENT,
} from "@/lib/billing";
import { formatMoney } from "@/lib/utils";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import PricingCalculator from "./PricingCalculator";

export const metadata: Metadata = {
  title: "Tarifs & Commissions — Japora",
  description:
    "0 FCFA d'abonnement mensuel. Démarrez gratuitement sur WhatsApp et gardez 97% sur les paiements Mobile Money intégrés.",
};

export default async function PricingPage() {
  const vendor = await getCurrentVendor();
  const cur = PRICING.displayCurrency; // XOF (launch market)
  const floor = formatMoney(PRICING.freeBelowCents, cur);
  const cap = formatMoney(PRICING.feeCapCents, cur);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader isAuthenticated={Boolean(vendor)} shopSlug={vendor?.shopSlug} />

      <main className="mx-auto max-w-6xl flex-1 px-4 py-14">
        {/* ============================================================
         * 1. HERO
         * ============================================================ */}
        <div className="text-center a-fade-in">
          <div className="a-eyebrow">Tarification Transparente · Pricing</div>
          <h1 className="a-display-sm mt-2 text-arctic-900 sm:a-display-md">
            Gratuit pour démarrer. Payez uniquement quand vous vendez.
          </h1>
          <p className="a-body-lg mx-auto mt-3 max-w-2xl text-arctic-700">
            Aucun abonnement mensuel obligatoire, aucune carte bancaire pour ouvrir votre boutique. Lorsque vous encaissez via Japora, vous gardez{" "}
            <span className="font-bold text-brand-dark">
              {PRICING_KEEP_PERCENT}%
            </span>{" "}
            — frais Mobile Money inclus.
          </p>
        </div>

        {/* ============================================================
         * 2. TWO TIERS CARDS
         * ============================================================ */}
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-2">
          {/* Starter — free */}
          <div className="card flex flex-col p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div className="a-eyebrow">Starter</div>
              <span className="rounded-full bg-arctic-200 px-2.5 py-0.5 text-[10px] font-bold text-arctic-800">
                Gratuit à vie
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="a-num font-display text-5xl font-semibold leading-none text-arctic-900">
                0%
              </span>
              <span className="pb-1 text-xs font-semibold text-arctic-600">
                0 FCFA / mois
              </span>
            </div>
            <p className="a-body-sm mt-3 text-arctic-600 leading-relaxed">
              Vendez sur WhatsApp gratuitement, sans limite de temps. Vos clients vous paient directement sur votre propre numéro T-Money ou Flooz.
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 a-body-md text-arctic-800">
              {[
                "Votre catalogue en ligne + lien partageable & QR code de stand",
                "Le bot WhatsApp répond aux demandes de prix jour et nuit",
                "Tableau Kanban des commandes, CRM clients & bilan de 18h",
                "Référencement public dans le Marketplace Japora",
                "Produits, commandes et discussions WhatsApp illimités",
                "200 notifications marketing offertes chaque mois",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs sm:text-sm">
                  <span className="mt-0.5 font-bold text-brand-dark">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={vendor ? "/dashboard" : "/start"}
              className="btn-ghost mt-7 w-full justify-center"
            >
              {vendor ? "Accéder au tableau de bord" : "Commencer gratuitement"}
            </Link>
          </div>

          {/* Pro — pay as you sell */}
          <div className="glass glass-edge relative flex flex-col overflow-hidden rounded-shape-xl p-6 sm:p-8 shadow-elev-2">
            <span className="absolute right-4 top-4 a-eyebrow rounded-full bg-brand/15 px-3 py-1">
              Le plus populaire
            </span>
            <div className="a-eyebrow">Pay as you sell · Paiement Intégré</div>
            <div className="mt-3 flex items-end gap-2">
              <span className="a-num font-display text-5xl font-semibold leading-none text-arctic-900">
                Gardez {PRICING_KEEP_PERCENT}%
              </span>
            </div>
            <p className="a-body-sm mt-3 text-arctic-600 leading-relaxed">
              Encaissez directement dans le chat (T-Money, Flooz, Moov, Orange, Wave). La commission unique Japora est de{" "}
              <span className="font-semibold text-brand-dark">
                {PRICING_FEE_PERCENT}%
              </span>{" "}
              par commande payée — frais opérateur Mobile Money inclus. Aucun abonnement mensuel.
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 a-body-md text-arctic-800">
              {[
                "Tout ce qui est inclus dans l'offre Starter",
                "Paiement intégré — statut « ✓ Payé » automatique instantané",
                `Commandes inférieures à ${floor} : 0 FCFA de frais (gratuit)`,
                `Commission plafonnée à ${cap} maximum par commande`,
                "Éligibilité au badge officiel « Boutique Vérifiée »",
                "Liens de paiement rapides & acomptes sur précommandes",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs sm:text-sm">
                  <span className="mt-0.5 font-bold text-emerald-700">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={vendor ? "/dashboard/billing" : "/signup"}
              className="a-btn a-btn--cafe mt-7 w-full justify-center font-bold"
            >
              {vendor ? "Gérer ma facturation" : "Ouvrir ma boutique Pro"}
            </Link>
          </div>
        </div>

        {/* ============================================================
         * 3. INTERACTIVE COMMISSION CALCULATOR
         * ============================================================ */}
        <section className="mx-auto mt-14 max-w-4xl">
          <PricingCalculator />
        </section>

        {/* ============================================================
         * 4. FEATURE COMPARISON TABLE
         * ============================================================ */}
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="mb-6 text-center">
            <span className="a-eyebrow">Comparatif Détaillé</span>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              Starter vs Paiement Intégré : que contient chaque formule ?
            </h2>
          </div>

          <div className="overflow-hidden rounded-shape-xl border border-arctic-300/60 bg-white/85 shadow-elev-1">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-arctic-200 bg-arctic-100/70 text-arctic-900">
                  <th className="p-4 font-display font-bold">Fonctionnalité</th>
                  <th className="p-4 text-center font-display font-bold">
                    Starter (Gratuit)
                  </th>
                  <th className="p-4 text-center font-display font-bold text-brand-dark">
                    Pay-as-you-sell (Keep 97%)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arctic-200/60 text-arctic-800">
                {[
                  ["Abonnement mensuel", "0 FCFA", "0 FCFA"],
                  ["Catalogue produits & collections", "Illimité ✓", "Illimité ✓"],
                  ["Bot WhatsApp 24h/24 & Horaires", "Inclus ✓", "Inclus ✓"],
                  ["Affiche QR Code pour stand physique", "Inclus ✓", "Inclus ✓"],
                  ["Présence sur le Marketplace public", "Inclus ✓", "Prioritaire + Badge Vérifié ✓"],
                  ["Mode d'encaissement", "Direct vendeur (0%)", "Intégré T-Money / Flooz / Wave (3%)"],
                  ["Petites commandes (< 2 000 FCFA)", "0 FCFA", "0 FCFA (Gratuit)"],
                  ["Plafond de commission par commande", "—", "Maximum 1 000 FCFA"],
                  ["Bilan quotidien 18h & Comptabilité P&L", "Inclus ✓", "Inclus ✓"],
                  ["CRM Clients, Fidélité & Créances", "Inclus ✓", "Inclus ✓"],
                ].map(([feat, starter, pro]) => (
                  <tr key={feat} className="hover:bg-arctic-50/80">
                    <td className="p-3.5 font-medium text-arctic-900">{feat}</td>
                    <td className="p-3.5 text-center text-arctic-700">{starter}</td>
                    <td className="p-3.5 text-center font-semibold text-arctic-900">
                      {pro}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ============================================================
         * 5. PRICING FAQ
         * ============================================================ */}
        <section className="mx-auto mt-16 max-w-4xl">
          <div className="mb-6 text-center">
            <span className="a-eyebrow">Questions sur la facturation</span>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              Aucun frais caché, aucune surprise
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                q: "Pourquoi les commandes sous 2 000 FCFA sont-elles gratuites ?",
                a: "Nous ne taxons pas les petites ventes du quotidien. En dessous de 2 000 FCFA, vous ne payez aucune commission Japora.",
              },
              {
                q: "Comment fonctionne le plafond de 1 000 FCFA ?",
                a: "Si vous vendez un smartphone ou une tenue de cérémonie à 80 000 FCFA, 3% feraient 2 400 FCFA. Grâce au plafond, la commission s'arrête à 1 000 FCFA maximum.",
              },
              {
                q: "Les frais T-Money / Flooz sont-ils compris dans les 3% ?",
                a: "Oui. Les 3% sont « tout compris » (all-in) et couvrent déjà le traitement Mobile Money afin que votre marge soit 100% prévisible.",
              },
              {
                q: "Puis-je passer de Starter à Pay-as-you-sell à tout moment ?",
                a: "Oui, vous pouvez commencer en mode Starter gratuit et activer les rails de paiement intégrés dès que vous êtes prêt depuis vos paramètres.",
              },
            ].map((item) => (
              <div
                key={item.q}
                className="rounded-shape-lg border border-arctic-300/60 bg-white/80 p-5"
              >
                <h3 className="font-display text-sm font-bold text-arctic-900">
                  {item.q}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-arctic-600">
                  {item.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        <p className="mx-auto mt-10 max-w-xl text-center a-body-sm text-arctic-600">
          Prix affichés en francs CFA (XOF). Les {PRICING_FEE_PERCENT}% sont tout compris — ils couvrent déjà les frais de transaction Mobile Money, sans mauvaise surprise au règlement.
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}
