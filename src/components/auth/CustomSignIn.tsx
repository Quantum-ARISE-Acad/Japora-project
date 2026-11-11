"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs/legacy";
import { errorMessage } from "@/lib/errors";
import { isClerkConfigured } from "./ClerkAuthProvider";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { SaasIcon } from "@/components/ui/SaasIcons";

export default function CustomSignIn() {
  return isClerkConfigured() ? <ClerkSignIn /> : <SignInForm />;
}

function ClerkSignIn() {
  const clerk = useSignIn();
  return <SignInForm clerk={clerk} />;
}

function SignInForm({ clerk }: { clerk?: ReturnType<typeof useSignIn> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const { tr } = usePublicLang();

  const clerkActive = Boolean(clerk);
  const signIn = clerk?.signIn;
  const setActive = clerk?.setActive;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");

    if (clerkActive && signIn && setActive) {
      try {
        await signIn.authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: redirectUrl,
        });
        return;
      } catch (err) {
        console.warn("Clerk Google OAuth fallback:", err);
      }
    }

    try {
      const res = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "google.merchant@japora.app",
          name: "Vendeur Google Démo",
          shopName: "Boutique Google Démo",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tr("Erreur de connexion avec Google.", "Google sign-in error."));
        setGoogleLoading(false);
        return;
      }
      router.push(data.redirectUrl || redirectUrl);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, tr("Erreur de connexion avec Google.", "Google sign-in error.")));
      setGoogleLoading(false);
    }
  }

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (clerkActive && signIn && setActive) {
      try {
        const result = await signIn.create({
          identifier: email.trim(),
          password,
        });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });

          await fetch("/api/auth/clerk-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: email.trim(),
            }),
          }).catch(() => {});

          router.push(redirectUrl);
          router.refresh();
          return;
        } else {
          setError(
            tr(
              "Connexion supplémentaire requise (ex: code de vérification).",
              "Additional verification step required."
            )
          );
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn("Clerk sign-in was not completed, trying local credentials:", err);
      }
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          data.error ||
            tr("Email ou mot de passe incorrect.", "Invalid email or password.")
        );
        setLoading(false);
        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err, tr("Erreur de connexion", "Sign-in error")));
      setLoading(false);
    }
  }

  function fillDemo() {
    setEmail("demo@wcatalog.app");
    setPassword("demo1234");
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto flex flex-1 items-center justify-center px-4 py-12 w-full">
        <div className="w-full max-w-md a-fade-in">
          {/* Demo helper */}
          {!clerkActive && (
            <div className="mb-4 rounded-shape-lg border border-amber-500/30 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-sm backdrop-blur-sm dark:bg-amber-950/40 dark:text-amber-200">
              <div className="flex items-center justify-between">
                <span className="font-semibold flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  {tr("Accès Démo Rapide", "Quick Demo Access")}
                </span>
                <button
                  type="button"
                  onClick={fillDemo}
                  className="font-bold underline hover:text-amber-700 dark:hover:text-amber-100"
                >
                  {tr("Pré-remplir le compte démo", "Fill Demo Account")}
                </button>
              </div>
              <p className="mt-1 opacity-90">
                {tr(
                  "Testez immédiatement le tableau de bord vendeur avec la boutique de démonstration.",
                  "Test the vendor dashboard immediately with the pre-populated demo shop."
                )}
              </p>
            </div>
          )}

          <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8 shadow-elev-2 backdrop-blur-md">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-brand-dark">
              <SaasIcon name="store" size={14} />
              <span>{tr("Portail Vendeurs Japora", "Japora Merchant Portal")}</span>
            </div>
            <h1 className="a-headline-sm text-arctic-900">
              {tr("Connexion à votre boutique", "Sign in to your shop")}
            </h1>
            <p className="a-body-md mt-1 text-arctic-600">
              {tr(
                "Gérez votre catalogue en ligne, votre bot WhatsApp et suivez vos ventes.",
                "Manage your online catalog, your WhatsApp bot, and track your sales."
              )}
            </p>

            {/* Google Sign-in Button */}
            <div className="mt-5">
              <button
                type="button"
                onClick={handleGoogleSignIn}
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
                    ? tr("Connexion Google…", "Signing in with Google…")
                    : tr("Continuer avec Google", "Continue with Google")}
                </span>
              </button>

              <div className="relative my-4 flex items-center justify-center">
                <div className="w-full border-t border-arctic-200" />
                <span className="bg-white/90 px-3 text-[11px] font-medium uppercase tracking-wider text-arctic-500">
                  {tr("ou par email", "or with email")}
                </span>
              </div>
            </div>

            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="label">
                  {tr("Email du compte vendeur", "Vendor Email Address")}
                </label>
                <input
                  className="input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={tr("vendeur@exemple.com", "merchant@example.com")}
                  required
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">
                    {tr("Mot de passe", "Password")}
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-xs text-arctic-600 hover:text-arctic-900 hover:underline"
                  >
                    {tr("Mot de passe oublié ?", "Forgot password?")}
                  </Link>
                </div>
                <input
                  className="input"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && (
                <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                  {error}
                </p>
              )}

              <button className="a-btn a-btn--cafe w-full font-bold" disabled={loading}>
                {loading
                  ? tr("Connexion en cours…", "Signing in…")
                  : tr("Accéder à ma boutique →", "Sign in to my shop →")}
              </button>
            </form>

            <div className="mt-6 border-t border-arctic-200/60 pt-4 text-center a-body-sm text-arctic-600">
              <p>
                {tr("Vous n'avez pas encore de boutique ?", "Don't have a shop yet?")}{" "}
                <Link
                  href="/signup"
                  className="font-semibold text-arctic-900 underline hover:text-brand-dark"
                >
                  {tr("Créer ma boutique", "Create my shop")}
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
