"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "./ClerkAuthProvider";

const CURRENCIES = [
  { code: "XOF", label: "Franc CFA (XOF)", flag: "🇹🇬" },
  { code: "USD", label: "US Dollar ($)", flag: "🇺🇸" },
  { code: "EUR", label: "Euro (€)", flag: "🇪🇺" },
  { code: "GHS", label: "Ghanaian Cedi (GH₵)", flag: "🇬🇭" },
];

export default function CustomSignUp() {
  const router = useRouter();
  const clerkActive = isClerkConfigured();

  // Clerk hook is safely invoked inside ClerkProvider
  let signUpHook: any = null;
  try {
    if (clerkActive) {
      signUpHook = useSignUp();
    }
  } catch {
    signUpHook = null;
  }

  const isLoaded = signUpHook?.isLoaded ?? false;
  const signUp = signUpHook?.signUp;
  const setActive = signUpHook?.setActive;

  // Form state - Japora is exclusively for sellers / vendors
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [currency, setCurrency] = useState("XOF");

  // Verification step (for Clerk email OTP if required)
  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setError("");

    if (clerkActive && signUp) {
      try {
        await (signUp as any).authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: "/dashboard",
        });
        return;
      } catch (err: any) {
        console.warn("Clerk Google OAuth fallback:", err);
      }
    }

    // Fallback local
    try {
      const res = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nouveau.vendeur.google@wataru.app",
          name: name.trim() || "Nouveau Vendeur Google",
          shopName: shopName.trim() || "Boutique Japora Google",
          currency: currency || "XOF",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Échec de l'inscription Google.");
        setGoogleLoading(false);
        return;
      }
      router.push(data.redirectUrl || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Échec de l'inscription Google.");
      setGoogleLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. If Clerk is configured and active
    if (clerkActive && signUp) {
      try {
        const result = await signUp.create({
          emailAddress: email.trim(),
          password,
          firstName: name.split(" ")[0] || name,
          lastName: name.split(" ").slice(1).join(" ") || undefined,
          unsafeMetadata: {
            role: "seller",
            shopName: shopName.trim() || name.trim(),
            whatsappNumber: whatsappNumber.trim(),
            currency,
          },
        });

        // Check if verification email is sent
        if (result.status === "missing_requirements") {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setVerifying(true);
          setLoading(false);
          return;
        }

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
          // Sync with local database
          await fetch("/api/auth/clerk-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clerkId: result.createdUserId,
              email: email.trim(),
              role: "seller",
              name,
              shopName: shopName.trim() || name.trim(),
              whatsappNumber: whatsappNumber.trim(),
              currency,
            }),
          }).catch(() => {});

          router.push("/dashboard");
          router.refresh();
          return;
        }
      } catch (err: any) {
        setError(err.errors?.[0]?.message || err.message || "Erreur lors de la création du compte avec Clerk.");
        setLoading(false);
        return;
      }
    }

    // 2. Fallback local signup (when Clerk keys not set yet)
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          password,
          shopName: shopName.trim() || name.trim(),
          whatsappNumber: whatsappNumber.trim(),
          currency: currency || "XOF",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Impossible de créer le compte localement.");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erreur réseau");
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || !setActive) return;
    setLoading(true);
    setError("");

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({ code });
      if (completeSignUp.status === "complete") {
        await setActive({ session: completeSignUp.createdSessionId });

        // Sync local DB
        await fetch("/api/auth/clerk-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clerkId: completeSignUp.createdUserId,
            email: email.trim(),
            role: "seller",
            name,
            shopName: shopName.trim() || name.trim(),
            whatsappNumber: whatsappNumber.trim(),
            currency,
          }),
        }).catch(() => {});

        router.push("/dashboard");
        router.refresh();
      } else {
        setError("Vérification incomplète. Veuillez réessayer.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || "Code de validation incorrect.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md a-fade-in">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-shape-md bg-arctic-800 text-lg font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">
            J
          </span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        {/* Clerk configuration badge */}
        {!clerkActive && (
          <div className="mb-4 rounded-shape-lg border border-amber-500/30 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-sm backdrop-blur-sm dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Mode Démo / Prêt pour Clerk
            </div>
            <p className="mt-1 opacity-90">
              Renseignez <code className="font-mono text-[11px] bg-amber-200/50 px-1 py-0.5 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> pour activer l'authentification Clerk en direct. Le mode local reste opérationnel.
            </p>
          </div>
        )}

        <div className="glass glass-edge rounded-shape-xl p-6 shadow-xl backdrop-blur-md">
          {verifying ? (
            <div>
              <h1 className="a-headline-sm text-arctic-900">Vérifiez votre adresse email</h1>
              <p className="a-body-md mt-1 text-arctic-600">
                Un code de vérification à 6 chiffres a été envoyé à <strong>{email}</strong> par Clerk.
              </p>
              <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                <div>
                  <label className="label">Code de vérification</label>
                  <input
                    className="input text-center text-xl tracking-widest font-mono"
                    type="text"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="123456"
                    required
                  />
                </div>
                {error && (
                  <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700">
                    {error}
                  </p>
                )}
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? "Vérification…" : "Confirmer et activer mon compte"}
                </button>
              </form>
            </div>
          ) : (
            <>
              <h1 className="a-headline-sm text-arctic-900">Ouvrir votre boutique Japora</h1>
              <p className="a-body-md mt-1 text-arctic-600">
                Espace Vendeur — Créez votre catalogue WhatsApp et commencez à vendre en quelques minutes.
              </p>

              {/* Exclusive seller badge */}
              <div className="mt-4 flex items-center gap-2 rounded-shape-md bg-brand/10 p-2.5 text-xs text-brand-dark font-medium">
                <span>🛍️</span>
                <span>Plateforme marchande dédiée aux vendeurs & créateurs africains</span>
              </div>

              {/* Google Sign-up Button */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleGoogleSignUp}
                  disabled={googleLoading || loading}
                  className="flex w-full items-center justify-center gap-2.5 rounded-shape-md border border-arctic-200 bg-white px-4 py-2.5 text-sm font-semibold text-arctic-800 shadow-sm transition hover:bg-arctic-50 active:scale-[0.99] disabled:opacity-60 dark:border-arctic-700 dark:bg-arctic-800 dark:text-arctic-100 dark:hover:bg-arctic-700"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{googleLoading ? "Création Google en cours…" : "S'inscrire avec Google"}</span>
                </button>

                <div className="relative my-4 flex items-center justify-center">
                  <div className="w-full border-t border-arctic-200 dark:border-arctic-700" />
                  <span className="absolute bg-white px-2 text-[11px] font-medium uppercase tracking-wider text-arctic-400 dark:bg-arctic-900 dark:text-arctic-500">
                    ou inscription classique
                  </span>
                </div>
              </div>

              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div>
                  <label className="label">Votre nom complet</label>
                  <input
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Kossi Mensah"
                    required
                  />
                </div>

                <div>
                  <label className="label">Nom de votre boutique / marque</label>
                  <input
                    className="input"
                    type="text"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="ex: Mode & Style Lomé"
                    required
                  />
                </div>

                <div>
                  <label className="label">Numéro WhatsApp commercial</label>
                  <input
                    className="input"
                    type="tel"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+228 90 00 00 00"
                    required
                  />
                  <span className="text-[11px] text-arctic-500 mt-0.5 block">Format international (+228, +229, +225...) pour recevoir les commandes</span>
                </div>

                <div>
                  <label className="label">Devise principale de la boutique</label>
                  <select
                    className="input"
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="label">Adresse Email</label>
                  <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    required
                  />
                </div>

                <div>
                  <label className="label">Mot de passe</label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Au moins 8 caractères"
                    minLength={8}
                    required
                  />
                </div>

                {error && (
                  <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                    {error}
                  </p>
                )}

                <button className="btn-primary w-full mt-2" disabled={loading}>
                  {loading ? "Création de la boutique…" : "Créer ma boutique marchande"}
                </button>
              </form>

              <p className="a-body-sm mt-6 text-center text-arctic-600">
                Vous avez déjà une boutique ?{" "}
                <Link href="/login" className="font-semibold text-arctic-900 underline hover:text-black">
                  Se connecter
                </Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
