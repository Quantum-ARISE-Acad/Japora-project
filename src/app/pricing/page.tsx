import Link from "next/link";
import { SaasIcon } from "@/components/ui/SaasIcons";
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
import { getPublicLocale, publicText, getServerTr } from "@/lib/public-locale";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getServerTr();
  return {
    title: tr("Tarifs & commissions — Japora", "Pricing & fees — Japora"),
    description: tr(
      "0 FCFA d'abonnement mensuel. Démarrez gratuitement sur WhatsApp et gardez 97 % sur les paiements Mobile Money intégrés.",
      "0 FCFA monthly subscription. Start free on WhatsApp and keep 97% of built-in Mobile Money payments.",
    ),
  };
}

export default async function PricingPage() {
  const vendor = await getCurrentVendor();
  const locale = await getPublicLocale();
  const t = (fr: string, en: string) => publicText(fr, en, locale);
  const cur = PRICING.displayCurrency; // XOF (launch market)
  const floor = formatMoney(PRICING.freeBelowCents, cur);
  const cap = formatMoney(PRICING.feeCapCents, cur);

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader isAuthenticated={Boolean(vendor)} shopSlug={vendor?.shopSlug} />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-14">
        {/* ============================================================
         * 1. HERO
         * ============================================================ */}
        <div className="text-center a-fade-in">
          <div className="a-eyebrow">{t("Tarification transparente", "Transparent pricing")}</div>
          <h1 className="a-display-sm mt-2 text-arctic-900 sm:a-display-md">
            {t("Gratuit pour démarrer. Payez uniquement quand vous vendez.", "Free to start. Pay only when you sell.")}
          </h1>
          <p className="a-body-lg mx-auto mt-3 max-w-2xl text-arctic-700">
            {t("Aucun abonnement mensuel obligatoire, aucune carte bancaire pour ouvrir votre boutique. Lorsque vous encaissez via Japora, vous gardez", "No mandatory monthly subscription and no credit card needed to open your shop. When you collect payment through Japora, you keep")}{" "}
            <span className="font-bold text-brand-dark">
              {PRICING_KEEP_PERCENT}%
            </span>{" "}
            {t("— frais Mobile Money inclus.", "— Mobile Money fees included.")}
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
                {t("Gratuit à vie", "Free forever")}
              </span>
            </div>
            <div className="mt-3 flex items-end gap-2">
              <span className="a-num font-display text-5xl font-semibold leading-none text-arctic-900">
                0%
              </span>
              <span className="pb-1 text-xs font-semibold text-arctic-600">
                {t("0 FCFA / mois", "0 XOF / month")}
              </span>
            </div>
            <p className="a-body-sm mt-3 text-arctic-600 leading-relaxed">
              {t("Vendez sur WhatsApp gratuitement, sans limite de temps. Vos clients vous paient directement sur votre propre numéro T-Money ou Flooz.", "Sell on WhatsApp for free, with no time limit. Customers pay you directly through your own T-Money or Flooz number.")}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 a-body-md text-arctic-800">
              {[
                t("Votre catalogue en ligne + lien partageable & QR code de stand", "Online catalog + shareable link and stall QR code"),
                t("Le bot WhatsApp répond aux demandes de prix jour et nuit", "WhatsApp bot answers price questions day and night"),
                t("Tableau Kanban des commandes, CRM clients & bilan de 18h", "Order Kanban board, customer CRM, and 6 PM summary"),
                t("Référencement public dans le Marketplace Japora", "Public listing in the Japora Marketplace"),
                t("Produits, commandes et discussions WhatsApp illimités", "Unlimited products, orders, and WhatsApp conversations"),
                t("200 notifications marketing offertes chaque mois", "200 free marketing notifications every month"),
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs sm:text-sm">
                  <SaasIcon name="check" size={15} className="mt-0.5 shrink-0 text-brand-dark" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={vendor ? "/dashboard" : "/start"}
              className="btn-ghost mt-7 w-full justify-center"
            >
              {vendor ? t("Accéder au tableau de bord", "Go to dashboard") : t("Commencer gratuitement", "Get started for free")}
            </Link>
          </div>

          {/* Pro — pay as you sell */}
          <div className="glass glass-edge relative flex flex-col overflow-hidden rounded-shape-xl p-6 sm:p-8 shadow-elev-2">
            <span className="absolute right-4 top-4 a-eyebrow rounded-full bg-brand/15 px-3 py-1">
              {t("Le plus populaire", "Most popular")}
            </span>
            <div className="a-eyebrow">{t("Payez à la vente · Paiement intégré", "Pay as you sell · Integrated payments")}</div>
            <div className="mt-3 flex items-end gap-2">
              <span className="a-num font-display text-5xl font-semibold leading-none text-arctic-900">
                {t(`Gardez ${PRICING_KEEP_PERCENT}%`, `Keep ${PRICING_KEEP_PERCENT}%`)}
              </span>
            </div>
            <p className="a-body-sm mt-3 text-arctic-600 leading-relaxed">
              {t("Encaissez directement dans le chat (T-Money, Flooz, Moov, Orange, Wave). La commission unique Japora est de", "Accept payments directly in chat (T-Money, Flooz, Moov, Orange, Wave). Japora charges a single fee of")}{" "}
              <span className="font-semibold text-brand-dark">
                {PRICING_FEE_PERCENT}%
              </span>{" "}
              {t("par commande payée — frais opérateur Mobile Money inclus. Aucun abonnement mensuel.", "per paid order — Mobile Money operator fees included. No monthly subscription.")}
            </p>
            <ul className="mt-6 flex-1 space-y-2.5 a-body-md text-arctic-800">
              {[
                t("Tout ce qui est inclus dans l'offre Starter", "Everything included in the Starter plan"),
                t("Paiement intégré — statut « Payé » automatique instantané", "Integrated payments — instant automatic “Paid” status"),
                t(`Commandes inférieures à ${floor} : 0 FCFA de frais (gratuit)`, "Orders below " + floor + ": no fees (free)"),
                t(`Commission plafonnée à ${cap} maximum par commande`, "Commission capped at " + cap + " per order"),
                t("Éligibilité au badge officiel « Boutique Vérifiée »", "Eligible for the official “Verified Shop” badge"),
                t("Liens de paiement rapides & acomptes sur précommandes", "Quick payment links and pre-order deposits"),
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs sm:text-sm">
                  <span className="mt-0.5 shrink-0" style={{ color: "var(--aurora-success-text)" }}>
                    <SaasIcon name="check" size={15} />
                  </span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href={vendor ? "/dashboard/billing" : "/signup"}
              className="a-btn a-btn--cafe mt-7 w-full justify-center font-bold"
            >
              {vendor ? t("Gérer ma facturation", "Manage billing") : t("Ouvrir ma boutique Pro", "Open my Pro shop")}
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
            <span className="a-eyebrow">            {t("Comparatif détaillé", "Detailed comparison")}</span>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              {t("Starter vs Paiement Intégré : que contient chaque formule ?", "Starter vs Integrated Payments: what does each plan include?")}
            </h2>
          </div>

          <div className="overflow-hidden rounded-shape-xl border border-arctic-300/60 bg-white/85 shadow-elev-1">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-arctic-200 bg-arctic-100/70 text-arctic-900">
                  <th className="p-4 font-display font-bold">{t("Fonctionnalité", "Feature")}</th>
                  <th className="p-4 text-center font-display font-bold">
                    {t("Starter (gratuit)", "Starter (free)")}
                  </th>
                  <th className="p-4 text-center font-display font-bold text-brand-dark">
                    {t("Payez à la vente (gardez 97 %)", "Pay-as-you-sell (keep 97%)")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-arctic-200/60 text-arctic-800">
                {[
                  [t("Abonnement mensuel", "Monthly subscription"), "0 FCFA", "0 FCFA"],
                  [t("Catalogue produits & collections", "Product catalog and collections"), t("Illimité", "Unlimited"), t("Illimité", "Unlimited")],
                  [t("Bot WhatsApp 24h/24 & Horaires", "24/7 WhatsApp bot and business hours"), t("Inclus", "Included"), t("Inclus", "Included")],
                  [t("Affiche QR Code pour stand physique", "QR code for physical stalls"), t("Inclus", "Included"), t("Inclus", "Included")],
                  [t("Présence sur le Marketplace public", "Public Marketplace listing"), t("Inclus", "Included"), t("Prioritaire + Badge Vérifié", "Priority + Verified badge")],
                  [t("Mode d'encaissement", "Payment method"), t("Direct vendeur (0%)", "Direct to seller (0%)"), t("Intégré T-Money / Flooz / Wave (3%)", "Integrated T-Money / Flooz / Wave (3%)")],
                  [t("Petites commandes (< 2 000 FCFA)", "Small orders (< 2,000 XOF)"), "0 FCFA", t("0 FCFA (Gratuit)", "0 XOF (Free)")],
                  [t("Plafond de commission par commande", "Commission cap per order"), "—", t("Maximum 1 000 FCFA", "Maximum 1,000 XOF")],
                  [t("Bilan quotidien 18h & Comptabilité P&L", "Daily 6 PM summary and P&L bookkeeping"), t("Inclus", "Included"), t("Inclus", "Included")],
                  [t("CRM Clients, Fidélité & Créances", "Customer CRM, loyalty, and receivables"), t("Inclus", "Included"), t("Inclus", "Included")],
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
            <span className="a-eyebrow">{t("Questions sur la facturation", "Billing questions")}</span>
            <h2 className="a-headline-md mt-1 text-arctic-900">
              {t("Aucun frais caché, aucune surprise", "No hidden fees, no surprises")}
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              {
                q: t("Pourquoi les commandes sous 2 000 FCFA sont-elles gratuites ?", "Why are orders under 2,000 XOF free?"),
                a: t("Nous ne taxons pas les petites ventes du quotidien. En dessous de 2 000 FCFA, vous ne payez aucune commission Japora.", "We don't tax everyday small sales. Orders under 2,000 XOF incur no Japora commission."),
              },
              {
                q: t("Comment fonctionne le plafond de 1 000 FCFA ?", "How does the 1,000 XOF cap work?"),
                a: t("Si vous vendez un smartphone ou une tenue de cérémonie à 80 000 FCFA, 3% feraient 2 400 FCFA. Grâce au plafond, la commission s'arrête à 1 000 FCFA maximum.", "If you sell a phone or formal outfit for 80,000 XOF, 3% would be 2,400 XOF. The cap limits the commission to 1,000 XOF."),
              },
              {
                q: t("Les frais T-Money / Flooz sont-ils compris dans les 3% ?", "Are T-Money / Flooz fees included in the 3%?"),
                a: t("Oui. Les 3% sont « tout compris » (all-in) et couvrent déjà le traitement Mobile Money afin que votre marge soit 100% prévisible.", "Yes. The 3% is all-in and already covers Mobile Money processing, so your margin is fully predictable."),
              },
              {
                q: t("Puis-je passer de Starter à Pay-as-you-sell à tout moment ?", "Can I switch from Starter to Pay-as-you-sell at any time?"),
                a: t("Oui, vous pouvez commencer en mode Starter gratuit et activer les rails de paiement intégrés dès que vous êtes prêt depuis vos paramètres.", "Yes. Start with the free Starter plan and enable integrated payment methods from Settings whenever you're ready."),
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
          {t(`Prix affichés en francs CFA (XOF). Les ${PRICING_FEE_PERCENT}% sont tout compris — ils couvrent déjà les frais de transaction Mobile Money, sans mauvaise surprise au règlement.`, `Prices are shown in CFA francs (XOF). The ${PRICING_FEE_PERCENT}% fee is all-in and includes Mobile Money transaction costs, with no surprises at settlement.`)}
        </p>
      </main>

      <PublicFooter />
    </div>
  );
}
