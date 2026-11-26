"use client";

import type { FedaJson } from "@/lib/payments/fedapay";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import { convertCurrency, providerMajorAmount } from "@/lib/currency";
import { usePublicLang } from "@/components/PublicLanguageProvider";

declare global {
  interface Window {
    FedaPay?: {
      init: (options: FedaJson) => { open: () => void };
      CHECKOUT_COMPLETED?: number;
      DIALOG_DISMISSED?: number;
    };
  }
}

const WALLETS = [
  {
    id: "T-Money Togo",
    name: "T-Money (Togocom / Yas)",
    country: "Togo",
    badge: "Instantané",
    testPhone: "+22890000001",
  },
  {
    id: "Flooz Moov",
    name: "Flooz (Moov Africa)",
    country: "Togo / Bénin",
    badge: "Instantané",
    testPhone: "+22896000001",
  },
  {
    id: "MTN Mobile Money",
    name: "MTN Mobile Money",
    country: "Bénin / Côte d'Ivoire",
    badge: "Mobile Money",
    testPhone: "+22997000001",
  },
  {
    id: "Celtiis / Orange Money",
    name: "Celtiis Cash / Orange Money",
    country: "Bénin / Sénégal / Côte d'Ivoire",
    badge: "Mobile Money",
    testPhone: "+22940000001",
  },
  {
    id: "Carte Visa / Mastercard",
    name: "Carte Bancaire (Visa / Mastercard)",
    country: "International",
    badge: "3D Secure",
    testPhone: "",
  },
];

