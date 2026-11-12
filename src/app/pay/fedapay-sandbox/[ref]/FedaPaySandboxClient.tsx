"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import { convertCurrency } from "@/lib/currency";

const WALLETS = [
  {
    id: "T-Money Togo",
    name: "T-Money (Togocom / Yas)",
    country: "🇹🇬 Togo",
    badge: "Instantané",
    color: "border-amber-400 bg-amber-50/70 text-amber-950",
    testPhone: "+22890000001",
  },
  {
    id: "Flooz Moov",
    name: "Flooz (Moov Africa)",
    country: "🇹🇬 Togo / 🇧🇯 Bénin",
    badge: "Instantané",
    color: "border-blue-400 bg-blue-50/70 text-blue-950",
    testPhone: "+22896000001",
  },
  {
    id: "MTN Mobile Money",
    name: "MTN Mobile Money",
    country: "🇧🇯 Bénin / 🇨🇮 Côte d'Ivoire",
    badge: "Mobile Money",
    color: "border-yellow-400 bg-yellow-50/70 text-yellow-950",
    testPhone: "+22997000001",
  },
  {
    id: "Celtiis / Orange Money",
    name: "Celtiis Cash / Orange Money",
    country: "🇧🇯 Bénin / 🇸🇳 Sénégal / 🇨🇮 CI",
    badge: "Mobile Money",
    color: "border-orange-400 bg-orange-50/70 text-orange-950",
    testPhone: "+22940000001",
  },
  {
    id: "Carte Visa / Mastercard",
    name: "Carte Bancaire (Visa / Mastercard)",
    country: "🌍 International",
    badge: "3D Secure Sandbox",
    color: "border-indigo-400 bg-indigo-50/70 text-indigo-950",
    testPhone: "",
  },
];

export default function FedaPaySandboxClient({
  providerRef,
  amountCents,
  currency,
  initialStatus,
  shopName,
  shopLogo,
  title,
  defaultCustomerName,
  defaultCustomerPhone,
  defaultWallet,
  returnUrl,
}: {
  providerRef: string;
  amountCents: number;
  currency: string;
  initialStatus: string;
  shopName: string;
  shopSlug: string;
  shopLogo: string;
  title: string;
  defaultCustomerName: string;
  defaultCustomerPhone: string;
  defaultWallet: string;
  returnUrl: string;
}) {
  const router = useRouter();
  const [selectedWallet, setSelectedWallet] = useState(
    WALLETS.find((w) => w.id.toLowerCase().includes(defaultWallet.toLowerCase()))?.id ||
      WALLETS[0].id,
  );
  const [customerName, setCustomerName] = useState(
    defaultCustomerName && defaultCustomerName !== "Guest" ? defaultCustomerName : "Client Test",
  );
  const [customerPhone, setCustomerPhone] = useState(defaultCustomerPhone || "+22890000001");
  const [otpCode, setOtpCode] = useState("1234");
  const [processing, setProcessing] = useState(false);
  const [doneStatus, setDoneStatus] = useState<string | null>(
    initialStatus === "succeeded" ? "succeeded" : null,
  );
  const [error, setError] = useState("");

  const xofCents =
    currency.toUpperCase() === "XOF"
      ? amountCents
      : convertCurrency(amountCents, currency, "XOF");

  async function handleComplete(outcome: "succeeded" | "failed") {
    setProcessing(true);
    setError("");

    try {
      const res = await fetch("/api/payments/fedapay/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          providerRef,
          outcome,
          wallet: selectedWallet,
          customerName: customerName.trim() || "Client",
          customerPhone: customerPhone.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setProcessing(false);
        setError(data.error || "Erreur lors de la validation du paiement Sandbox.");
        return;
      }

      setDoneStatus(outcome);
      setTimeout(() => {
        router.push(data.redirectUrl || returnUrl);
        router.refresh();
      }, 1200);
    } catch {
      setProcessing(false);
      setError("Erreur réseau lors de la communication avec le serveur.");
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-900 flex flex-col justify-between py-8 px-4">
      <div className="mx-auto w-full max-w-md space-y-4">
        {/* Top Sandbox Banner */}
        <div className="flex items-center justify-between rounded-xl border border-emerald-500/40 bg-emerald-950/80 px-4 py-2.5 text-emerald-200 shadow-lg">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">
              FedaPay Sandbox · Mode Test
            </span>
          </div>
          <span className="rounded bg-emerald-500/20 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
            API v1
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
                  <div className="text-xs text-emerald-300 font-medium">Paiement sécurisé pour</div>
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
                    ≈ {formatMoney(xofCents, "XOF")} (FedaPay XOF)
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
                Paiement approuvé avec succès !
              </h2>
              <p className="text-sm text-slate-600">
                Votre règlement de <strong>{formatMoney(amountCents, currency)}</strong> via{" "}
                <strong>{selectedWallet}</strong> a été validé par FedaPay Sandbox.
              </p>
              <p className="text-xs text-emerald-700 font-medium">
                Redirection automatique vers la boutique en cours…
              </p>
              <div className="pt-2">
                <Link
                  href={returnUrl}
                  className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Continuer maintenant →
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5">
              {/* Wallet Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">
                  1. Choisissez votre moyen de paiement
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
                        className={`flex items-center justify-between rounded-xl border p-3 text-left transition ${
                          active
                            ? "border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20"
                            : "border-slate-200 hover:border-slate-300 bg-white"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`grid h-5 w-5 place-items-center rounded-full border ${
                              active
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-slate-300"
                            }`}
                          >
                            {active && <span className="text-[10px]">✓</span>}
                          </div>
                          <div>
                            <div className="text-sm font-bold text-slate-900">{w.name}</div>
                            <div className="text-[11px] text-slate-500">{w.country}</div>
                          </div>
                        </div>
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-700">
                          {w.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Customer Info & Sandbox Phone */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  2. Informations de règlement (Sandbox)
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Nom complet
                    </label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-emerald-600 focus:outline-none"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Votre nom"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">
                      Numéro WhatsApp / Mobile Money
                    </label>
                    <input
                      type="tel"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono focus:border-emerald-600 focus:outline-none"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="+22890000001"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Code secret / OTP de test FedaPay Sandbox (n&apos;importe quel code à 4 chiffres)
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-center font-mono text-sm tracking-widest focus:border-emerald-600 focus:outline-none"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
                  ⚠️ {error}
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <button
                  type="button"
                  disabled={processing}
                  onClick={() => handleComplete("succeeded")}
                  className="w-full rounded-xl bg-emerald-600 py-3.5 px-4 text-sm font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {processing ? (
                    "Validation FedaPay en cours…"
                  ) : (
                    <>
                      <span>✅ Payer {formatMoney(amountCents, currency)} maintenant</span>
                      <span className="rounded bg-emerald-800/60 px-2 py-0.5 text-[10px]">
                        Sandbox
                      </span>
                    </>
                  )}
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={processing}
                    onClick={() => handleComplete("failed")}
                    className="flex-1 rounded-xl border border-red-200 bg-red-50/60 py-2 px-3 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    ✕ Simuler un échec
                  </button>
                  <Link
                    href={returnUrl}
                    className="rounded-xl border border-slate-200 bg-white py-2 px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Annuler
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-slate-100 bg-slate-50 px-6 py-3 flex items-center justify-between text-[11px] text-slate-500">
            <span>Propulsé par FedaPay Sandbox × Japora Money</span>
            <span>Confirmations WhatsApp Cloud API actives</span>
          </div>
        </div>
      </div>
    </div>
  );
}
