"use client";

import Link from "next/link";
import { SaasIcon } from "@/components/ui/SaasIcons";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * Pricing, on the page where the decision is actually made.
 *
 * A micro-vendor's objection is never "is it good?", it is "what will this
 * cost me?" — so the number goes on the landing page rather than one click
 * away, and it goes in the ledger: tabular figures on a gold hairline, which
 * is the one place this design spends boldness.
 *
 * Every figure arrives formatted from the server (see page.tsx) so the money
 * never renders differently before and after hydration, and so the rate, the
 * floor and the cap keep coming from PRICING in src/lib/billing.ts — one edit
 * re-prices the product and this section together.
 */

export type PricingFacts = {
  feePercent: number;
  keepPercent: number;
  /** Orders below this are free. */
  floor: string;
  /** The fee never exceeds this on one order. */
  cap: string;
  /** A worked example, so the rate stops being an abstraction. */
  exampleOrder: string;
  exampleFee: string;
};

export default function PricingPreview({
  pricing,
  isAuthenticated = false,
}: {
  pricing: PricingFacts;
  isAuthenticated?: boolean;
}) {
  const { tr } = usePublicLang();
  const { feePercent, keepPercent, floor, cap, exampleOrder, exampleFee } = pricing;

  const starterPoints = [
    tr("Votre catalogue, votre lien et votre QR code", "Your catalog, your link and your QR code"),
    tr("Le bot répond aux prix jour et nuit", "The bot answers price checks day and night"),
    tr("Commandes, clients, bilan de 18h", "Orders, customers, the 6 PM summary"),
    tr("Votre boutique sur le Marketplace", "Your shop listed on the Marketplace"),
  ];

  const proPoints = [
    tr("Tout ce qui est dans Starter", "Everything in Starter"),
    tr("Paiement dans la conversation — T-Money, Flooz, Wave", "Payment inside the chat — T-Money, Flooz, Wave"),
    tr("Frais de Mobile Money déjà compris", "Mobile Money processing already included"),
    tr("Badge boutique vérifiée", "Verified-shop badge"),
  ];

  return (
    <section className="mb-20" id="pricing" data-reveal-group>
      <div className="mx-auto mb-9 max-w-2xl text-center" data-reveal="up">
        <span className="a-eyebrow">{tr("Tarifs", "Pricing")}</span>
        <h2 className="a-headline-lg mt-2 text-arctic-900">
          {tr("Gratuit jusqu'à votre première vente.", "Free until you sell.")}
        </h2>
        <p className="a-body-md mt-2.5 text-arctic-700">
          {tr(
            "Pas d'abonnement, pas de carte bancaire. Vous ne payez que sur une commande encaissée par Japora.",
            "No subscription, no card to start. You pay only on an order Japora collects."
          )}
        </p>
      </div>

      <div className="mx-auto grid max-w-4xl gap-5 sm:grid-cols-2">
        {/* Starter — the honest free tier. */}
        <div className="card lift flex flex-col p-6" data-reveal="up">
          <div className="a-eyebrow">Starter</div>
          <div className="mt-3 border-b border-brand/35 pb-2">
            <span
              className="a-num font-display text-5xl font-bold leading-none text-arctic-900"
              data-count="0"
              data-count-suffix="%"
            >
              0%
            </span>
          </div>
          <p className="a-body-sm mt-3 text-arctic-700">
            {tr(
              "Vos clients vous paient directement sur votre propre T-Money ou Flooz. Japora ne prend rien.",
              "Your customers pay you directly on your own T-Money or Flooz. Japora takes nothing."
            )}
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {starterPoints.map((f) => (
              <li key={f} className="flex items-start gap-2.5 a-body-md text-arctic-800">
                <SaasIcon name="check" size={15} className="mt-0.5 shrink-0 text-brand-dark" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={isAuthenticated ? "/dashboard" : "/signup"}
            className="btn-ghost mt-6 w-full justify-center"
          >
            {isAuthenticated
              ? tr("Ouvrir mon tableau de bord", "Open my dashboard")
              : tr("Commencer gratuitement", "Start free")}
          </Link>
        </div>

        {/* Pay-as-you-sell — the recommended path. One primary CTA on the section. */}
        <div
          className="glass glass-edge lift relative flex flex-col overflow-hidden rounded-shape-lg p-6"
          data-reveal="up"
        >
          {/* In flow, not absolutely placed: at 375px the badge sat on top of
              the tier label. A ribbon is not worth an overlap. */}
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
            <div className="a-eyebrow">
              {tr("Payez quand vous vendez", "Pay as you sell")}
            </div>
            <span className="a-eyebrow rounded-full bg-brand/12 px-2.5 py-1">
              {tr("Recommandé", "Recommended")}
            </span>
          </div>
          <div className="mt-3 border-b border-brand/35 pb-2">
            <span className="a-num font-display text-5xl font-bold leading-none text-arctic-900">
              {tr("Vous gardez ", "You keep ")}
              <span data-count={keepPercent} data-count-suffix="%">
                {keepPercent}%
              </span>
            </span>
          </div>
          <p className="a-body-sm mt-3 text-arctic-700">
            {tr(
              `Encaissez dans la conversation. La commission tout compris de Japora est de ${feePercent}% — les frais Mobile Money sont dedans.`,
              `Take payment inside the chat. Japora's all-in fee is ${feePercent}% — the Mobile Money charge is already in it.`
            )}
          </p>
          <ul className="mt-5 flex-1 space-y-2.5">
            {proPoints.map((f) => (
              <li key={f} className="flex items-start gap-2.5 a-body-md text-arctic-800">
                <SaasIcon name="check" size={15} className="mt-0.5 shrink-0 text-brand-dark" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={isAuthenticated ? "/dashboard/billing" : "/signup"}
            className="a-btn a-btn--cafe sheen mt-6 w-full justify-center font-bold"
          >
            {isAuthenticated
              ? tr("Gérer ma facturation", "Manage billing")
              : tr("Ouvrir ma boutique", "Open my shop")}
          </Link>
        </div>
      </div>

      {/* The worked example — the rate, made concrete, plus both guard rails. */}
      <div
        className="mx-auto mt-5 flex max-w-4xl flex-col items-center justify-between gap-3 rounded-shape-lg border border-arctic-300/55 px-5 py-4 sm:flex-row"
        style={{ background: "var(--aurora-surface-dim)" }}
        data-reveal="fade"
      >
        <p className="a-body-md text-center text-arctic-800 sm:text-left">
          {tr("Une vente de ", "A sale of ")}
          <span className="a-num font-semibold text-arctic-900">{exampleOrder}</span>
          {tr(" vous coûte ", " costs you ")}
          <span className="a-num font-semibold text-brand-dark">{exampleFee}</span>
          {tr(". C'est tout.", ". That is all.")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-[12px] text-arctic-700">
          <span className="inline-flex items-center gap-1.5">
            <SaasIcon name="shield-check" size={14} className="text-brand-dark" />
            {tr("Gratuit sous ", "Free under ")}
            <span className="a-num font-semibold text-arctic-900">{floor}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <SaasIcon name="shield-check" size={14} className="text-brand-dark" />
            {tr("Plafonné à ", "Capped at ")}
            <span className="a-num font-semibold text-arctic-900">{cap}</span>
          </span>
        </div>
      </div>
    </section>
  );
}
