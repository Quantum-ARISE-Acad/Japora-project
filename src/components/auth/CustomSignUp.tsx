"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { SaasIcon } from "@/components/ui/SaasIcons";
import { CATEGORIES, REGIONS } from "@/lib/regions";

const CURRENCIES = [
  { code: "XOF", label: "XOF — Franc CFA (UEMOA : Togo, Bénin, CI, Sénégal…)" },
  { code: "XAF", label: "XAF — Franc CFA (CEMAC : Cameroun, Gabon…)" },
  { code: "GHS", label: "GHS — Cedi Ghanéen (GH₵)" },
  { code: "NGN", label: "NGN — Naira Nigérian (₦)" },
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "EUR", label: "EUR — Euro (€)" },
];

const LANGUAGES = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "ee", label: "Eʋegbe (Éwé)" },
  { code: "yo", label: "Yorùbá" },
  { code: "ha", label: "Hausa" },
];

export default function CustomSignUp() {
  const router = useRouter();
  const { tr } = usePublicLang();

  const clerk = useClerk();
  const isLoaded = Boolean(clerk?.loaded && clerk?.client);
  const signUp = clerk?.client?.signUp;
  const signIn = clerk?.client?.signIn;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [currency, setCurrency] = useState("XOF");
  const [language, setLanguage] = useState("fr");
  const [category, setCategory] = useState("fashion");
  const [region, setRegion] = useState("lome");

  const [verifying, setVerifying] = useState(false);
  const [code, setCode] = useState("");
  const [resendingCode, setResendingCode] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  function savePendingSignupToSession(isGoogleOneClick: boolean) {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        "japora_pending_signup",
        JSON.stringify({
          name: name.trim(),
          shopName: shopName.trim(),
          whatsappNumber: whatsappNumber.trim(),
          currency,
          language,
          category,
          region,
          email: email.trim().toLowerCase(),
          password,
          isGoogleOneClick,
          timestamp: Date.now(),
        }),
      );
    } catch {
      // ignore storage quota errors
    }
  }

  async function handleGoogleSignUp() {
    setError("");
    if (!isLoaded || (!signUp && !signIn)) {
      setError(
        tr(
          "Initialisation de Clerk en cours, veuillez réessayer dans un instant.",
          "Clerk is initializing, please try again in a moment.",
        ),
      );
      return;
    }

    setGoogleLoading(true);
    savePendingSignupToSession(!shopName.trim());

    try {
      const oauthTarget = signUp || signIn;
      await oauthTarget!.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err: any) {
      const clerkMessage =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message;
      setError(
        clerkMessage ||
          tr(
            "Erreur lors de la redirection vers Google (Clerk).",
            "Error redirecting to Google (Clerk).",
          ),
      );
      setGoogleLoading(false);
    }
  }

  async function syncWithBackend(clerkUserId?: string | null) {
    const res = await fetch("/api/auth/clerk-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerkId: clerkUserId || clerk.user?.id || null,
        email: email.trim().toLowerCase(),
        role: "seller",
        name: name.trim(),
        firstName: name.trim().split(" ")[0] || name.trim(),
        lastName: name.trim().split(" ").slice(1).join(" ") || "",
        shopName: shopName.trim() || name.trim(),
        whatsappNumber: whatsappNumber.trim(),
        momoNumber: whatsappNumber.trim(),
        currency,
        language,
        category,
        region,
        password,
        authProvider: "clerk_email",
        isGoogleOneClick: false,
      }),
    });
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("japora_pending_signup");
    }
    return res;
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfoMessage("");

    if (!shopName.trim()) {
      setError(
        tr(
          "Veuillez renseigner le nom de votre boutique.",
          "Please enter your shop name.",
        ),
      );
      return;
    }

    if (!isLoaded || !signUp) {
      setError(
        tr(
          "Le service d'authentification Clerk charge encore. Réessayez dans une seconde.",
          "Clerk authentication is still loading. Please try again in a second.",
        ),
      );
      return;
    }

    setLoading(true);
    savePendingSignupToSession(false);

    try {
      const metadata = {
        role: "seller",
        name: name.trim(),
        shopName: shopName.trim() || name.trim(),
        whatsappNumber: whatsappNumber.trim(),
        currency,
        language,
        category,
        region,
        onboardingCompleted: true,
      };

      let result: any;
      try {
        result = await signUp.create({
          emailAddress: email.trim().toLowerCase(),
          password,
          firstName: name.trim().split(" ")[0] || undefined,
          lastName: name.trim().split(" ").slice(1).join(" ") || undefined,
          unsafeMetadata: metadata,
        });
      } catch (paramErr: any) {
        const errCode = paramErr?.errors?.[0]?.code || "";
        if (
          errCode === "form_param_unknown" ||
          String(paramErr?.errors?.[0]?.message || "").includes("first_name")
        ) {
          result = await signUp.create({
            emailAddress: email.trim().toLowerCase(),
            password,
            unsafeMetadata: metadata,
          });
        } else {
          throw paramErr;
        }
      }

      if (result.status === "missing_requirements") {
        await signUp.prepareEmailAddressVerification({
          strategy: "email_code",
        });
        setVerifying(true);
        setLoading(false);
        return;
      }

      if (result.status === "complete") {
        if (result.createdSessionId) {
          await clerk.setActive({ session: result.createdSessionId });
        }
        await syncWithBackend(result.createdUserId);
        router.push("/dashboard");
        router.refresh();
        return;
      }

      setError(
        tr(
          "Inscription incomplète. Veuillez vérifier les champs requis.",
          "Sign-up incomplete. Please check the required fields.",
        ),
      );
      setLoading(false);
    } catch (err: any) {
      const clerkMessage =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message;
      setError(
        clerkMessage ||
          tr(
            "Erreur lors de la création du compte sur Clerk.",
            "Error creating account on Clerk.",
          ),
      );
      setLoading(false);
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!signUp) return;
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      const completeSignUp = await signUp.attemptEmailAddressVerification({
        code: code.trim(),
      });
      if (completeSignUp.status === "complete") {
        if (completeSignUp.createdSessionId) {
          await clerk.setActive({ session: completeSignUp.createdSessionId });
        }
        await syncWithBackend(completeSignUp.createdUserId);
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(
          tr(
            "Vérification incomplète. Veuillez vérifier le code saisi.",
            "Verification incomplete. Please check the code.",
          ),
        );
      }
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err?.message ||
          tr("Code de validation incorrect.", "Invalid verification code."),
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    if (!signUp) return;
    setResendingCode(true);
    setError("");
    setInfoMessage("");
    try {
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setInfoMessage(
        tr(
          `Un nouveau code à 6 chiffres a été envoyé à ${email}.`,
          `A new 6-digit code was sent to ${email}.`,
        ),
      );
    } catch (err: any) {
      setError(
        err?.errors?.[0]?.message ||
          tr("Impossible de renvoyer le code.", "Could not resend code."),
      );
    } finally {
      setResendingCode(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto flex flex-1 items-center justify-center px-4 py-12 w-full">
        <div className="w-full max-w-lg a-fade-in">
          <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8 shadow-elev-2 backdrop-blur-md">
            {verifying ? (
              <div>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-bold text-emerald-800">
                  ✓ {tr("Sécurité Clerk activée", "Clerk Security enabled")}
                </div>
                <h1 className="a-headline-sm text-arctic-900">
                  {tr(
                    "Vérifiez votre adresse email",
                    "Verify your email address",
                  )}
                </h1>
                <p className="a-body-md mt-1 text-arctic-600">
                  {tr(
                    `Un code de vérification à 6 chiffres a été envoyé à ${email} pour activer la boutique "${shopName || name}".`,
                    `A 6-digit verification code was sent to ${email} to activate "${shopName || name}".`,
                  )}
                </p>
                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                  <div>
                    <label className="label">
                      {tr(
                        "Code de vérification (6 chiffres)",
                        "Verification code (6 digits)",
                      )}
                    </label>
                    <input
                      className="input text-center text-2xl tracking-[0.35em] font-mono font-bold"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={code}
                      onChange={(e) =>
                        setCode(e.target.value.replace(/[^0-9]/g, ""))
                      }
                      placeholder="123456"
                      required
                      autoFocus
                    />
                  </div>
                  {error && (
                    <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700">
                      {error}
                    </p>
                  )}
                  {infoMessage && (
                    <p className="rounded-shape-md border border-emerald-300 bg-emerald-50 px-3 py-2 a-body-sm text-emerald-800">
                      {infoMessage}
                    </p>
                  )}
                  <button
                    className="a-btn a-btn--cafe w-full font-bold"
                    disabled={loading}
                  >
                    {loading
                      ? tr(
                          "Vérification & création de la boutique…",
                          "Verifying & creating shop…",
                        )
                      : tr(
                          "Confirmer et ouvrir ma boutique →",
                          "Confirm and open my shop →",
                        )}
                  </button>

                  <div className="flex items-center justify-between pt-2 text-xs text-arctic-600">
                    <button
                      type="button"
                      onClick={handleResendOtp}
                      disabled={resendingCode}
                      className="font-semibold text-arctic-900 underline hover:text-brand-dark disabled:opacity-50"
                    >
                      {resendingCode
                        ? tr("Renvoi en cours…", "Resending…")
                        : tr("Renvoyer le code", "Resend code")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVerifying(false);
                        setError("");
                      }}
                      className="text-arctic-600 hover:text-arctic-900"
                    >
                      {tr("← Modifier mes informations", "← Edit my details")}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-brand-dark">
                  <SaasIcon name="store" size={14} />
                  <span>
                    {tr(
                      "Plateforme marchande Japora",
                      "Japora Merchant Platform",
                    )}
                  </span>
                </div>

                <h1 className="a-headline-sm text-arctic-900">
                  {tr("Ouvrir votre boutique Japora", "Open your Japora shop")}
                </h1>
                <p className="a-body-md mt-1 text-arctic-600">
                  {tr(
                    "Créez votre catalogue en ligne et sur WhatsApp, encaissez par FedaPay / Mobile Money et suivez vos ventes.",
                    "Create your online and WhatsApp catalog, get paid via FedaPay / Mobile Money, and track your sales.",
                  )}
                </p>

                {/* Google Sign-up Button (Real Clerk OAuth) */}
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={googleLoading || loading || !isLoaded}
                    className="flex w-full items-center justify-center gap-2.5 rounded-shape-md border border-arctic-300/80 bg-white px-4 py-2.5 text-sm font-semibold text-arctic-800 shadow-sm transition hover:bg-arctic-50 active:scale-[0.99] disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>
                      {googleLoading
                        ? tr(
                            "Redirection vers Google…",
                            "Redirecting to Google…",
                          )
                        : tr(
                            "S'inscrire en 1 clic avec Google",
                            "Sign up in 1 click with Google",
                          )}
                    </span>
                  </button>

                  <div className="relative my-4 flex items-center justify-center">
                    <div className="w-full border-t border-arctic-200" />
                    <span className="bg-white/90 px-3 text-[11px] font-medium uppercase tracking-wider text-arctic-500">
                      {tr("ou par email", "or with email")}
                    </span>
                  </div>
                </div>

                <form onSubmit={handleSignUp} className="space-y-3.5">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">
                        {tr("Votre nom complet *", "Your full name *")}
                      </label>
                      <input
                        className="input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={tr("ex: Kossi Mensah", "e.g. Kossi Mensah")}
                        required
                      />
                    </div>

                    <div>
                      <label className="label">
                        {tr(
                          "Nom de votre boutique *",
                          "Shop or brand name *",
                        )}
                      </label>
                      <input
                        className="input"
                        type="text"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder={tr(
                          "ex: Mode & Style Lomé",
                          "e.g. Ada's Fashion House",
                        )}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label">
                      {tr(
                        "Numéro WhatsApp commercial *",
                        "Business WhatsApp number *",
                      )}
                    </label>
                    <input
                      className="input"
                      type="tel"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="+228 90 00 00 00"
                      required
                    />
                    <span className="mt-0.5 block text-[11px] text-arctic-500">
                      {tr(
                        "Format international (+228, +229, +225...) pour recevoir vos commandes WhatsApp et paiements Mobile Money.",
                        "International format (+228, +229, +225...) to receive WhatsApp orders and Mobile Money payments.",
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">
                        {tr("Devise principale", "Primary currency")}
                      </label>
                      <select
                        className="input"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">
                        {tr("Langue de la boutique", "Shop language")}
                      </label>
                      <select
                        className="input"
                        value={language}
                        onChange={(e) => setLanguage(e.target.value)}
                      >
                        {LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="label">
                        {tr("Catégorie d'activité", "Business category")}
                      </label>
                      <select
                        className="input"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c.slug} value={c.slug}>
                            {c.icon} {c.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="label">
                        {tr("Ville / Région", "City / Region")}
                      </label>
                      <select
                        className="input"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                      >
                        {REGIONS.map((r) => (
                          <option key={r.slug} value={r.slug}>
                            {r.label} ({r.country})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="label">
                      {tr("Adresse Email *", "Email address *")}
                    </label>
                    <input
                      className="input"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={tr("vous@exemple.com", "you@example.com")}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      {tr("Mot de passe *", "Password *")}
                    </label>
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tr(
                        "8 caractères min. (lettres + chiffres)",
                        "Min. 8 characters (letters + numbers)",
                      )}
                      required
                    />
                  </div>

                  {/* Required by Clerk v7 Smart Bot Protection */}
                  <div id="clerk-captcha" />

                  {error && (
                    <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                      {error}
                    </p>
                  )}

                  <button
                    className="a-btn a-btn--cafe w-full font-bold mt-2"
                    disabled={loading || !isLoaded}
                  >
                    {loading
                      ? tr(
                          "Création de votre boutique…",
                          "Creating your shop…",
                        )
                      : tr(
                          "Créer ma boutique (30 jours d'essai gratuit) →",
                          "Create my shop (30-day free trial) →",
                        )}
                  </button>
                </form>

                <div className="mt-6 border-t border-arctic-200/60 pt-4 text-center a-body-sm text-arctic-600">
                  <p>
                    {tr("Vous avez déjà une boutique ?", "Already have a shop?")}{" "}
                    <Link
                      href="/login"
                      className="font-semibold text-arctic-900 underline hover:text-brand-dark"
                    >
                      {tr("Se connecter", "Sign in")}
                    </Link>
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
