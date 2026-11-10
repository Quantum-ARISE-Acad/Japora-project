"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";

function StartInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const ref = sp.get("ref") || "";
  const coop = sp.get("coop") || "";

  const [step, setStep] = useState<"phone" | "code">("phone");
  const [shopName, setShopName] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/otp/request", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Impossible d'envoyer le code.");
      return;
    }
    if (data.devCode) setDevCode(String(data.devCode));
    setStep("code");
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/auth/otp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code, shopName, ref, coop }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Code invalide ou expiré.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto max-w-5xl flex-1 px-4 py-12 flex items-center">
        <div className="grid w-full items-center gap-10 lg:grid-cols-[1.05fr,1fr]">
          {/* Left Value Pitch */}
          <div className="space-y-5 a-fade-in">
            <span className="a-eyebrow">Accélérateur d&apos;inscription · ~90 sec</span>
            <h1 className="a-display-sm text-arctic-900">
              Ouvrez votre boutique avec votre numéro WhatsApp.
            </h1>
            <p className="a-body-md text-arctic-700 leading-relaxed">
              Aucun mot de passe à retenir ni carte bancaire à saisir. Recevez un code à 6 chiffres et accédez immédiatement à votre catalogue, votre bot WhatsApp et vos liens de paiement Mobile Money.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              {[
                {
                  title: "Devise FCFA (XOF) native",
                  desc: "Configurée automatiquement avec les rails T-Money, Flooz, Wave et Orange.",
                },
                {
                  title: "Bot WhatsApp pré-activé",
                  desc: "Répond aux questions de prix et de stock dès votre premier produit ajouté.",
                },
                {
                  title: "Affiche QR Code incluse",
                  desc: "Téléchargez votre QR code officiel pour votre stand physique au marché.",
                },
                {
                  title: "0 FCFA d'abonnement",
                  desc: "Offre Starter gratuite à vie, ou gardez 97% sur les paiements intégrés.",
                },
              ].map((b) => (
                <div
                  key={b.title}
                  className="rounded-shape-lg border border-arctic-300/60 bg-white/70 p-3.5"
                >
                  <div className="text-xs font-bold text-arctic-900">
                    ✓ {b.title}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-arctic-600">
                    {b.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right OTP Card */}
          <div className="mx-auto w-full max-w-md a-fade-in">
            <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8 shadow-elev-2">
              {step === "phone" ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="a-eyebrow">Étape 1 sur 2</span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      WhatsApp OTP
                    </span>
                  </div>
                  <h2 className="a-headline-sm mt-2 text-arctic-900">
                    Démarrer sur WhatsApp
                  </h2>
                  <p className="a-body-md mt-1 text-arctic-600">
                    Entrez votre numéro WhatsApp. Nous vous envoyons un code de validation instantané.
                  </p>
                  <form onSubmit={requestCode} className="mt-6 space-y-4">
                    <div>
                      <label className="label">Nom de votre boutique</label>
                      <input
                        className="input"
                        placeholder="ex: Chez Améyo Mode"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">Numéro WhatsApp (avec indicatif)</label>
                      <input
                        className="input"
                        inputMode="tel"
                        placeholder="ex: 22890112233 ou +228 90 11 22 33"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        required
                      />
                    </div>
                    {error && (
                      <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                        {error}
                      </p>
                    )}
                    <button
                      className="a-btn a-btn--cafe w-full font-bold"
                      disabled={loading}
                    >
                      {loading ? "Envoi en cours…" : "Recevoir mon code à 6 chiffres →"}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="a-eyebrow">Étape 2 sur 2</span>
                    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold text-brand-dark">
                      Vérification
                    </span>
                  </div>
                  <h2 className="a-headline-sm mt-2 text-arctic-900">
                    Entrez votre code
                  </h2>
                  <p className="a-body-md mt-1 text-arctic-600">
                    Code à 6 chiffres envoyé au{" "}
                    <span className="font-semibold text-arctic-900">{phone}</span> sur WhatsApp.
                  </p>
                  {devCode && (
                    <p className="mt-3 rounded-shape-md border border-dashed border-brand/55 bg-brand/10 px-3 py-2 a-body-sm text-arctic-800 backdrop-blur-glass-thin">
                      Mode démo — votre code est{" "}
                      <span className="font-mono font-bold text-arctic-900">
                        {devCode}
                      </span>
                    </p>
                  )}
                  <form onSubmit={verify} className="mt-6 space-y-4">
                    <div>
                      <label className="label">Code à 6 chiffres</label>
                      <input
                        className="input text-center text-lg font-bold tracking-[0.4em]"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="••••••"
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, ""))
                        }
                        required
                      />
                    </div>
                    {error && (
                      <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                        {error}
                      </p>
                    )}
                    <button
                      className="a-btn a-btn--cafe w-full font-bold"
                      disabled={loading}
                    >
                      {loading ? "Vérification…" : "Confirmer & ouvrir ma boutique"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setStep("phone");
                        setError("");
                        setCode("");
                      }}
                      className="btn-ghost w-full"
                    >
                      Modifier le numéro
                    </button>
                  </form>
                </>
              )}

              <p className="mt-6 border-t border-arctic-200/60 pt-4 text-center a-body-sm text-arctic-600">
                Vous préférez utiliser une adresse email ?{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-brand-dark hover:underline"
                >
                  Inscription classique
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

export default function StartPage() {
  return (
    <Suspense fallback={null}>
      <StartInner />
    </Suspense>
  );
}
