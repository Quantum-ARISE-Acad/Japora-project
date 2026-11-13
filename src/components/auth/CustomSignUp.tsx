"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { useAuth } from "@clerk/nextjs";
// @clerk/nextjs v7: the root `useSignUp` is the new Signal API (no isLoaded/setActive).
// This custom flow uses the classic SignUp resource API, exposed under /legacy.
import { useSignUp } from "@clerk/nextjs/legacy";
import type { CountryCode } from "libphonenumber-js";
import { isClerkConfigured } from "./ClerkAuthProvider";
import PhoneNumberInput from "./PhoneNumberInput";
import { useClerkFinalization } from "./useClerkFinalization";
import {
  buildAutoFillMissingFieldsPayload,
  buildSignUpCreatePayload,
  determineNextSignUpStep,
  extractClerkError,
  isOAuthContinuation,
  isSessionExistsError,
  normalizeE164Phone,
  verifySignUpOtpAndAdvance,
  type SignUpMethod,
  type VerificationStep,
  type ClerkResource,
} from "@/lib/clerk-signup-flow";

const CURRENCIES = [
  { code: "XOF", label: "Franc CFA (XOF)", flag: "🇹🇬" },
  { code: "USD", label: "US Dollar ($)", flag: "🇺🇸" },
  { code: "EUR", label: "Euro (€)", flag: "🇪🇺" },
  { code: "GHS", label: "Ghanaian Cedi (GH₵)", flag: "🇬🇭" },
];

