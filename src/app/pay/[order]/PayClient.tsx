"use client";

import { useState } from "react";
import Glyph from "@/components/Glyph";
import type { UssdInstructions } from "@/lib/payments/ussd";
import type { PaymentProviderName } from "@/lib/payments";
import { waMeLink } from "@/lib/utils";

/**
 * Buyer-facing payment chooser. USSD (dial-code) leads as the quick/default
 * method; the hosted provider API is offered underneath as "pay automatically"
 * only when `apiProvider` is set (a configured rail). USSD is vendor-direct, so
 * after paying the buyer taps "I've paid" to nudge the vendor to confirm.
 */
export default function PayClient({
  orderId,
  amountLabel,
  ussd,
  apiProvider,
  apiLabel,
  shopName,
  vendorWhatsApp = "",
}: {
  orderId: string;
  currency: string;
  amountLabel: string;
  ussd: UssdInstructions;
  apiProvider: PaymentProviderName | null;
  apiLabel: string | null;
  shopName: string;
  vendorWhatsApp?: string;
}) {
  const hasPayee = ussd.payeeNumber.trim().length > 0;
  const hasUssd = ussd.networks.length > 0 && hasPayee;
  const [active, setActive] = useState(ussd.networks[0]?.network.id ?? "");
  const [copied, setCopied] = useState(false);
  const [copiedAmount, setCopiedAmount] = useState(false);
  const [apiBusy, setApiBusy] = useState(false);
  const [apiError, setApiError] = useState("");
  const [showSteps, setShowSteps] = useState(true);

  const current = ussd.networks.find((n) => n.network.id === active) ?? ussd.networks[0];

  async function copyNumber() {
    try {
      await navigator.clipboard.writeText(ussd.payeeNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the number is on screen anyway */
    }
  }

  async function copyAmount() {
    try {
      await navigator.clipboard.writeText(String(ussd.amountMajor));
      setCopiedAmount(true);
      setTimeout(() => setCopiedAmount(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  }

  async function payAutomatically() {
    if (!apiProvider) return;
    setApiBusy(true);
    setApiError("");
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          provider: apiProvider,
          returnUrl: typeof window !== "undefined" ? window.location.href : undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setApiError(data.error || "Could not start the payment. Try the dial code above.");
        setApiBusy(false);
        return;
      }
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
        return;
      }
      // Push-flow rails with no redirect: tell the buyer to approve on their phone.
      setApiError("Check your phone — approve the payment prompt to finish.");
      setApiBusy(false);
    } catch {
      setApiError("Network error. Try the dial code above.");
      setApiBusy(false);
    }
  }

  const notifyWaText = `Bonjour ${shopName},\n\nJ'ai effectué le paiement de ${amountLabel} pour la commande #${orderId.slice(0, 8)} via ${current?.network.label || "USSD"} (${current?.dial || ""}).\n\nNuméro marchand : ${ussd.payeeNumber}\nPouvez-vous confirmer la réception ? Merci !`;
  const notifyLink = vendorWhatsApp ? waMeLink(vendorWhatsApp, notifyWaText) : null;

  return (
    <div className="space-y-5 p-5">
      {/* FedaPay Online Checkout — Top Priority */}
      {apiProvider && (
        <section className="rounded-shape-lg border-2 border-emerald-500/80 bg-emerald-50/60 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-600 text-white text-sm font-bold shadow-xs">
                💳
              </span>
              <div>
                <h3 className="text-sm font-extrabold text-arctic-900">
                  Paiement en ligne sécurisé FedaPay
                </h3>
                <p className="text-[11px] text-arctic-600">
                  T-Money, Flooz Moov, MTN Mobile Money, Celtiis & Carte Visa/Mastercard
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
              ⚡ Instantané
            </span>
          </div>

          <button
            type="button"
            onClick={payAutomatically}
            disabled={apiBusy}
            className="btn-primary w-full justify-center gap-2 !bg-emerald-600 hover:!bg-emerald-700 !text-white py-3 text-sm font-bold shadow-md"
          >
            {apiBusy
              ? "Ouverture de FedaPay en cours…"
              : `💳 Payer ${amountLabel} avec ${apiLabel || "FedaPay"}`}
          </button>

          {apiError && (
            <p className="rounded-shape-sm bg-red-500/10 px-3 py-2 text-center a-body-sm text-red-600">
              {apiError}
            </p>
          )}
        </section>
      )}

      {hasUssd ? (
        <section>
          <div className="flex items-center justify-between">
            <p className="a-eyebrow">Paiement Mobile Money USSD</p>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              ⚡ Immédiat & sans connexion
            </span>
          </div>
          <p className="mt-1 a-body-sm text-arctic-600">
            Fonctionne sur tout téléphone sans application ni connexion internet. Choisissez votre réseau :
          </p>

          {/* Wallet tabs */}
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
            {ussd.networks.map((n) => {
              const on = n.network.id === current?.network.id;
              const isTogo = n.network.id === "tmoney" || n.network.id === "flooz";
              return (
                <button
                  key={n.network.id}
                  type="button"
                  onClick={() => setActive(n.network.id)}
                  aria-pressed={on}
                  className={
                    "min-h-[48px] rounded-shape-md border p-2 text-left transition-all flex flex-col justify-center " +
                    (on
                      ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-100 shadow-sm ring-1 ring-emerald-600"
                      : "border-arctic-400/30 bg-white dark:bg-arctic-900 text-arctic-700 hover:border-arctic-400/70")
                  }
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{n.network.icon || "📱"} {n.network.label}</span>
                    {isTogo && (
                      <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200/60 dark:bg-amber-900/50 text-amber-900 dark:text-amber-200 font-semibold">
                        Togo
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] font-mono text-arctic-500">{n.dial}</span>
                </button>
              );
            })}
          </div>

          {current && (
            <div className="mt-3 rounded-shape-lg border border-arctic-400/30 bg-arctic-50 dark:bg-arctic-900/60 p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-arctic-300/40">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{current.network.icon || "📱"}</span>
                  <div>
                    <h3 className="text-sm font-bold text-arctic-900 dark:text-white">
                      {current.network.label} ({current.network.operator})
                    </h3>
                    <p className="text-[11px] text-arctic-500 font-mono">Code USSD : {current.dial}</p>
                  </div>
                </div>
                <span className="rounded-full px-2 py-0.5 text-[10px] font-bold bg-arctic-200/60 text-arctic-800 dark:bg-arctic-800 dark:text-arctic-200">
                  {current.network.dial}
                </span>
              </div>

              {/* The payee + amount, the two things they'll type */}
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-arctic-500">Numéro marchand / Vendeur</dt>
                  <dd className="flex items-center gap-2">
                    <span className="a-num font-bold text-base text-arctic-900 dark:text-white">{ussd.payeeNumber}</span>
                    <button
                      type="button"
                      onClick={copyNumber}
                      className="inline-flex h-8 items-center gap-1 rounded-shape-sm border border-arctic-400/40 px-2 text-xs font-semibold text-arctic-700 bg-white dark:bg-arctic-800 hover:text-arctic-900"
                      aria-label="Copier le numéro du marchand"
                    >
                      <Glyph name={copied ? "check" : "copy"} size={13} />
                      {copied ? "Copié !" : "Copier"}
                    </button>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 border-t border-arctic-400/30 pt-2.5">
                  <dt className="text-arctic-500">Montant à transférer</dt>
                  <dd className="flex items-center gap-2">
                    <span className="a-num font-bold text-base text-emerald-600 dark:text-emerald-400">{amountLabel}</span>
                    <button
                      type="button"
                      onClick={copyAmount}
                      className="inline-flex h-8 items-center gap-1 rounded-shape-sm border border-arctic-400/40 px-2 text-xs font-semibold text-arctic-700 bg-white dark:bg-arctic-800 hover:text-arctic-900"
                      aria-label="Copier le montant"
                    >
                      <Glyph name={copiedAmount ? "check" : "copy"} size={13} />
                      {copiedAmount ? "Copié !" : "Copier"}
                    </button>
                  </dd>
                </div>
              </dl>

              {/* Steps Accordion */}
              <div className="mt-3.5 border-t border-arctic-300/40 pt-2.5">
                <button
                  type="button"
                  onClick={() => setShowSteps(!showSteps)}
                  className="flex w-full items-center justify-between py-1 text-xs font-semibold text-arctic-700 hover:text-arctic-900"
                >
                  <span>Instructions pas à pas ({current.network.label})</span>
                  <span>{showSteps ? "▲" : "▼"}</span>
                </button>

                {showSteps && (
                  <ol className="mt-2.5 space-y-2">
                    {(current.frenchSteps || current.steps).map((s, i) => (
                      <li key={i} className="flex gap-2.5 a-body-sm text-arctic-700 dark:text-arctic-300">
                        <span className="a-num mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              {/* Dial Buttons */}
              <div className="mt-4 space-y-2">
                {current.directTelHref && (
                  <a
                    href={current.directTelHref}
                    className="btn-primary w-full justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5"
                  >
                    <Glyph name="phone" size={16} /> Composer le code direct ({current.directDial})
                  </a>
                )}
                <a
                  href={current.telHref}
                  className="btn-ghost w-full justify-center gap-2 border border-arctic-400/50 bg-white dark:bg-arctic-800 hover:bg-arctic-100 font-medium py-2"
                >
                  <Glyph name="phone" size={15} /> Composer le menu USSD standard ({current.dial})
                </a>
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-shape-lg border border-arctic-400/30 bg-arctic-50 p-4">
          <p className="a-body-sm text-arctic-600">
            {shopName} n&apos;a pas encore renseigné de numéro Mobile Money.
            {apiProvider ? " Utilisez l'option automatique ci-dessous." : " Veuillez contacter la boutique sur WhatsApp pour régler votre commande."}
          </p>
        </section>
      )}

      {/* "I've paid" / WhatsApp Order notification button */}
      {notifyLink && (
        <section className="rounded-shape-lg border border-emerald-500/30 bg-emerald-500/10 p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-emerald-700 dark:text-emerald-400 font-bold text-sm">
              💬 Envoi & Confirmation WhatsApp
            </span>
          </div>
          <p className="text-xs text-emerald-900 dark:text-emerald-200 mb-3 leading-relaxed">
            Une fois votre virement effectué ou pour confirmer votre commande en direct, envoyez les détails au commerçant sur WhatsApp :
          </p>
          <a
            href={notifyLink}
            target="_blank"
            rel="noreferrer"
            className="btn-primary w-full justify-center gap-2 !bg-emerald-600 hover:!bg-emerald-700 !text-white shadow-md shadow-emerald-600/20 py-2.5"
          >
            <Glyph name="chat" size={16} /> Envoyer le reçu sur WhatsApp
          </a>
        </section>
      )}

      {/* WEscrow Escrow Option */}
      <section className="rounded-shape-lg border border-indigo-200/80 bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-indigo-500/10 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-600 text-white text-xs font-bold shadow-sm">
              🛡️
            </span>
            <div>
              <p className="text-sm font-semibold text-arctic-900">Paiement Garanti WEscrow</p>
              <p className="text-[11px] text-arctic-600">Fonds sous séquestre jusqu&apos;à livraison confirmée</p>
            </div>
          </div>
          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
            Safe Hands
          </span>
        </div>

        <p className="mt-2 text-xs text-arctic-600 leading-relaxed">
          Vous préférez être livré avant de payer le vendeur ? Bloquez votre paiement sur WEscrow. Le vendeur n&apos;est crédité que lorsque vous confirmez la bonne réception.
        </p>

        <a
          href={`http://localhost:3000/deals/new?title=${encodeURIComponent(`Commande #${orderId.slice(0, 8)} chez ${shopName}`)}&amount=${encodeURIComponent(amountLabel.replace(/[^0-9.]/g, ""))}&sellerName=${encodeURIComponent(shopName)}&sellerPhone=${encodeURIComponent(vendorWhatsApp)}&ref=${encodeURIComponent(orderId.slice(0, 8))}&source=japora`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary mt-3 w-full justify-center gap-2 !bg-indigo-600 hover:!bg-indigo-700 !text-white shadow-md shadow-indigo-600/20"
        >
          🛡️ Payer sous séquestre avec WEscrow
        </a>
      </section>

      {/* Vendor-direct settle nudge */}
      {hasUssd && (
        <p className="text-center a-label-md text-arctic-500 text-xs">
          Après avoir composé le code USSD, le vendeur vérifie la réception des fonds et passe votre commande en statut payé.
        </p>
      )}
    </div>
  );
}
