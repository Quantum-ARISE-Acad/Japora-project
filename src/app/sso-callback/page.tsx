"use client";

import { AuthenticateWithRedirectCallback } from "@clerk/nextjs";
import { isClerkConfigured } from "@/components/auth/ClerkAuthProvider";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SsoCallbackPage() {
  const router = useRouter();
  const clerkActive = isClerkConfigured();

  useEffect(() => {
    if (!clerkActive) {
      router.replace("/dashboard");
    }
  }, [clerkActive, router]);

  if (!clerkActive) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-arctic-600">
          Redirection vers votre boutique Japora…
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-arctic-200 border-t-emerald-600" />
      <div className="text-center space-y-1">
        <p className="text-sm font-bold text-arctic-900">
          Connexion sécurisée avec Google en cours…
        </p>
        <p className="text-xs text-arctic-600">
          Synchronisation de votre profil et préparation de votre boutique Japora.
        </p>
      </div>
      <div id="clerk-captcha" />
      <AuthenticateWithRedirectCallback
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
      />
    </div>
  );
}
