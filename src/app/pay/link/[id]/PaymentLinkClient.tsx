"use client";

import { useState } from "react";
import Link from "next/link";
import { formatMoney, waMeLink } from "@/lib/utils";
import VerifiedBadge from "@/components/VerifiedBadge";

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
  amountCents,
  currency,
  description,
  isPaid,
  isExpired,
  vendor,
}: PaymentLinkClientProps) {
  const [copied, setCopied] = useState(false);
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
            <p className="text-xs text-emerald-100">Lien de paiement sécurisé</p>
          </div>

          <div className="p-6 space-y-6">
            {/* Status badges */}
            {isPaid ? (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-1">
                <span className="text-3xl">✅</span>
                <h2 className="text-base font-bold text-emerald-800 dark:text-emerald-200">
                  Paiement Déjà Confirmé
                </h2>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">
                  Ce montant de {formattedAmount} a bien été réglé. Merci pour votre confiance !
                </p>
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
                    <div className="mt-2 inline-block px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300">
                      {description}
                    </div>
                  )}
                </div>

                {/* Mobile Money Payee Info */}
                {payeePhone && (
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Numéro Mobile Money (T-Money / Flooz)
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

                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                      Effectuez le transfert Mobile Money vers ce numéro, puis cliquez ci-dessous pour confirmer au vendeur.
                    </p>
                  </div>
                )}

                {/* WEscrow Escrow Guarantee */}
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-indigo-900 dark:text-indigo-300 flex items-center gap-1.5">
                      <span>🛡️</span> Paiement Protégé WEscrow
                    </span>
                    <span className="text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                      Safe Hands
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400">
                    Vos fonds restent sous séquestre jusqu&apos;à réception de votre commande.
                  </p>
                  <a
                    href={`http://localhost:3000/deals/new?title=${encodeURIComponent(description || `Paiement pour ${vendor.shopName}`)}&amount=${encodeURIComponent((amountCents / 100).toFixed(0))}&sellerName=${encodeURIComponent(vendor.shopName)}&sellerPhone=${encodeURIComponent(payeePhone || '')}&source=japora`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                  >
                    <span>🛡️ Payer sous Séquestre avec WEscrow</span>
                  </a>
                </div>

                {/* Action: WhatsApp confirmation */}
                <div className="space-y-2 pt-2">
                  <a
                    href={waConfirmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 transition-all hover:shadow-xl"
                  >
                    <span>💬</span>
                    <span>J&apos;ai payé — Confirmer sur WhatsApp</span>
                  </a>

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
        Propulsé en toute sécurité par Japora · Commerce sans friction
      </footer>
    </div>
  );
}
