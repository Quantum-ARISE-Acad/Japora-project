"use client";

import { useState } from "react";
import Link from "next/link";
import Glyph from "@/components/Glyph";
import { waMeLink } from "@/lib/utils";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * Buyer-facing payment chooser (/pay/[order]).
 * Strictly two clean, working payment methods:
 *  1. FedaPay (T-Money, Flooz, MTN MoMo, Celtiis & Visa/Mastercard) — Live & Sandbox API v1
 *  2. Paiement à la livraison (Cash on delivery)
 */
export default function PayClient({
  orderId,
  amountLabel,
  shopName,
  shopSlug,
  vendorWhatsApp = "",
  fedaEnvironment = "sandbox",
  initialCodSelected = false,
  paymentFailed = false,
}: {
  orderId: string;
  amountLabel: string;
  shopName: string;
  shopSlug: string;
  vendorWhatsApp?: string;
  fedaEnvironment?: "sandbox" | "live";
  initialCodSelected?: boolean;
  paymentFailed?: boolean;
}) {
  const { tr } = usePublicLang();
  const [selectedMethod, setSelectedMethod] = useState<"fedapay" | "cash">(
    initialCodSelected ? "cash" : "fedapay",
  );
  const [apiBusy, setApiBusy] = useState(false);
  const [codBusy, setCodBusy] = useState(false);
  const [codConfirmed, setCodConfirmed] = useState(initialCodSelected);
  const [apiError, setApiError] = useState(
    paymentFailed
      ? "Le paiement FedaPay a été annulé ou refusé. Vous pouvez réessayer ou choisir le paiement à la livraison."
      : "",
  );

  async function payWithFedaPay() {
    setApiBusy(true);
    setApiError("");
    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          provider: "fedapay",
          returnUrl: `${origin}/pay/${orderId}?paid=1`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiError(data.error || "Impossible d'initialiser le paiement FedaPay.");
        setApiBusy(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      setApiError("URL de paiement FedaPay indisponible. Veuillez réessayer.");
      setApiBusy(false);
    } catch {
      setApiError("Erreur réseau lors de la connexion à FedaPay. Veuillez réessayer.");
      setApiBusy(false);
    }
  }

  async function confirmCashOnDelivery() {
    setCodBusy(true);
    setApiError("");
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          provider: "cash",
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setApiError(d.error || "Impossible d'enregistrer le paiement à la livraison.");
        setCodBusy(false);
        return;
      }
      setCodConfirmed(true);
      setCodBusy(false);
    } catch {
      setApiError("Erreur réseau. Veuillez réessayer.");
      setCodBusy(false);
    }
  }

  const shortRef = orderId.slice(0, 8).toUpperCase();
  const waText = `Bonjour ${shopName},\n\nJe confirme ma commande #${shortRef} (${amountLabel}) avec règlement par *Paiement à la livraison*.\n\nMerci de me confirmer la livraison !`;
  const waConfirmLink = vendorWhatsApp ? waMeLink(vendorWhatsApp, waText) : null;

  return (
    <div className="space-y-4 p-5">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-arctic-600">
          {tr("Choisissez votre moyen de paiement", "Choose your payment method")}
        </p>
        <p className="mt-0.5 text-xs text-arctic-600">
          {tr("Deux options simples et sécurisées pour finaliser votre commande #", "Two simple and secure options to complete your order #")}{shortRef}.
        </p>
      </div>

      {apiError && (
        <div className="rounded-shape-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700">
          ⚠️ {apiError}
        </div>
      )}

      {/* Option 1: FedaPay (T-Money, Flooz, MTN MoMo, Celtiis & Carte) */}
      <section
        onClick={() => setSelectedMethod("fedapay")}
        className={`rounded-shape-lg border-2 p-4 transition-all cursor-pointer space-y-3 ${
          selectedMethod === "fedapay"
            ? "border-signal-fill bg-emerald-50/70 shadow-sm"
            : "border-arctic-300/60 bg-white hover:border-arctic-400"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <input
              type="radio"
              name="pay_method"
              checked={selectedMethod === "fedapay"}
              onChange={() => setSelectedMethod("fedapay")}
              className="mt-1 h-4 w-4 text-emerald-600 focus:ring-emerald-500"
            />
            <div>
              <h3 className="text-sm font-extrabold text-arctic-900">
                {tr("💳 FedaPay (T-Money, Flooz, Mobile Money & Carte)", "💳 FedaPay (T-Money, Flooz, Mobile Money & card)")}
              </h3>
              <p className="mt-0.5 text-xs text-arctic-600">
                {tr("Paiement instantané sécurisé par T-Money, Flooz Moov, MTN MoMo, Celtiis ou Carte Visa/Mastercard.", "Instant secure payment by T-Money, Flooz Moov, MTN MoMo, Celtiis or Visa/Mastercard card.")}
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-signal-fill px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {fedaEnvironment === "sandbox" ? "Sandbox" : tr("Instantané", "Instant")}
          </span>
        </div>

        {selectedMethod === "fedapay" && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              payWithFedaPay();
            }}
            disabled={apiBusy}
            className="btn-primary w-full !bg-signal-fill hover:!bg-signal-fill-hover !text-white font-bold shadow-md"
          >
            {apiBusy
              ? tr("Connexion à FedaPay en cours…", "Connecting to FedaPay…")
              : tr(`💳 Payer ${amountLabel} avec FedaPay →`, `💳 Pay ${amountLabel} with FedaPay →`)}
          </button>
        )}
      </section>

      {/* Option 2: Paiement à la livraison */}
      <section
        onClick={() => setSelectedMethod("cash")}
        className={`rounded-shape-lg border-2 p-4 transition-all cursor-pointer space-y-3 ${
          selectedMethod === "cash"
            ? "border-arctic-800 bg-arctic-50 shadow-sm"
            : "border-arctic-300/60 bg-white hover:border-arctic-400"
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2.5">
            <input
              type="radio"
              name="pay_method"
              checked={selectedMethod === "cash"}
              onChange={() => setSelectedMethod("cash")}
              className="mt-1 h-4 w-4 text-arctic-800 focus:ring-arctic-700"
            />
            <div>
              <h3 className="text-sm font-extrabold text-arctic-900">
                {tr("💵 Paiement à la livraison", "💵 Cash on delivery")}
              </h3>
              <p className="mt-0.5 text-xs text-arctic-600">
                {tr("Réglez en espèces ou à la remise en main propre directement lors de la livraison ou du retrait.", "Pay in cash or by hand directly on delivery or pickup.")}
              </p>
            </div>
          </div>
        </div>

        {selectedMethod === "cash" && (
          <div className="space-y-2.5 pt-1" onClick={(e) => e.stopPropagation()}>
            {codConfirmed ? (
              <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 space-y-2">
                <div className="font-bold flex items-center gap-1.5">
                  <span>✅</span> {tr("Paiement à la livraison enregistré !", "Cash on delivery recorded!")}
                </div>
                <p>
                  {tr("Préparez le montant exact de", "Prepare the exact amount of")} <strong>{amountLabel}</strong> {tr("pour la livraison de votre commande #", "for the delivery of your order #")}{shortRef}.
                </p>
                {waConfirmLink && (
                  <a
                    href={waConfirmLink}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary btn-sm w-full !bg-signal-fill hover:!bg-signal-fill-hover !text-white font-bold"
                  >
                    <Glyph name="chat" size={14} /> {tr("Confirmer la livraison sur WhatsApp", "Confirm the delivery on WhatsApp")}
                  </a>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={confirmCashOnDelivery}
                disabled={codBusy}
                className="btn-primary w-full font-bold"
              >
                {codBusy
                  ? tr("Validation en cours…", "Confirming…")
                  : tr(`💵 Confirmer le paiement à la livraison (${amountLabel})`, `💵 Confirm cash on delivery (${amountLabel})`)}
              </button>
            )}
          </div>
        )}
      </section>

      <div className="pt-1 text-center">
        <Link
          href={`/c/${shopSlug}`}
          className="text-xs font-semibold text-arctic-600 hover:text-arctic-900 hover:underline"
        >
          {tr("← Retourner sur la boutique", "← Back to the shop")} {shopName}
        </Link>
      </div>
    </div>
  );
}