export default function FedaPaySandboxClient({
  providerRef,
  amountCents,
  currency,
  initialStatus,
  fedaPublicKey,
  fedaEnvironment,
  shopName,
  shopLogo,
  title,
  defaultCustomerName,
  defaultCustomerPhone,
  defaultWallet,
  returnUrl,
  cancelUrl,
}: {
  providerRef: string;
  amountCents: number;
  currency: string;
  initialStatus: string;
  fedaPublicKey: string;
  fedaEnvironment: "sandbox" | "live";
  shopName: string;
  shopSlug: string;
  shopLogo: string;
  title: string;
  defaultCustomerName: string;
  defaultCustomerPhone: string;
  defaultWallet: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const { tr } = usePublicLang();
  const router = useRouter();
  const [selectedWallet, setSelectedWallet] = useState(
    WALLETS.find((w) => w.id.toLowerCase().includes(defaultWallet.toLowerCase()))?.id ||
      WALLETS[0].id,
  );
  const [customerName, setCustomerName] = useState(
    defaultCustomerName && defaultCustomerName !== "Guest" ? defaultCustomerName : "Client Japora",
  );
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone || "+22890000001");
  const [sdkReady, setSdkReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [doneStatus, setDoneStatus] = useState<string | null>(
    initialStatus === "succeeded" ? "succeeded" : null,
  );
  const [error, setError] = useState("");

  const hasRealPublicKey =
    Boolean(fedaPublicKey) &&
    (fedaPublicKey.startsWith("pk_live_") || fedaPublicKey.startsWith("pk_sandbox_")) &&
    !fedaPublicKey.includes("japora_demo");

  const xofCents =
    currency.toUpperCase() === "XOF"
      ? amountCents
      : convertCurrency(amountCents, currency, "XOF");
  const amountXof = Math.max(100, providerMajorAmount(xofCents, { multipleOf: 5 }));

  useEffect(() => {
    if (typeof window !== "undefined" && window.FedaPay) {
      setSdkReady(true);
    }
  }, []);

  async function handleComplete(
    outcome: "succeeded" | "failed",
    fedaTxId?: string,
    walletOverride?: string,
  ) {
    setProcessing(true);
    setError("");

    try {
      const res = await fetch("/api/payments/fedapay/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          providerRef,
          fedaTxId,
          outcome,
          wallet: walletOverride || selectedWallet,
          customerName: customerName.trim() || "Client",
          customerPhone: customerPhone.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProcessing(false);
        setError(data.error || tr("Erreur lors de la validation du paiement.", "Error while confirming the payment."));
        return;
      }

      setDoneStatus(outcome);
      setTimeout(() => {
        router.push(data.redirectUrl || returnUrl);
        router.refresh();
      }, 1000);
    } catch {
      setProcessing(false);
      setError(tr("Erreur réseau lors de la communication avec le serveur.", "Network error while talking to the server."));
    }
  }

  function openOfficialFedaPayWidget() {
    if (!hasRealPublicKey) {
      setError(tr("Aucune clé publique FedaPay (pk_live_... ou pk_sandbox_...) n'est configurée.", "No FedaPay public key (pk_live_... or pk_sandbox_...) is set."));
      return;
    }
    if (typeof window === "undefined" || !window.FedaPay) {
      setError(tr("Chargement du widget officiel FedaPay en cours, veuillez réessayer dans une seconde.", "The official FedaPay widget is loading, please try again in a second."));
      return;
    }

    setError("");
    setProcessing(true);

    const [firstName, ...rest] = (customerName || "Client Japora").trim().split(/\s+/);
    const lastName = rest.join(" ") || "Japora";
    const safeSlug = providerRef.replace(/[^a-zA-Z0-9]/g, "").slice(-10).toLowerCase() || "client";

    try {
      const widget = window.FedaPay.init({
        public_key: fedaPublicKey,
        environment: fedaEnvironment,
        transaction: {
          amount: Math.round(amountXof),
          description: `${shopName} — ${title} (${providerRef})`,
          custom_metadata: {
            reference: providerRef,
            shopName,
          },
        },
        customer: {
          firstname: firstName || "Client",
          lastname: lastName || "Japora",
          email: `client.${safeSlug}@japora.com`,
        },
        onComplete: (resp: FedaJson) => {
          const tx = resp?.transaction || {};
          const txStatus = String(tx.status || "").toLowerCase();
          const completedReason = window.FedaPay?.CHECKOUT_COMPLETED;

          if (
            resp?.reason === completedReason ||
            txStatus === "approved" ||
            txStatus === "transferred"
          ) {
            handleComplete(
              "succeeded",
              tx.id ? String(tx.id) : undefined,
              tx.mode || selectedWallet,
            );
          } else if (txStatus === "declined" || txStatus === "canceled") {
            setProcessing(false);
            setError(tr("Le paiement a été refusé ou annulé sur FedaPay.", "The payment was refused or cancelled on FedaPay."));
          } else {
            setProcessing(false);
          }
        },
      });

      widget.open();
    } catch (e) {
      setProcessing(false);
      setError(
        e instanceof Error
          ? e.message
          : tr("Impossible d'ouvrir le widget FedaPay. Vérifiez votre clé publique.", "Could not open the FedaPay widget. Check your public key."),
      );
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 flex flex-col justify-between py-8 px-4">
      {/* Official FedaPay Checkout.js SDK */}
      {hasRealPublicKey && (
        <Script
          src="https://cdn.fedapay.com/checkout.js?v=1.1.7"
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
        />
      )}

      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Top FedaPay Status Banner */}
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/80 px-4 py-2.5 text-emerald-200 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">
              FedaPay {fedaEnvironment === "live" ? tr("Live · Paiement Réel", "Live · Real payment") : tr("Sandbox · Mode Test", "Sandbox · Test mode")}
            </span>
          </div>
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
            API v1 {hasRealPublicKey ? tr("Connectée", "Connected") : tr("Démo", "Demo")}
          </span>
        </div>

        {/* Main Checkout Card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200">
          {/* Merchant Header */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-6 text-white">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {shopLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={shopLogo}
                    alt={shopName}
                    className="h-11 w-11 rounded-xl object-cover border border-white/20 bg-white"
                  />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500 text-lg font-extrabold text-white">
                    {shopName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs text-emerald-300 font-medium">{tr("Paiement sécurisé pour", "Secure payment for")}</div>
                  <h1 className="font-bold text-base truncate">{shopName}</h1>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-mono text-slate-300">
                  {providerRef}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-white/15 flex items-baseline justify-between">
              <div>
                <div className="text-xs text-slate-300">{title}</div>
                <div className="text-2xl font-extrabold tracking-tight text-white mt-0.5">
                  {formatMoney(amountCents, currency)}
                </div>
                {currency.toUpperCase() !== "XOF" && (
                  <div className="text-xs text-emerald-300 mt-0.5">
                    ≈ {formatMoney(xofCents, "XOF")} ({amountXof} FCFA FedaPay)
                  </div>
                )}
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                  🔒 FedaPay Checkout
                </span>
              </div>
            </div>
          </div>

          {doneStatus === "succeeded" ? (
            <div className="p-8 text-center space-y-4">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-100 text-3xl text-emerald-700">
                ✓
              </div>
              <h2 className="text-xl font-bold text-slate-900">
                {tr("Paiement confirmé avec succès !", "Payment confirmed!")}
              </h2>
              <p className="text-sm text-slate-600">
                {tr("Votre règlement de", "Your payment of")} <strong>{formatMoney(amountCents, currency)}</strong> via{" "}
                <strong>{selectedWallet}</strong> {tr("a été validé par FedaPay.", "was confirmed by FedaPay.")}
              </p>
              <p className="text-xs text-emerald-700 font-medium">
                {tr("Redirection automatique vers la boutique en cours…", "Redirecting to the shop…")}
              </p>
              <div className="pt-2">
                <Link
                  href={returnUrl}
                  className="inline-flex items-center justify-center rounded-xl bg-signal-fill px-5 py-2.5 text-sm font-bold text-white hover:bg-signal-fill-hover"
                >
                  {tr("Continuer maintenant →", "Continue now →")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Customer Info */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  1. Vos coordonnées client
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {tr("Nom complet", "Full name")}
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-signal-fill focus:outline-none"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={tr("Votre nom", "Your name")}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      {tr("Numéro WhatsApp / Mobile Money", "WhatsApp / Mobile Money number")}
                    </label>
                    <input
                      type="tel"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-signal-fill focus:outline-none"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+22890000001"
                    />
                  </div>
                </div>
              </div>

              {/* Official FedaPay Live / Sandbox Checkout.js Button */}
              {hasRealPublicKey && (
                <div className="rounded-2xl border-2 border-signal-fill bg-emerald-50/70 p-4 space-y-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <span>⚡</span> {tr("Passerelle Officielle FedaPay (", "Official FedaPay gateway (")}{fedaEnvironment.toUpperCase()})
                    </span>
                    <span className="rounded-full bg-signal-fill px-2 py-0.5 text-[10px] font-bold text-white">
                      {sdkReady ? tr("Prêt", "Ready") : tr("Chargement…", "Loading…")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-700">
                    {tr("Ouvrez le guichet officiel FedaPay pour payer", "Open the official FedaPay counter to pay")} <strong>{amountXof} FCFA</strong> {tr("par", "with")}{" "}
                    <strong>T-Money, Flooz Moov, MTN MoMo, Celtiis</strong> {tr("ou", "or")} <strong>{tr("Carte Visa/Mastercard", "Visa/Mastercard card")}</strong>.
                  </p>
                  <button
                    type="button"
                    disabled={processing}
                    onClick={openOfficialFedaPayWidget}
                    className="w-full rounded-xl bg-signal-fill py-3.5 px-4 text-sm font-extrabold text-white shadow-md hover:bg-signal-fill-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
                  >
                    <span>{tr("💳 Payer", "💳 Pay")} {amountXof} {tr("FCFA via FedaPay Officiel →", "FCFA via official FedaPay →")}</span>
                  </button>
                </div>
              )}

              {/* Wallet Selector & Quick Validation */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                  2. Ou choisir un réseau Mobile Money et valider
                </label>
                <div className="grid gap-2">
                  {WALLETS.map((w) => {
                    const active = selectedWallet === w.id;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => {
                          setSelectedWallet(w.id);
                          if (w.testPhone && !customerPhone) {
                            setCustomerPhone(w.testPhone);
                          }
                        }}
                        className={`flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                          active
                            ? "border-signal-fill bg-emerald-50/70 ring-2 ring-emerald-500/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`grid h-4 w-4 place-items-center rounded-full border ${
                              active
                                ? "border-signal-fill bg-signal-fill text-white"
                                : "border-slate-300"
                            }`}
                          >
                            {active && <span className="text-[9px]">✓</span>}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">{w.name}</div>
                            <div className="text-[10px] text-slate-500">{w.country}</div>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                          {w.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  ⚠️ {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                {fedaEnvironment === "sandbox" && (
                  <>
                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleComplete("succeeded")}
                      className="w-full rounded-xl bg-signal-fill py-3 px-4 text-xs font-bold text-white shadow hover:bg-signal-fill-hover disabled:opacity-50 transition flex items-center justify-center gap-2"
                    >
                      {processing
                        ? tr("Validation Sandbox en cours…", "Sandbox confirmation in progress…")
                        : tr(`✓ Valider le paiement test (${selectedWallet})`, `✓ Confirm the test payment (${selectedWallet})`)}
                    </button>

                    <button
                      type="button"
                      disabled={processing}
                      onClick={() => handleComplete("failed")}
                      className="w-full rounded-xl border border-rose-300 bg-rose-50 py-2.5 px-4 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition"
                    >
                      {tr("✕ Simuler un paiement refusé / annulé", "✕ Simulate a refused / cancelled payment")}
                    </button>
                  </>
                )}

                <div className="flex items-center justify-between pt-1">
                  <Link
                    href={cancelUrl}
                    className="w-full text-center rounded-xl border border-slate-200 bg-white py-2.5 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {tr("← Annuler et retourner à la boutique", "← Cancel and go back to the shop")}
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>{tr("Propulsé par FedaPay API v1 × Japora Money", "Powered by FedaPay API v1 × Japora Money")}</span>
            <span>{tr("Confirmations WhatsApp Cloud API actives", "WhatsApp Cloud API confirmations active")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
