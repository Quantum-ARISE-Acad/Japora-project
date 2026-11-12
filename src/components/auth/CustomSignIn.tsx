"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { useAuth } from "@clerk/nextjs";
// @clerk/nextjs v7: the root `useSignIn` is the new Signal API (no isLoaded/setActive).
// This custom flow uses the classic SignIn resource API, exposed under /legacy.
import { useSignIn } from "@clerk/nextjs/legacy";
import type { CountryCode } from "libphonenumber-js";
import { isClerkConfigured } from "./ClerkAuthProvider";
import {
  extractClerkError,
  isSessionExistsError,
  normalizeE164Phone,
  verifySignInOtpAndAdvance,
  type ClerkResource,
} from "@/lib/clerk-signup-flow";
import PhoneNumberInput from "./PhoneNumberInput";
import { useClerkFinalization } from "./useClerkFinalization";

type LoginMethod = "email" | "phone";
type OtpStrategy = "email_code" | "phone_code";

export default function CustomSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get("redirect") || "/dashboard";
  const redirectUrl =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/dashboard";

  const clerkActive = isClerkConfigured();
  const { finalize, error: finalizationError } = useClerkFinalization("/dashboard");

  let signInHook: ClerkResource = null;
  let authHook: { isLoaded?: boolean; isSignedIn?: boolean; userId?: string | null } | null = null;
  try {
    if (clerkActive) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      signInHook = useSignIn();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      authHook = useAuth();
    }
  } catch {
    signInHook = null;
    authHook = null;
  }

  const isLoaded = signInHook?.isLoaded ?? false;
  const signIn = signInHook?.signIn;
  const setActive = signInHook?.setActive;

  const [method, setMethod] = useState<LoginMethod>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("TG");
  const [verifying, setVerifying] = useState(false);
  const [secondFactor, setSecondFactor] = useState(false);
  const [activeStrategy, setActiveStrategy] = useState<OtpStrategy>("email_code");
  const [factorId, setFactorId] = useState("");
  const [maskedTarget, setMaskedTarget] = useState("");
  const [code, setCode] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [unifiedSession, setUnifiedSession] = useState<{ email: string; name?: string } | null>(null);

  // Returning Clerk sessions use the same sync-and-redirect finalizer.
  useEffect(() => {
    if (!clerkActive || !authHook?.isLoaded || !authHook?.isSignedIn || !authHook?.userId) return;
    void finalize();
  }, [clerkActive, authHook?.isLoaded, authHook?.isSignedIn, authHook?.userId, finalize]);

  // Auto-detect unified Wataru session across ports or forward incoming ticket
  useEffect(() => {
    const ticket = searchParams.get("ticket") || searchParams.get("sso_ticket");
    if (ticket) {
      router.push(`/api/auth/sso?ticket=${encodeURIComponent(ticket)}&redirect=${encodeURIComponent(redirectUrl)}`);
      return;
    }

    fetch("/api/auth/sso?format=json")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.ok && data.vendor) {
          setUnifiedSession(data.vendor);
        }
      })
      .catch(() => {});
  }, [searchParams, redirectUrl, router]);

  function switchMethod(next: LoginMethod) {
    setMethod(next);
    setVerifying(false);
    setCode("");
    setFactorId("");
    setMaskedTarget("");
    setSecondFactor(false);
    setError("");
  }

  function resetToIdentifier() {
    setVerifying(false);
    setCode("");
    setFactorId("");
    setMaskedTarget("");
    setSecondFactor(false);
    setError("");
  }

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");

    if (authHook?.isSignedIn) {
      await finalize();
      setGoogleLoading(false);
      return;
    }

    if (!clerkActive || !isLoaded || !signIn) {
      setError("La connexion avec Google nécessite une configuration Clerk active.");
      setGoogleLoading(false);
      return;
    }

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      await signIn.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: `${origin}/sso-callback?finalize=1`,
      });
    } catch (err: unknown) {
      if (isSessionExistsError(err)) {
        await finalize();
        return;
      }
      setError(extractClerkError(err, "Erreur de connexion avec Google."));
      setGoogleLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (authHook?.isSignedIn) {
      await finalize();
      setLoading(false);
      return;
    }

    if (!clerkActive || !isLoaded || !signIn) {
      setError("L'authentification par code nécessite une configuration Clerk active.");
      setLoading(false);
      return;
    }

    const identifier = method === "email" ? email.trim() : normalizeE164Phone(phone, phoneCountry);
    if (!identifier) {
      setError(
        method === "email"
          ? "Veuillez saisir votre adresse email."
          : "Veuillez saisir votre numéro de téléphone.",
      );
      setLoading(false);
      return;
    }

    try {
      const created = await signIn.create({ identifier });
      const factors: ClerkResource[] = Array.isArray(created.supportedFirstFactors)
        ? created.supportedFirstFactors
        : [];

      if (method === "email") {
        const emailFactor = factors.find(
          (f) => f.strategy === "email_code" && typeof f.emailAddressId === "string",
        );
        if (!emailFactor?.emailAddressId) {
          setError("La connexion par code email n'est pas disponible pour ce compte.");
          setLoading(false);
          return;
        }

        await signIn.prepareFirstFactor({
          strategy: "email_code",
          emailAddressId: emailFactor.emailAddressId,
        });

        setActiveStrategy("email_code");
        setFactorId(emailFactor.emailAddressId);
        setMaskedTarget(emailFactor.safeIdentifier || identifier);
        setCode("");
        setVerifying(true);
      } else {
        const phoneFactor = factors.find(
          (f) => f.strategy === "phone_code" && typeof f.phoneNumberId === "string",
        );
        if (!phoneFactor?.phoneNumberId) {
          setError("La connexion par code SMS n'est pas disponible pour ce numéro.");
          setLoading(false);
          return;
        }

        await signIn.prepareFirstFactor({
          strategy: "phone_code",
          phoneNumberId: phoneFactor.phoneNumberId,
        });

        setActiveStrategy("phone_code");
        setFactorId(phoneFactor.phoneNumberId);
        setMaskedTarget(phoneFactor.safeIdentifier || identifier);
        setCode("");
        setVerifying(true);
      }
    } catch (err: unknown) {
      if (isSessionExistsError(err)) {
        await finalize();
        return;
      }
      setError(
        extractClerkError(
          err,
          method === "email"
            ? "Impossible d'envoyer le code à cette adresse email."
            : "Impossible d'envoyer le code à ce numéro de téléphone.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!clerkActive || !isLoaded || !signIn || !factorId) return;
    setLoading(true);
    setError("");
    try {
      const factorKey = activeStrategy === "email_code" ? "emailAddressId" : "phoneNumberId";
      const prepare = secondFactor ? signIn.prepareSecondFactor : signIn.prepareFirstFactor;
      await prepare.call(signIn, {
        strategy: activeStrategy,
        [factorKey]: factorId,
      });
    } catch (err: unknown) {
      setError(extractClerkError(err, "Impossible de renvoyer le code de vérification."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!clerkActive || !isLoaded || !signIn || !setActive) return;

    if (authHook?.isSignedIn) {
      setLoading(true);
      await finalize();
      setLoading(false);
      return;
    }

    const cleanCode = code.trim();
    if (!cleanCode) {
      setError("Veuillez saisir le code de vérification reçu.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const transition = await verifySignInOtpAndAdvance(signIn, activeStrategy, cleanCode, {
        secondFactor,
      });
      if (transition.action.type === "complete") {
        await finalize({ sessionId: transition.action.sessionId, setActive });
        return;
      }
      if (transition.action.type === "verify_second_factor") {
        setSecondFactor(true);
        setActiveStrategy(transition.action.strategy);
        setFactorId(transition.action.factorId);
        setMaskedTarget(transition.action.target || transition.action.factorId);
        setCode("");
        return;
      }
      if (transition.action.type === "additional_verification") {
        setError(`Une vérification supplémentaire est requise (${transition.action.requirements.join(", ") || "facteur Clerk"}).`);
        return;
      }
      setError(`Le code a été reçu, mais Clerk demande encore une étape (${transition.action.status}). Renvoyez un code ou réessayez.`);
    } catch (err: unknown) {
      if (isSessionExistsError(err)) {
        await finalize();
        return;
      }
      setError(extractClerkError(err, "Code de vérification invalide ou expiré."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex w-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm a-fade-in">

        {/* Wataru Unified Account SSO Banner */}
        {unifiedSession ? (
          <div className="mb-5 rounded-shape-xl border border-emerald-500/50 bg-gradient-to-br from-emerald-50/90 to-teal-50/90 p-4 text-xs text-emerald-950 shadow-md backdrop-blur-md dark:from-emerald-950/80 dark:to-teal-950/70 dark:text-emerald-100">
            <div className="flex items-center justify-between">
              <span className="font-bold flex items-center gap-2 text-emerald-900 dark:text-emerald-200">
                <span className="grid h-5 w-5 place-items-center rounded bg-emerald-600 text-[11px] font-black text-white">
                  W
                </span>
                <span>Compte Wataru Détecté</span>
              </span>
              <span className="rounded-full bg-emerald-200/80 px-2 py-0.5 text-[10px] font-mono font-bold text-emerald-800 dark:bg-emerald-800/80 dark:text-emerald-100">
                SSO Actif
              </span>
            </div>
            <p className="mt-2 text-xs font-medium text-emerald-900 dark:text-emerald-50">
              Connecté en tant que <strong>{unifiedSession.name || unifiedSession.email}</strong>
            </p>
            <button
              type="button"
              onClick={() => router.push(redirectUrl)}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-shape-md bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.99] transition-all"
            >
              <span>Continuer vers le tableau de bord Japora</span>
              <span>➔</span>
            </button>
            <div className="mt-2 text-center">
              <a
                href="http://localhost:3005/login?targetApp=wcatalog"
                className="text-[11px] text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-300 dark:hover:text-white"
              >
                Utiliser un autre compte Wataru
              </a>
            </div>
          </div>
        ) : (
          <div className="mb-5 rounded-shape-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 to-teal-500/5 p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="grid h-5 w-5 place-items-center rounded bg-emerald-600 text-[11px] font-black text-white">
                W
              </span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Authentification Unifiée Wataru
              </span>
            </div>
            <a
              href="http://localhost:3005/login?targetApp=wcatalog"
              className="flex w-full items-center justify-center gap-2 rounded-shape-md bg-emerald-600 py-2.5 px-3 text-xs font-bold text-white shadow-md hover:bg-emerald-700 transition-all text-center"
            >
              <span>Connexion Rapide avec Wataru Auth</span>
              <span>➔</span>
            </a>
            <p className="mt-1.5 text-center text-[11px] text-emerald-700 dark:text-emerald-300">
              1 seul compte pour <strong>Japora</strong>, <strong>Soko CRM</strong> et <strong>WEscrow</strong>
            </p>
          </div>
        )}

        <div className="glass glass-edge rounded-shape-xl p-6 shadow-xl backdrop-blur-md">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand-dark">
            <span>🛍️</span>
            <span>Portail Vendeurs Marchands</span>
          </div>
          <h1 className="a-headline-sm text-arctic-900">Espace Vendeur Japora</h1>
          <p className="a-body-md mt-1 text-arctic-600">
            Gérez votre boutique, vos produits et vos commandes WhatsApp.
          </p>

          {/* Google Sign-in Button */}
          <div className="mt-5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading || loading}
              className="flex w-full items-center justify-center gap-2.5 rounded-shape-md border border-arctic-200 bg-white px-4 py-2.5 text-sm font-semibold text-arctic-800 shadow-sm transition hover:bg-arctic-50 active:scale-[0.99] disabled:opacity-60 dark:border-arctic-700 dark:bg-arctic-800 dark:text-arctic-100 dark:hover:bg-arctic-700"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
              </svg>
              <span>{googleLoading ? "Connexion Google…" : "Continuer avec Google"}</span>
            </button>

            <div className="relative my-4 flex items-center justify-center">
              <div className="w-full border-t border-arctic-200 dark:border-arctic-700" />
              <span className="absolute bg-white px-2 text-[11px] font-medium uppercase tracking-wider text-arctic-400 dark:bg-arctic-900 dark:text-arctic-500">
                ou par code de vérification
              </span>
            </div>
          </div>

          {/* Method Selector: Email OTP vs Phone OTP */}
          {!verifying && (
            <div className="mb-4 grid grid-cols-2 gap-1.5 rounded-shape-md bg-arctic-100/80 p-1 dark:bg-arctic-800/70">
              <button
                type="button"
                onClick={() => switchMethod("email")}
                className={`rounded-shape-sm py-1.5 text-xs font-semibold transition ${
                  method === "email"
                    ? "bg-white text-arctic-900 shadow-xs dark:bg-arctic-900 dark:text-arctic-50"
                    : "text-arctic-600 hover:text-arctic-900 dark:text-arctic-300"
                }`}
              >
                Email (Code OTP)
              </button>
              <button
                type="button"
                onClick={() => switchMethod("phone")}
                className={`rounded-shape-sm py-1.5 text-xs font-semibold transition ${
                  method === "phone"
                    ? "bg-white text-arctic-900 shadow-xs dark:bg-arctic-900 dark:text-arctic-50"
                    : "text-arctic-600 hover:text-arctic-900 dark:text-arctic-300"
                }`}
              >
                Téléphone (SMS)
              </button>
            </div>
          )}

          {verifying ? (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="label">
                  {secondFactor ? "Code de vérification supplémentaire" : "Code de vérification à 6 chiffres"}
                </label>
                <p className="mb-2 text-xs text-arctic-600">
                  Code envoyé à <strong className="text-arctic-900">{maskedTarget}</strong>.
                </p>
                <input
                  className="input text-center text-xl tracking-widest font-mono"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  required
                />
              </div>

              {(error || finalizationError) && (
                <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                  {error || finalizationError}
                </p>
              )}

              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Vérification en cours…" : secondFactor ? "Valider la vérification" : "Valider le code et accéder à ma boutique"}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={resetToIdentifier}
                  disabled={loading}
                  className="font-medium text-arctic-600 underline hover:text-arctic-900"
                >
                  {method === "email" ? "Changer d'email" : "Changer de numéro"}
                </button>
                <button
                  type="button"
                  onClick={handleResendOtp}
                  disabled={loading}
                  className="font-medium text-arctic-600 underline hover:text-arctic-900"
                >
                  Renvoyer le code
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSendOtp} className="space-y-4">
              {method === "email" ? (
                <div>
                  <label className="label">Email du compte vendeur</label>
                  <input
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="vendeur@exemple.com"
                    required
                  />
                </div>
              ) : (
                <PhoneNumberInput
                  id="signin-phone"
                  label="Numéro de téléphone"
                  value={phone}
                  country={phoneCountry}
                  onChange={setPhone}
                  onCountryChange={setPhoneCountry}
                />
              )}

              {(error || finalizationError) && (
                <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                  {error || finalizationError}
                </p>
              )}

              <button className="btn-primary w-full" disabled={loading}>
                {loading ? "Envoi du code…" : "Recevoir un code de connexion"}
              </button>
            </form>
          )}

          {/* Required Clerk Smart/Bot-protection CAPTCHA mount point for custom flows */}
          <div id="clerk-captcha" className="mt-3" />

          <p className="a-body-sm mt-6 text-center text-arctic-600">
            Vous n&apos;avez pas encore de boutique ?{" "}
            <Link
              href="/signup"
              className="font-semibold text-arctic-900 underline hover:text-black"
            >
              Créer ma boutique
            </Link>
          </p>
        </div>
      </div>
      </main>
      <PublicFooter />
    </div>
  );
}
