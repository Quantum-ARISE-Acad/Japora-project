"use client";

import { AuthenticateWithRedirectCallback, useAuth } from "@clerk/nextjs";
import { isClerkConfigured } from "@/components/auth/ClerkAuthProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useClerkFinalization } from "@/components/auth/useClerkFinalization";

export default function SsoCallbackPage() {
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
        <p className="text-sm text-arctic-600">Redirection vers le tableau de bord...</p>
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
          <p>Authentication succeeded, but Japora could not finish setting up your account: {finalizationError}</p>
          <button type="button" className="btn-primary" onClick={() => void finalize()}>
            Retry account setup
          </button>
        </div>
      ) : (
        <p className="text-sm text-arctic-600">Finishing sign-in…</p>
      )}
      <div id="clerk-captcha" />
    </div>
  );
}
