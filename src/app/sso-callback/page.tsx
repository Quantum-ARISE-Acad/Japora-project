"use client";

import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { isClerkConfigured } from "@/components/auth/ClerkAuthProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerkFinalization } from "@/components/auth/useClerkFinalization";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function SsoCallbackPage() {
  const { tr } = usePublicLang();
  const router = useRouter();
  const clerkActive = isClerkConfigured();
  const { finalize, error: finalizationError } = useClerkFinalization("/dashboard");

  let authState: { isLoaded?: boolean; isSignedIn?: boolean; userId?: string | null } | null = null;
  try {
    if (clerkActive) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      authState = useAuth();
    }
  } catch {
    authState = null;
  }

  useEffect(() => {
    if (!clerkActive) {
      router.replace("/login");
      return;
    }
    if (authState?.isLoaded && authState?.isSignedIn && authState?.userId) {
      void finalize();
    }
  }, [clerkActive, authState?.isLoaded, authState?.isSignedIn, authState?.userId, finalize, router]);

  if (!clerkActive) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-arctic-600">{tr("Redirection vers le tableau de bord...", "Redirecting to the dashboard...")}</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3">
      <AuthenticateWithRedirectCallback
        continueSignUpUrl="/signup"
        signInForceRedirectUrl="/sso-callback?finalize=1"
        signUpForceRedirectUrl="/sso-callback?finalize=1"
      />
      {finalizationError ? (
        <div role="alert" className="mx-4 max-w-md space-y-3 rounded-shape-md border border-red-300 bg-red-50 p-4 text-sm text-red-800">
          <p>{tr("L'authentification a réussi, mais Japora n'a pas pu terminer la création de votre compte :", "Authentication succeeded, but Japora could not finish setting up your account:")} {finalizationError}</p>
          <button type="button" className="btn-primary" onClick={() => void finalize()}>
            {tr("Réessayer la création du compte", "Retry account setup")}
          </button>
        </div>
      ) : (
        <p className="text-sm text-arctic-600">{tr("Connexion en cours…", "Finishing sign-in…")}</p>
      )}
      <div id="clerk-captcha" />
    </div>
  );
}