export default function CustomSignUp() {
  const router = useRouter();
  const clerkActive = isClerkConfigured();
  const { finalize, error: finalizationError } = useClerkFinalization("/dashboard");

  let signUpHook: ClerkResource = null;
  let authHook: { isLoaded?: boolean; isSignedIn?: boolean; userId?: string | null } | null = null;
  try {
    if (clerkActive) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      signUpHook = useSignUp();
      // eslint-disable-next-line react-hooks/rules-of-hooks
      authHook = useAuth();
    }
  } catch {
    signUpHook = null;
    authHook = null;
  }

  const isLoaded = signUpHook?.isLoaded ?? false;
  const signUp = signUpHook?.signUp;
  const setActive = signUpHook?.setActive;

  const [method, setMethod] = useState<SignUpMethod>("email");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>("TG");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [currency, setCurrency] = useState("XOF");

  const [verificationStep, setVerificationStep] = useState<VerificationStep>(null);
  const [code, setCode] = useState("");
  const [continuingOAuth, setContinuingOAuth] = useState(false);
  const [missingRequirements, setMissingRequirements] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  function getSyncPayload() {
    const formattedWa = normalizeE164Phone(whatsappNumber || phone, phoneCountry);
    return {
      name: name.trim(),
      shopName: shopName.trim(),
      whatsappNumber: formattedWa || whatsappNumber.trim(),
      currency,
    };
  }

  // Returning Clerk sessions use the same sync-and-redirect finalizer.
  useEffect(() => {
    if (!clerkActive || !authHook?.isLoaded || !authHook?.isSignedIn || !authHook?.userId) return;
    void finalize({ payload: getSyncPayload() });
  }, [clerkActive, authHook?.isLoaded, authHook?.isSignedIn, authHook?.userId, finalize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect true OAuth continuation (`externalAccount` verified) without false-matching normal signups
  useEffect(() => {
    if (!clerkActive || !isLoaded || !signUp) return;

    if (signUp.status === "complete" && signUp.createdSessionId) {
      void finalizeCompleteSignUp(signUp.createdSessionId);
      return;
    }

    if (isOAuthContinuation(signUp)) {
      setContinuingOAuth(true);
      const missing: string[] = Array.isArray(signUp.missingFields) ? signUp.missingFields : [];
      setMissingRequirements(missing);
      if (signUp.emailAddress && !email) {
        setEmail(signUp.emailAddress);
      }
      const existingName = [signUp.firstName, signUp.lastName].filter(Boolean).join(" ").trim();
      if (existingName && !name) {
        setName(existingName);
      }
      if (signUp.phoneNumber && !phone) {
        setPhone(signUp.phoneNumber);
      }
      const meta = signUp.unsafeMetadata as Record<string, unknown> | undefined;
      if (typeof meta?.shopName === "string" && meta.shopName && !shopName) {
        setShopName(meta.shopName);
      }
      if (typeof meta?.whatsappNumber === "string" && meta.whatsappNumber && !whatsappNumber) {
        setWhatsappNumber(meta.whatsappNumber);
      }
      if (typeof meta?.currency === "string" && meta.currency) {
        setCurrency(meta.currency);
      }
    }
  }, [clerkActive, isLoaded, signUp]); // eslint-disable-line react-hooks/exhaustive-deps

  async function finalizeCompleteSignUp(sessionId: string) {
    await finalize({ sessionId, setActive, payload: getSyncPayload() });
  }

  async function applySignUpTransition(currentSignUp: ClerkResource) {
    if (!currentSignUp) return;

    // Auto-fill derivable missing fields (`first_name`, `last_name`, `username`, etc.)
    let activeSignUp = currentSignUp;
    if (activeSignUp.status !== "complete" && typeof signUp?.update === "function") {
      const autoPayload = buildAutoFillMissingFieldsPayload(activeSignUp, {
        method,
        email,
        phone,
        password,
        name,
        shopName,
        whatsappNumber,
        currency,
      });
      if (autoPayload) {
        try {
          activeSignUp = await signUp.update(autoPayload);
        } catch {
          // Proceed with determineNextSignUpStep on activeSignUp
        }
      }
    }

    const action = determineNextSignUpStep(activeSignUp);

    if (action.type === "complete") {
      await finalizeCompleteSignUp(action.sessionId);
      return;
    }

    if (action.type === "verify_email") {
      setVerificationStep("email");
      setCode("");
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      return;
    }

    if (action.type === "verify_phone") {
      setVerificationStep("phone");
      setCode("");
      await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
      return;
    }

    if (action.type === "missing_fields") {
      setVerificationStep(null);
      setCode("");
      setMissingRequirements(action.missingFields);
      if (action.missingFields.includes("phone_number")) {
        setMethod("phone");
      } else if (action.missingFields.includes("email_address")) {
        setMethod("email");
      }
      setError(`Informations supplémentaires requises : ${action.missingFields.join(", ")}`);
      return;
    }

    if (action.type === "additional_verification") {
      setVerificationStep(null);
      setMissingRequirements(action.requirements);
      setError(`Clerk exige une vérification supplémentaire : ${action.requirements.join(", ") || "vérification du compte"}.`);
      return;
    }

    setError("Vérification supplémentaire requise pour activer le compte.");
  }

  function switchMethod(next: SignUpMethod) {
    setMethod(next);
    setVerificationStep(null);
    setCode("");
    setError("");
  }

  async function handleGoogleSignUp() {
    setGoogleLoading(true);
    setError("");

    if (authHook?.isSignedIn) {
      await finalize({ payload: getSyncPayload() });
      setGoogleLoading(false);
      return;
    }

    if (!clerkActive || !isLoaded || !signUp) {
      setError("L'inscription avec Google nécessite une configuration Clerk active.");
      setGoogleLoading(false);
      return;
    }

    try {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const formattedWa = normalizeE164Phone(whatsappNumber || phone, phoneCountry);
      await signUp.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: `${origin}/sso-callback`,
        redirectUrlComplete: `${origin}/sso-callback?finalize=1`,
        unsafeMetadata: {
          role: "seller",
          ...(name.trim() ? { name: name.trim() } : {}),
          ...(shopName.trim() ? { shopName: shopName.trim() } : {}),
          ...(formattedWa ? { whatsappNumber: formattedWa } : {}),
          currency,
        },
      });
    } catch (err: unknown) {
      if (isSessionExistsError(err)) {
        await finalize({ payload: getSyncPayload() });
        return;
      }
      setError(extractClerkError(err, "Échec de l'inscription avec Google."));
      setGoogleLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const trimmedEmail = email.trim();
    const formattedPhone = normalizeE164Phone(phone || whatsappNumber, phoneCountry);
    const trimmedName = name.trim();
    const trimmedShopName = shopName.trim();

    if (clerkActive) {
      if (authHook?.isSignedIn) {
        await finalize({ payload: getSyncPayload() });
        setLoading(false);
        return;
      }

      if (!isLoaded || !signUp) {
        setError("Le service d'authentification est en cours d'initialisation. Veuillez réessayer.");
        setLoading(false);
        return;
      }

      if (method === "email" && !trimmedEmail) {
        setError("Veuillez renseigner votre adresse email.");
        setLoading(false);
        return;
      }

      if (method === "phone" && !formattedPhone) {
        setError("Veuillez renseigner un numéro de téléphone valide avec indicatif pays (ex: +228...).");
        setLoading(false);
        return;
      }

      try {
        // Only update an existing SignUp when continuing a verified OAuth account
        // or supplying missing fields after email/phone was already verified on this SignUp.
        const hasVerifiedEmailOnCurrent =
          signUp.verifications?.emailAddress?.status === "verified" &&
          signUp.emailAddress === trimmedEmail;
        const hasVerifiedPhoneOnCurrent =
          signUp.verifications?.phoneNumber?.status === "verified" &&
          signUp.phoneNumber === formattedPhone;

        const shouldUpdateExisting =
          continuingOAuth ||
          (signUp.status === "missing_requirements" &&
            (hasVerifiedEmailOnCurrent || hasVerifiedPhoneOnCurrent));

        let result: ClerkResource;
        if (shouldUpdateExisting) {
          const updatePayload: Record<string, unknown> = {
            unsafeMetadata: {
              role: "seller",
              ...(trimmedName ? { name: trimmedName } : {}),
              ...(trimmedShopName ? { shopName: trimmedShopName } : {}),
              ...(formattedPhone ? { whatsappNumber: formattedPhone } : {}),
              currency,
            },
          };
          if (password && !signUp.hasPassword) {
            updatePayload.password = password;
          }
          if (
            trimmedEmail &&
            signUp.verifications?.emailAddress?.status !== "verified" &&
            signUp.emailAddress !== trimmedEmail
          ) {
            updatePayload.emailAddress = trimmedEmail;
          }
          if (
            method === "phone" &&
            formattedPhone &&
            signUp.verifications?.phoneNumber?.status !== "verified" &&
            signUp.phoneNumber !== formattedPhone
          ) {
            updatePayload.phoneNumber = formattedPhone;
          }
          result = await signUp.update(updatePayload);
        } else {
          const createPayload = buildSignUpCreatePayload({
            method,
            email: trimmedEmail,
            phone: formattedPhone,
            password,
            name: trimmedName,
            shopName: trimmedShopName,
            whatsappNumber: normalizeE164Phone(whatsappNumber, phoneCountry),
            currency,
          });
          result = await signUp.create(createPayload);
        }

        await applySignUpTransition(result);
      } catch (err: unknown) {
        if (isSessionExistsError(err)) {
          await finalize({ payload: getSyncPayload() });
          return;
        }
        setError(extractClerkError(err, "Erreur lors de la création du compte."));
      } finally {
        setLoading(false);
      }
      return;
    }

    // Fallback local signup ONLY when Clerk keys are not configured
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: trimmedEmail,
          password,
          shopName: trimmedShopName || trimmedName || "My Shop",
          whatsappNumber: normalizeE164Phone(whatsappNumber, phoneCountry) || formattedPhone,
          currency: currency || "XOF",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Impossible de créer le compte localement.");
        setLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      setError(extractClerkError(err, "Erreur réseau"));
      setLoading(false);
    }
  }

  async function handleResendCode() {
    if (!signUp || !verificationStep) return;
    setLoading(true);
    setError("");
    try {
      if (verificationStep === "email") {
        await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      } else {
        await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
      }
    } catch (err: unknown) {
      setError(extractClerkError(err, "Impossible de renvoyer le code de vérification."));
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp || !setActive || !verificationStep) return;

    const cleanCode = code.trim();
    if (!cleanCode && signUp.status !== "complete") {
      setError("Veuillez saisir le code de vérification.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const transition = await verifySignUpOtpAndAdvance(
        signUp,
        verificationStep,
        cleanCode,
        {
          method,
          email,
          phone,
          password,
          name,
          shopName,
          whatsappNumber,
          currency,
        },
      );

      const { action, prepareError } = transition;

      if (action.type === "complete") {
        await finalizeCompleteSignUp(action.sessionId);
        return;
      }

      if (action.type === "verify_email") {
        setVerificationStep("email");
        setCode("");
        if (prepareError) setError(prepareError);
        return;
      }

      if (action.type === "verify_phone") {
        setVerificationStep("phone");
        setCode("");
        if (prepareError) setError(prepareError);
        return;
      }

      if (action.type === "missing_fields") {
        setVerificationStep(null);
        setCode("");
        setMissingRequirements(action.missingFields);
        if (action.missingFields.includes("phone_number")) {
          setMethod("phone");
        } else if (action.missingFields.includes("email_address")) {
          setMethod("email");
        }
        setError(
          `Votre code a bien été vérifié. Veuillez compléter : ${action.missingFields.join(", ")}`,
        );
        return;
      }

      if (action.type === "additional_verification") {
        setVerificationStep(null);
        setCode("");
        setMissingRequirements(action.requirements);
        setError(`Clerk exige une vérification supplémentaire : ${action.requirements.join(", ") || "vérification du compte"}.`);
        return;
      }

      setError(`Le code a été vérifié, mais Clerk demande encore une étape (${action.type === "incomplete" ? action.unverifiedFields.join(", ") || action.missingFields.join(", ") || "état incomplet" : "vérification supplémentaire"}).`);
    } catch (err: unknown) {
      if (isSessionExistsError(err)) {
        await finalize({ payload: getSyncPayload() });
        return;
      }
      setError(extractClerkError(err, "Code de validation incorrect ou expiré."));
    } finally {
      setLoading(false);
    }
  }

  const requiresPassword =
    !continuingOAuth ||
    missingRequirements.includes("password") ||
    (Array.isArray(signUp?.missingFields) && signUp.missingFields.includes("password"));

  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <main className="flex w-full flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-md a-fade-in">

        {!clerkActive && (
          <div className="mb-4 rounded-shape-lg border border-amber-500/30 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-sm backdrop-blur-sm dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              Mode Démo / Prêt pour Clerk
            </div>
            <p className="mt-1 opacity-90">
              Renseignez <code className="font-mono text-[11px] bg-amber-200/50 px-1 py-0.5 rounded">NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY</code> pour activer l&apos;authentification Clerk en direct.
            </p>
          </div>
        )}

        <div className="glass glass-edge rounded-shape-xl p-6 shadow-xl backdrop-blur-md">
          {verificationStep ? (
            <div>
              <h1 className="a-headline-sm text-arctic-900">
                {verificationStep === "email"
                  ? "Vérifiez votre adresse email"
                  : "Vérifiez votre numéro de téléphone"}
              </h1>
              <p className="a-body-md mt-1 text-arctic-600">
                {verificationStep === "email" ? (
                  <>
                    Un code de vérification à 6 chiffres a été envoyé à{" "}
                    <strong>{signUp?.emailAddress || email}</strong>.
                  </>
                ) : (
                  <>
                    Un code SMS à 6 chiffres a été envoyé au{" "}
                    <strong>{signUp?.phoneNumber || normalizeE164Phone(phone, phoneCountry) || phone}</strong>.
                  </>
                )}
              </p>
              <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                <div>
                  <label className="label">Code de vérification</label>
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
                  <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700">
                    {error || finalizationError}
                  </p>
                )}
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? "Vérification…" : "Confirmer et activer mon compte"}
                </button>
                <div className="flex items-center justify-between pt-1 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setVerificationStep(null);
                      setCode("");
                      setError("");
                    }}
                    disabled={loading}
                    className="font-medium text-arctic-600 underline hover:text-arctic-900"
                  >
                    Modifier mes informations
                  </button>
                  <button
                    type="button"
                    onClick={handleResendCode}
                    disabled={loading}
                    className="font-medium text-arctic-600 underline hover:text-arctic-900"
                  >
                    Renvoyer le code
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <h1 className="a-headline-sm text-arctic-900">
                {continuingOAuth ? "Complétez votre inscription" : "Créer votre compte vendeur Japora"}
              </h1>
              <p className="a-body-md mt-1 text-arctic-600">
                {continuingOAuth
                  ? "Dernière étape pour accéder à votre espace vendeur."
                  : "Créez votre compte en quelques secondes, puis configurez votre boutique sur le tableau de bord."}
              </p>

              <div className="mt-4 flex items-center gap-2 rounded-shape-md bg-brand/10 p-2.5 text-xs text-brand-dark font-medium">
                <span>🛍️</span>
                <span>Plateforme marchande dédiée aux vendeurs & créateurs africains</span>
              </div>

              {/* Google Sign-up Button */}
              {!continuingOAuth && (
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
                      ou par code de vérification
                    </span>
                  </div>

                  {/* Method Selector: Email OTP vs Phone OTP */}
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
                </div>
              )}

              <form onSubmit={handleSignUp} className="space-y-3.5 mt-4">
                <div>
                  <label className="label">Votre nom complet</label>
                  <input
                    className="input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Kossi Mensah"
                    required={!continuingOAuth}
                  />
                </div>

                {method === "email" ? (
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
                      disabled={
                        continuingOAuth &&
                        signUp?.verifications?.emailAddress?.status === "verified" &&
                        Boolean(email)
                      }
                    />
                  </div>
                ) : (
                  <PhoneNumberInput
                    id="signup-phone"
                    label="Numéro de téléphone (SMS OTP)"
                    value={phone}
                    country={phoneCountry}
                    onChange={setPhone}
                    onCountryChange={setPhoneCountry}
                  />
                )}

                {requiresPassword && (
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
                      required={requiresPassword}
                    />
                  </div>
                )}

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

                {(error || finalizationError) && (
                  <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                    {error || finalizationError}
                  </p>
                )}

                <button className="btn-primary w-full mt-2" disabled={loading}>
                  {loading
                    ? "Création du compte…"
                    : continuingOAuth
                      ? "Continuer vers ma boutique"
                      : "Continuer et recevoir mon code"}
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

          {/* Required Clerk Smart/Bot-protection CAPTCHA mount point for custom flows */}
          <div id="clerk-captcha" className="mt-3" />
        </div>
      </div>
      </main>
      <PublicFooter />
    </div>
  );
}
