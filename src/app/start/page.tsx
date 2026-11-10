"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";

function StartInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const { tr } = usePublicLang();
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
      setError(
        data.error ||
          tr("Impossible d'envoyer le code.", "Unable to send the code.")
      );
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
      setError(
        data.error ||
          tr("Code invalide ou expiré.", "Invalid or expired code.")
      );
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
            <span className="a-eyebrow">
              {tr(
                "Accélérateur d'inscription · ~90 sec",
                "Quick onboarding · ~90 sec"
              )}
            </span>
            <h1 className="a-display-sm text-arctic-900">
              {tr(
                "Ouvrez votre boutique avec votre numéro WhatsApp.",
                "Open your shop with your WhatsApp number."
              )}
            </h1>
            <p className="a-body-md text-arctic-700 leading-relaxed">
              {tr(
                "Aucun mot de passe à retenir ni carte bancaire à saisir. Recevez un code à 6 chiffres et accédez immédiatement à votre catalogue, votre bot WhatsApp et vos liens de paiement Mobile Money.",
                "No password to remember or credit card required. Receive a 6-digit code and get instant access to your catalog, WhatsApp bot, and Mobile Money payment links."
              )}
            </p>

            <div className="grid gap-3 sm:grid-cols-2 pt-2">
              {[
                {
                  title: tr("Devise FCFA (XOF) native", "Native FCFA (XOF) currency"),
                  desc: tr(
                    "Configurée automatiquement avec les rails T-Money, Flooz, Wave et Orange.",
                    "Automatically configured with T-Money, Flooz, Wave, and Orange Money rails."
                  ),
                },
                {
                  title: tr("Bot WhatsApp pré-activé", "Pre-activated WhatsApp Bot"),
                  desc: tr(
                    "Répond aux questions de prix et de stock dès votre premier produit ajouté.",
                    "Answers price and stock questions as soon as your first product is added."
                  ),
                },
                {
                  title: tr("Affiche QR Code incluse", "QR Code poster included"),
                  desc: tr(
                    "Téléchargez votre QR code officiel pour votre stand physique au marché.",
                    "Download your official QR code poster for your physical market stall."
                  ),
                },
                {
                  title: tr("Accès immédiat gratuit", "Free instant access"),
                  desc: tr(
                    "Commencez à vendre en ligne et sur WhatsApp sans frais d'ouverture.",
                    "Start selling online and on WhatsApp with zero setup fees."
                  ),
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
                    <span className="a-eyebrow">
                      {tr("Étape 1 sur 2", "Step 1 of 2")}
                    </span>
                    <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                      WhatsApp OTP
                    </span>
                  </div>
                  <h2 className="a-headline-sm mt-2 text-arctic-900">
                    {tr("Démarrer sur WhatsApp", "Start with WhatsApp")}
                  </h2>
                  <p className="a-body-md mt-1 text-arctic-600">
                    {tr(
                      "Entrez votre numéro WhatsApp. Nous vous envoyons un code de validation instantané.",
                      "Enter your WhatsApp number. We will send you an instant verification code."
                    )}
                  </p>
                  <form onSubmit={requestCode} className="mt-6 space-y-4">
                    <div>
                      <label className="label">
                        {tr("Nom de votre boutique", "Your shop name")}
                      </label>
                      <input
                        className="input"
                        placeholder={tr("ex: Chez Améyo Mode", "e.g. Ameyo Fashion")}
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">
                        {tr(
                          "Numéro WhatsApp (avec indicatif)",
                          "WhatsApp number (with country code)"
                        )}
                      </label>
                      <input
                        className="input"
                        inputMode="tel"
                        placeholder={tr(
                          "ex: 22890112233 ou +228 90 11 22 33",
                          "e.g. 22890112233 or +228 90 11 22 33"
                        )}
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
                      {loading
                        ? tr("Envoi en cours…", "Sending…")
                        : tr(
                            "Recevoir mon code à 6 chiffres →",
                            "Get my 6-digit code →"
                          )}
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="a-eyebrow">
                      {tr("Étape 2 sur 2", "Step 2 of 2")}
                    </span>
                    <span className="rounded-full bg-brand/15 px-2.5 py-0.5 text-[10px] font-bold text-brand-dark">
                      {tr("Vérification", "Verification")}
                    </span>
                  </div>
                  <h2 className="a-headline-sm mt-2 text-arctic-900">
                    {tr("Entrez votre code", "Enter your code")}
                  </h2>
                  <p className="a-body-md mt-1 text-arctic-600">
                    {tr("Code à 6 chiffres envoyé au ", "6-digit code sent to ")}
                    <span className="font-semibold text-arctic-900">{phone}</span>{" "}
                    {tr("sur WhatsApp.", "on WhatsApp.")}
                  </p>
                  {devCode && (
                    <p className="mt-3 rounded-shape-md border border-dashed border-brand/55 bg-brand/10 px-3 py-2 a-body-sm text-arctic-800 backdrop-blur-glass-thin">
                      {tr("Mode démo — votre code est ", "Demo mode — your code is ")}
                      <span className="font-mono font-bold text-arctic-900">
                        {devCode}
                      </span>
                    </p>
                  )}
                  <form onSubmit={verify} className="mt-6 space-y-4">
                    <div>
                      <label className="label">
                        {tr("Code à 6 chiffres", "6-digit code")}
                      </label>
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
                      {loading
                        ? tr("Vérification…", "Verifying…")
                        : tr(
                            "Confirmer & ouvrir ma boutique",
                            "Confirm & open my shop"
                          )}
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
                      {tr("Modifier le numéro", "Change phone number")}
                    </button>
                  </form>
                </>
              )}

              <p className="mt-6 border-t border-arctic-200/60 pt-4 text-center a-body-sm text-arctic-600">
                {tr(
                  "Vous préférez utiliser une adresse email ? ",
                  "Prefer to sign up with an email address? "
                )}
                <Link
                  href="/signup"
                  className="font-semibold text-brand-dark hover:underline"
                >
                  {tr("Inscription classique", "Email sign up")}
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
