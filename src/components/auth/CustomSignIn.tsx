"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useSignIn } from "@clerk/nextjs";
import { isClerkConfigured } from "./ClerkAuthProvider";

export default function CustomSignIn() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get("redirect") || "/dashboard";

  const clerkActive = isClerkConfigured();

  let signInHook: any = null;
  try {
    if (clerkActive) {
      signInHook = useSignIn();
    }
  } catch {
    signInHook = null;
  }

  const signIn = signInHook?.signIn;
  const setActive = signInHook?.setActive;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [unifiedSession, setUnifiedSession] = useState<{ email: string; name?: string } | null>(null);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError("");

    if (clerkActive && signIn) {
      try {
        await (signIn as any).authenticateWithRedirect({
          strategy: "oauth_google",
          redirectUrl: "/sso-callback",
          redirectUrlComplete: redirectUrl,
        });
        return;
      } catch (err: any) {
        console.warn("Clerk Google OAuth fallback:", err);
      }
    }

    // Fallback local / mode dev
    try {
      const res = await fetch("/api/auth/google-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "google.merchant@wataru.app",
          name: "Vendeur Google Démo",
          shopName: "Boutique Google Démo",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Erreur de connexion avec Google.");
        setGoogleLoading(false);
        return;
      }
      router.push(data.redirectUrl || redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erreur de connexion avec Google.");
      setGoogleLoading(false);
    }
  }

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

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    // 1. If Clerk is active
    if (clerkActive && signIn) {
      try {
        const result = await signIn.create({
          identifier: email.trim(),
          password,
        });

        if (result.status === "complete") {
          await setActive({ session: result.createdSessionId });

          // Sync local DB session
          await fetch("/api/auth/clerk-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clerkId: result.createdUserId,
              email: email.trim(),
            }),
          }).catch(() => {});

          router.push(redirectUrl);
          router.refresh();
          return;
        } else {
          setError("Connexion supplémentaire requise (ex: code de vérification).");
          setLoading(false);
          return;
        }
      } catch (err: any) {
        console.warn("Clerk sign-in was not completed, trying local credentials:", err);
      }
    }

    // 2. Fallback to local login
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Email ou mot de passe incorrect.");
        setLoading(false);
        return;
      }

      router.push(redirectUrl);
      router.refresh();
    } catch (err: any) {
      setError(err.message || "Erreur de connexion");
      setLoading(false);
    }
  }

  // Quick fill demo credentials
  function fillDemo() {
    setEmail("demo@wcatalog.app");
    setPassword("demo1234");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm a-fade-in">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-shape-md bg-arctic-800 text-lg font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">
            J
          </span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

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

        {/* Informative mode badge */}
        {!clerkActive && !unifiedSession && (
          <div className="mb-4 rounded-shape-lg border border-amber-500/30 bg-amber-50/90 p-3 text-xs text-amber-900 shadow-sm backdrop-blur-sm dark:bg-amber-950/40 dark:text-amber-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                Mode Démo / Prêt pour Clerk
              </span>
              <button
                type="button"
                onClick={fillDemo}
                className="font-medium underline hover:text-amber-700 dark:hover:text-amber-100"
              >
                Remplir Démo
              </button>
            </div>
            <p className="mt-1 opacity-90">
              Identifiants test pré-remplissables pour tester sans clés Clerk.
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
                ou par email
              </span>
            </div>
          </div>

          <form onSubmit={handleSignIn} className="space-y-4">
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
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Mot de passe</label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-arctic-600 hover:text-arctic-900 hover:underline"
                >
                  Oublié ?
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

            <button className="btn-primary w-full" disabled={loading}>
              {loading ? "Connexion en cours…" : "Accéder à ma boutique"}
            </button>
          </form>

          <p className="a-body-sm mt-6 text-center text-arctic-600">
            Vous n'avez pas encore de boutique ?{" "}
            <Link
              href="/signup"
              className="font-semibold text-arctic-900 underline hover:text-black"
            >
              Créer ma boutique
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
