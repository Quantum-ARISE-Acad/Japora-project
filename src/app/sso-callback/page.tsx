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
        <p className="text-sm text-arctic-600">Redirection vers le tableau de bord...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <AuthenticateWithRedirectCallback
        continueSignUpUrl="/signup"
        signInForceRedirectUrl="/dashboard"
        signUpForceRedirectUrl="/dashboard"
      />
    </div>
  );
}
