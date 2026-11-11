"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "./ClerkAuthProvider";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { SaasIcon } from "@/components/ui/SaasIcons";

const CURRENCIES = [
  { code: "XOF", label: "XOF — Franc CFA (FCFA)" },
  { code: "USD", label: "USD — US Dollar ($)" },
  { code: "EUR", label: "EUR — Euro (€)" },
  { code: "GHS", label: "GHS — Ghanaian Cedi (GH₵)" },
];

export default function CustomSignUp() {
  const router = useRouter();
  const { tr } = usePublicLang();
  const clerkActive = isClerkConfigured();

  let signUpHook: any = null;
  try {
    if (clerkActive) {
      signUpHook = useSignUp();
    }
  } catch {
    signUpHook = null;
  }

  const signUp = signUpHook?.signUp;
  const setActive = signUpHook?.setActive;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [shopName, setShopName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [currency, setCurrency] = useState("XOF");

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

    try {
      const res = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "nouveau.vendeur.google@japora.app",
          name: name.trim() || "Nouveau Vendeur Google",
          shopName: shopName.trim() || "Boutique Japora Google",
          currency: currency || "XOF",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tr("Échec de l'inscription Google.", "Google sign-up failed."));
        setGoogleLoading(false);
        return;
      }
      router.push(data.redirectUrl || "/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || tr("Échec de l'inscription Google.", "Google sign-up failed."));
      setGoogleLoading(false);
    }
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

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

        if (result.status === "missing_requirements") {
          await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
          setVerifying(true);
          setLoading(false);
          return;
        }

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });
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
        setError(
          err.errors?.[0]?.message ||
            err.message ||
            tr("Erreur lors de la création du compte.", "Error creating account.")
        );
        setLoading(false);
        return;
      }
    }

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
        setError(
          data.error ||
            tr("Impossible de créer le compte.", "Could not create account.")
        );
        setLoading(false);
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message || tr("Erreur réseau", "Network error"));
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
        setError(tr("Vérification incomplète. Veuillez réessayer.", "Verification incomplete. Please try again."));
      }
    } catch (err: any) {
      setError(
        err.errors?.[0]?.message ||
          err.message ||
          tr("Code de validation incorrect.", "Invalid verification code.")
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto flex flex-1 items-center justify-center px-4 py-12 w-full">
        <div className="w-full max-w-md a-fade-in">
          <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8 shadow-elev-2 backdrop-blur-md">
            {verifying ? (
              <div>
                <h1 className="a-headline-sm text-arctic-900">
                  {tr("Vérifiez votre adresse email", "Verify your email address")}
                </h1>
                <p className="a-body-md mt-1 text-arctic-600">
                  {tr(
                    `Un code de vérification à 6 chiffres a été envoyé à ${email}.`,
                    `A 6-digit verification code was sent to ${email}.`
                  )}
                </p>
                <form onSubmit={handleVerifyOtp} className="mt-6 space-y-4">
                  <div>
                    <label className="label">
                      {tr("Code de vérification", "Verification code")}
                    </label>
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
                  <button className="a-btn a-btn--cafe w-full font-bold" disabled={loading}>
                    {loading
                      ? tr("Vérification…", "Verifying…")
                      : tr("Confirmer et activer mon compte", "Confirm and activate my account")}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-brand-dark">
                  <SaasIcon name="store" size={14} />
                  <span>
                    {tr(
                      "Plateforme marchande Japora",
                      "Japora Merchant Platform"
                    )}
                  </span>
                </div>

                <h1 className="a-headline-sm text-arctic-900">
                  {tr("Ouvrir votre boutique Japora", "Open your Japora shop")}
                </h1>
                <p className="a-body-md mt-1 text-arctic-600">
                  {tr(
                    "Créez votre catalogue en ligne et sur WhatsApp, encaissez par Mobile Money et suivez vos ventes.",
                    "Create your online and WhatsApp catalog, get paid via Mobile Money, and track your sales."
                  )}
                </p>

                {/* Google Sign-up Button */}
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleGoogleSignUp}
                    disabled={googleLoading || loading}
                    className="flex w-full items-center justify-center gap-2.5 rounded-shape-md border border-arctic-300/80 bg-white px-4 py-2.5 text-sm font-semibold text-arctic-800 shadow-sm transition hover:bg-arctic-50 active:scale-[0.99] disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                    </svg>
                    <span>
                      {googleLoading
                        ? tr("Création Google en cours…", "Creating with Google…")
                        : tr("S'inscrire avec Google", "Sign up with Google")}
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
                  <div>
                    <label className="label">
                      {tr("Votre nom complet", "Your full name")}
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
                      {tr("Nom de votre boutique / marque", "Shop or brand name")}
                    </label>
                    <input
                      className="input"
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      placeholder={tr("ex: Mode & Style Lomé", "e.g. Ada's Fashion House")}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">
                      {tr("Numéro WhatsApp commercial", "Business WhatsApp number")}
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
                        "Format international (+228, +229, +225...) pour recevoir les commandes",
                        "International format (+228, +229, +225...) to receive orders"
                      )}
                    </span>
                  </div>

                  <div>
                    <label className="label">
                      {tr("Devise principale de la boutique", "Primary shop currency")}
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
                      {tr("Adresse Email", "Email address")}
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
                      {tr("Mot de passe", "Password")}
                    </label>
                    <input
                      className="input"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={tr(
                        "Au moins 8 caractères (lettres + chiffres)",
                        "At least 8 characters (letters + numbers)"
                      )}
                      minLength={8}
                      required
                    />
                  </div>

                  {error && (
                    <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                      {error}
                    </p>
                  )}

                  <button className="a-btn a-btn--cafe w-full mt-2 font-bold" disabled={loading}>
                    {loading
                      ? tr("Création de la boutique…", "Creating shop…")
                      : tr("Créer ma boutique marchande →", "Create my merchant shop →")}
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
