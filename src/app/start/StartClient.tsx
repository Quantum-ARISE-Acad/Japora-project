"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { usePublicLang } from "@/components/PublicLanguageProvider";

function StartInner() {
  const { tr } = usePublicLang();
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
      setError(data.error || tr("Impossible d'envoyer le code.", "Could not send the code."));
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
      setError(data.error || tr("Impossible de vérifier le code.", "Could not verify the code."));
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm a-fade-in">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-shape-md bg-arctic-800 text-lg font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        <div className="glass glass-edge rounded-shape-xl p-6">
          {step === "phone" ? (
            <>
              <h1 className="a-headline-sm text-arctic-900">{tr("Commencer sur WhatsApp", "Start on WhatsApp")}</h1>
              <p className="a-body-md mt-1 text-arctic-600">
                {tr("Entrez votre numéro WhatsApp. Nous vous envoyons un code : pas de mot de passe, pas d'e-mail.", "Enter your WhatsApp number. We'll send a code — no password, no email.")}
              </p>
              <form onSubmit={requestCode} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="startclient-1" className="label">{tr("Nom de la boutique", "Shop name")}</label>
                  <input id="startclient-1"
                    className="input"
                    placeholder={tr("ex. Chez Améyo", "e.g. Chez Améyo")}
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="startclient-2" className="label">{tr("Numéro WhatsApp", "WhatsApp number")}</label>
                  <input id="startclient-2"
                    className="input"
                    inputMode="tel"
                    placeholder={tr("Avec + et l'indicatif du pays, par ex. +228 90 11 22 33", "With + and country code, e.g. +228 90 11 22 33")}
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
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? tr("Envoi…", "Sending…") : tr("Envoyer mon code", "Send my code")}
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="a-headline-sm text-arctic-900">{tr("Entrez votre code", "Enter your code")}</h1>
              <p className="a-body-md mt-1 text-arctic-600">
                {tr("Nous avons envoyé un code à 6 chiffres au", "We sent a 6-digit code to")}{" "}
                <span className="font-semibold text-arctic-900">{phone}</span> {tr("sur WhatsApp.", "on WhatsApp.")}
              </p>
              {devCode && (
                <p className="mt-2 rounded-shape-md border border-dashed border-arctic-400/55 bg-white/55 px-3 py-2 a-body-sm text-arctic-700 backdrop-blur-glass-thin">
                  {tr("Mode développement — votre code est", "Dev mode — your code is")}{" "}
                  <span className="font-mono font-bold text-arctic-900">{devCode}</span>
                </p>
              )}
              <form onSubmit={verify} className="mt-6 space-y-4">
                <div>
                  <label htmlFor="startclient-3" className="label">6-digit code</label>
                  <input id="startclient-3"
                    className="input text-center text-lg tracking-[0.4em]"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="••••••"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>
                {error && (
                  <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                    {error}
                  </p>
                )}
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? tr("Vérification…", "Checking…") : tr("Confirmer et ouvrir ma boutique", "Confirm & open my shop")}
                </button>
                <button
                  type="button"
                  onClick={() => { setStep("phone"); setError(""); setCode(""); }}
                  className="btn-ghost w-full"
                >
                  {tr("Changer de numéro", "Change number")}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center a-body-sm text-arctic-600">
          {tr("Vous préférez l'e-mail ?", "Prefer email?")}{" "}
          <Link href="/signup" className="font-semibold text-arctic-900 hover:underline">
            {tr("S'inscrire de façon classique", "Sign up the classic way")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function StartClient() {
  return (
    <Suspense fallback={null}>
      <StartInner />
    </Suspense>
  );
}
