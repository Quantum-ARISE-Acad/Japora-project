"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney, waMeLink } from "@/lib/utils";
import VerifiedBadge from "@/components/VerifiedBadge";
import { telHref } from "@/lib/payments/ussd";

const DIAL_BUTTONS = [
  { label: "T-Money", dial: "*145#" },
  { label: "Flooz", dial: "*155#" },
];

interface PaymentLinkClientProps {
  id: string;
  amountCents: number;
  currency: string;
  description: string;
  isPaid: boolean;
  isExpired: boolean;
  createdAt: string;
  vendor: {
    id: string;
    shopName: string;
    shopSlug: string;
    avatarUrl: string;
    whatsappNumber: string;
    momoNumber: string;
    currency: string;
    verifiedAt: string | null;
  };
}

export default function PaymentLinkClient({
  id,
  amountCents,
  currency,
  description,
  isPaid,
  isExpired,
  vendor,
}: PaymentLinkClientProps) {
  const [copied, setCopied] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [selectedNetwork, setSelectedNetwork] = useState("T-Money Togo");
  const [fedaLoading, setFedaLoading] = useState(false);
  const [fedaError, setFedaError] = useState("");

  const payeePhone = vendor.momoNumber || vendor.whatsappNumber;

  async function copyNumber() {
    if (!payeePhone) return;
    try {
      await navigator.clipboard.writeText(payeePhone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  async function startFedaPayCheckout() {
    setFedaLoading(true);
    setFedaError("");
    try {
      const res = await fetch("/api/payments/fedapay/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "initiate_link",
          paymentLinkId: id,
          customerName: customerName.trim() || "Client",
          customerPhone: customerPhone.trim(),
          network: selectedNetwork,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutUrl) {
        setFedaLoading(false);
        setFedaError(data.error || "Impossible d'initialiser le paiement FedaPay.");
        return;
      }
      window.location.href = data.checkoutUrl;
    } catch {
      setFedaLoading(false);
      setFedaError("Erreur réseau lors de la connexion à FedaPay.");
    }
  }

  const formattedAmount = formatMoney(amountCents, currency);
  const waConfirmText = `Bonjour ${vendor.shopName}, je viens d'effectuer le paiement de ${formattedAmount}${
    description ? ` pour : "${description}"` : ""
  }. Pouvez-vous confirmer la réception s'il vous plaît ? Merci !`;

  const waConfirmUrl = payeePhone ? waMeLink(payeePhone, waConfirmText) : "#";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex flex-col justify-between p-4 sm:p-6">
      <div className="mx-auto w-full max-w-md my-auto">
        {/* Brand Card */}
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-200/50 dark:shadow-none">
          {/* Header Banner */}
          <div className="bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white text-center relative">
            <Link
              href={`/c/${vendor.shopSlug}`}
              className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity mb-2"
            >
              {vendor.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={vendor.avatarUrl}
                  alt={vendor.shopName}
                  className="w-10 h-10 rounded-full object-cover border-2 border-white/40 shadow"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-white/20 border-2 border-white/40 grid place-items-center font-bold text-white shadow">
                  {vendor.shopName.slice(0, 1)}
                </div>
              )}
              <span className="font-bold text-lg">{vendor.shopName}</span>
              {vendor.verifiedAt && <VerifiedBadge />}
            </Link>
            <p className="text-xs text-emerald-100">Lien de paiement sécurisé Japora × FedaPay</p>
          </div>

          <div className="p-6 space-y-5">
            {/* Status badges */}
            {isPaid ? (
              <div className="p-5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-2">
                <span className="text-4xl block">✅</span>
                <h2 className="text-base font-bold text-emerald-800 dark:text-emerald-200">
                  Paiement Confirmé !
                </h2>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Ce montant de <strong>{formattedAmount}</strong> a bien été réglé. Merci pour votre confiance !
                </p>
                <div className="pt-2">
                  <Link
                    href={`/c/${vendor.shopSlug}`}
                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    Retourner sur la boutique {vendor.shopName} →
                  </Link>
                </div>
              </div>
            ) : isExpired ? (
              <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-1">
                <span className="text-3xl">⏳</span>
                <h2 className="text-base font-bold text-rose-800 dark:text-rose-200">
                  Lien Expiré
                </h2>
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  Ce lien de paiement n&apos;est plus valide. Veuillez contacter le vendeur.
                </p>
              </div>
            ) : (
              <>
                {/* Amount Display */}
                <div className="text-center py-2 border-b border-slate-100 dark:border-slate-800">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Montant à payer
                  </span>
                  <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-1">
                    {formattedAmount}
                  </div>
                  {description && (
                    <div className="mt-2 inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                      {description}
                    </div>
                  )}
                </div>

                {/* Primary Online Payment: FedaPay Checkout */}
                <div className="rounded-2xl border-2 border-emerald-500/80 bg-emerald-50/50 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <span>⚡</span> Payer en ligne avec FedaPay
                    </span>
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                      Paiement Sécurisé
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600">
                    Réglez instantanément par <strong>T-Money</strong>, <strong>Flooz Moov</strong>,{" "}
                    <strong>MTN MoMo</strong> ou <strong>Carte Bancaire</strong> et recevez votre reçu sur WhatsApp.
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Votre nom"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-emerald-600 focus:outline-none"
                    />
                    <input
                      type="tel"
                      placeholder="WhatsApp (+228...)"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-mono focus:border-emerald-600 focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {["T-Money Togo", "Flooz Moov", "MTN Mobile Money", "Carte Visa / Mastercard"].map(
                      (net) => (
                        <button
                          key={net}
                          type="button"
                          onClick={() => setSelectedNetwork(net)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
                            selectedNetwork === net
                              ? "bg-emerald-700 text-white"
                              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {net}
                        </button>
                      ),
                    )}
                  </div>

                  {fedaError && (
                    <p className="text-xs text-rose-600 font-medium">{fedaError}</p>
                  )}

                  <button
                    type="button"
                    disabled={fedaLoading}
                    onClick={startFedaPayCheckout}
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50"
                  >
                    <span>💳</span>
                    <span>
                      {fedaLoading
                        ? "Ouverture de FedaPay…"
                        : `Payer ${formattedAmount} avec FedaPay`}
                    </span>
                  </button>
                </div>

                {/* Direct Mobile Money Payee Info */}
                {payeePhone && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Ou transfert Mobile Money direct
                      </span>
                      <button
                        type="button"
                        onClick={copyNumber}
                        className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold hover:underline"
                      >
                        {copied ? "Copié !" : "Copier"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between font-mono font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-sm">
                      <span>{payeePhone}</span>
                      <span className="text-xs font-sans text-slate-400">Direct</span>
                    </div>

                    {/* Direct USSD dial: opens the phone's dialer with the wallet code. */}
                    <div className="grid grid-cols-2 gap-2">
                      {DIAL_BUTTONS.map((b) => (
                        <a
                          key={b.dial}
                          href={telHref(b.dial)}
                          className="min-h-[44px] rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-2 py-2 text-center text-xs font-semibold text-slate-800 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 flex flex-col items-center justify-center"
                        >
                          <span>Appeler {b.label}</span>
                          <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">{b.dial}</span>
                        </a>
                      ))}
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Composez le code, choisissez « Transfert », puis envoyez {formattedAmount} au numéro ci-dessus.
                    </p>
                  </div>
                )}

                {/* Action: WhatsApp confirmation */}
                <div className="space-y-2 pt-1">
                  {payeePhone && (
                    <a
                      href={waConfirmUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-2.5 px-4 rounded-xl border border-emerald-600 text-emerald-700 hover:bg-emerald-50 font-semibold text-xs flex items-center justify-center gap-2 transition-all"
                    >
                      <span>💬</span>
                      <span>J&apos;ai fait un transfert direct — Confirmer sur WhatsApp</span>
                    </a>
                  )}

                  <Link
                    href={`/c/${vendor.shopSlug}`}
                    className="w-full py-2 px-4 rounded-xl text-xs text-center text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 block transition-colors"
                  >
                    Visiter la boutique {vendor.shopName}
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <footer className="text-center text-xs text-slate-400 py-4">
        Propulsé en toute sécurité par Japora × FedaPay
      </footer>
    </div>
  );
}
