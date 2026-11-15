"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useClerk } from "@clerk/nextjs";
import PublicHeader from "@/components/PublicHeader";
import PublicFooter from "@/components/PublicFooter";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import { SaasIcon } from "@/components/ui/SaasIcons";

export default function CustomSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";
  const { tr } = usePublicLang();

  const clerk = useClerk();
  const isLoaded = Boolean(clerk?.loaded && clerk?.client);
  const signIn = clerk?.client?.signIn;
  const signUp = clerk?.client?.signUp;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verifyingFactor, setVerifyingFactor] = useState<
    "first" | "second" | null
  >(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function finalizeClerkLogin(
    sessionId: string | null,
    clerkUserId?: string | null,
  ) {
    if (sessionId) {
      await clerk.setActive({ session: sessionId });
    }
    await fetch("/api/auth/clerk-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerkId: clerkUserId || clerk.user?.id || null,
        email: email.trim().toLowerCase(),
        password,
        authProvider: "clerk_email",
      }),
    }).catch(() => {});

    router.push(redirectUrl);
    router.refresh();
  }

  async function handleGoogleSignIn() {
    setError("");
    if (!isLoaded || (!signIn && !signUp)) {
      setError(
        tr(
          "Initialisation de Clerk en cours, veuillez réessayer dans un instant.",
          "Clerk is initializing, please try again in a moment.",
        ),
      );
      return;
    }

    setGoogleLoading(true);

    if (typeof window !== "undefined") {
      try {
        sessionStorage.setItem(
          "japora_pending_signup",
          JSON.stringify({
            isGoogleOneClick: true,
            timestamp: Date.now(),
          }),
        );
      } catch {
        // ignore
      }
    }

    try {
      const oauthClient = signIn || signUp;
      await oauthClient!.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback?intent=signIn",
        redirectUrlComplete: redirectUrl,
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

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!isLoaded || !signIn) {
      setError(
        tr(
          "Le service d'authentification Clerk charge encore. Réessayez dans une seconde.",
          "Clerk authentication is still loading. Please try again in a second.",
        ),
      );
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim().toLowerCase();

    try {
      let result: any = await signIn.create({
        identifier: cleanEmail,
        password,
      });

      // Resolve Clerk Protect challenge in-place (avoids redirect to accounts.dev/sign-in/protect-check)
      if (result?.protectCheck || result?.status === "needs_protect_check") {
        await (clerk as any).__internal_resolvePendingProtectCheck?.("signIn");
        result = clerk.client?.signIn ?? result;
      }

      if (result.status === "complete") {
        await finalizeClerkLogin(
          result.createdSessionId,
          (result as any).createdUserId || null,
        );
        return;
      }

      if (result.status === "needs_first_factor") {
        const emailCodeFactor = result.supportedFirstFactors?.find(
          (f: any) => f.strategy === "email_code",
        ) as any;
        if (emailCodeFactor?.emailAddressId) {
          await signIn.prepareFirstFactor({
            strategy: "email_code",
            emailAddressId: emailCodeFactor.emailAddressId,
          });
          setVerifyingFactor("first");
          setLoading(false);
          return;
        }
      }

      if (result.status === "needs_second_factor") {
        const emailSecondFactor = result.supportedSecondFactors?.find(
          (f: any) => f.strategy === "email_code",
        ) as any;
        if (emailSecondFactor) {
          await signIn.prepareSecondFactor({
            strategy: "email_code",
            ...(emailSecondFactor.emailAddressId
              ? { emailAddressId: emailSecondFactor.emailAddressId }
              : {}),
          });
        }
        setVerifyingFactor("second");
        setLoading(false);
        return;
      }

      setError(
        tr(
          "Authentification incomplète. Veuillez vérifier vos identifiants.",
          "Incomplete authentication. Please check your credentials.",
        ),
      );
      setLoading(false);
    } catch (err: any) {
      const errCode = err?.errors?.[0]?.code || "";
      // If the user is already signed in on Clerk, synchronize and redirect
      if (errCode === "session_exists" && clerk.session?.id) {
        await finalizeClerkLogin(clerk.session.id, clerk.user?.id || null);
        return;
      }

      const clerkMessage =
        err?.errors?.[0]?.longMessage ||
        err?.errors?.[0]?.message ||
        err?.message;
      setError(
        clerkMessage ||
          tr("Email ou mot de passe incorrect.", "Invalid email or password."),
      );
      setLoading(false);
    }
  }

  async function handleVerifyFactorCode(e: React.FormEvent) {
    e.preventDefault();
    if (!signIn || !verifyingFactor) return;

    setLoading(true);
    setError("");

    try {
      const result =
        verifyingFactor === "second"
          ? await signIn.attemptSecondFactor({
              strategy: "email_code",
              code: code.trim(),
            })
          : await signIn.attemptFirstFactor({
              strategy: "email_code",
              code: code.trim(),
            });

      if (result.status === "complete") {
        await finalizeClerkLogin(
          result.createdSessionId,
          (result as any).createdUserId || null,
        );
        return;
      }

      setError(
        tr(
          "Code de vérification incomplet. Veuillez réessayer.",
          "Verification code incomplete. Please try again.",
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
          tr("Code de vérification invalide.", "Invalid verification code."),
      );
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <PublicHeader />

      <main className="mx-auto flex flex-1 items-center justify-center px-4 py-12 w-full">
        <div className="w-full max-w-md a-fade-in">
          <div className="glass glass-edge rounded-shape-xl p-6 sm:p-8 shadow-elev-2 backdrop-blur-md">
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-brand/15 px-3 py-1 text-xs font-bold text-brand-dark">
              <SaasIcon name="store" size={14} />
              <span>
                {tr("Portail Vendeurs Japora", "Japora Merchant Portal")}
              </span>
            </div>

            {verifyingFactor ? (
              <div>
                <h1 className="a-headline-sm text-arctic-900">
                  {tr("Vérification de sécurité", "Security verification")}
                </h1>
                <p className="a-body-md mt-1 text-arctic-600">
                  {tr(
                    `Entrez le code à 6 chiffres envoyé par Clerk à ${email}.`,
                    `Enter the 6-digit code sent by Clerk to ${email}.`,
                  )}
                </p>

                <form
                  onSubmit={handleVerifyFactorCode}
                  className="mt-6 space-y-4"
                >
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

                  <button
                    className="a-btn a-btn--cafe w-full font-bold"
                    disabled={loading}
                  >
                    {loading
                      ? tr("Vérification en cours…", "Verifying…")
                      : tr("Valider et se connecter →", "Verify and sign in →")}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVerifyingFactor(null);
                      setCode("");
                      setError("");
                    }}
                    className="w-full text-center text-xs text-arctic-600 hover:text-arctic-900 underline"
                  >
                    {tr("← Retour à la connexion", "← Back to sign in")}
                  </button>
                </form>
              </div>
            ) : (
              <>
                <h1 className="a-headline-sm text-arctic-900">
                  {tr("Connexion à votre boutique", "Sign in to your shop")}
                </h1>
                <p className="a-body-md mt-1 text-arctic-600">
                  {tr(
                    "Gérez votre catalogue en ligne, votre bot WhatsApp et suivez vos ventes.",
                    "Manage your online catalog, your WhatsApp bot, and track your sales.",
                  )}
                </p>

                {/* Google Sign-in Button (Real Clerk OAuth) */}
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
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
                        ? tr("Redirection vers Google…", "Redirecting to Google…")
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
                      placeholder={tr(
                        "vendeur@exemple.com",
                        "merchant@example.com",
                      )}
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

                  <div id="clerk-captcha" />

                  {error && (
                    <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
                      {error}
                    </p>
                  )}

                  <button
                    className="a-btn a-btn--cafe w-full font-bold"
                    disabled={loading || !isLoaded}
                  >
                    {loading
                      ? tr("Connexion en cours…", "Signing in…")
                      : tr("Accéder à ma boutique →", "Sign in to my shop →")}
                  </button>
                </form>

                <div className="mt-6 border-t border-arctic-200/60 pt-4 text-center a-body-sm text-arctic-600">
                  <p>
                    {tr(
                      "Vous n'avez pas encore de boutique ?",
                      "Don't have a shop yet?",
                    )}{" "}
                    <Link
                      href="/signup"
                      className="font-semibold text-arctic-900 underline hover:text-brand-dark"
                    >
                      {tr("Créer ma boutique", "Create my shop")}
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
