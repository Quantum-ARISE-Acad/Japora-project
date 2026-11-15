"use client";

import React from "react";
import { ClerkProvider } from "@clerk/nextjs";

interface ClerkAuthProviderProps {
  children: React.ReactNode;
}

export function isClerkConfigured(): boolean {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  return Boolean(key && key.trim().length > 0 && !key.includes("your_clerk") && !key.includes("pk_test_placeholder"));
}

export default function ClerkAuthProvider({ children }: ClerkAuthProviderProps) {
  const key = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  if (!key || key.trim() === "") {
    return <>{children}</>;
  }

  return (
    <ClerkProvider
      publishableKey={key}
      signInUrl="/login"
      signUpUrl="/signup"
      signInFallbackRedirectUrl="/dashboard"
      signUpFallbackRedirectUrl="/dashboard"
      appearance={{
        variables: {
          colorPrimary: "#1A1714",
        },
      }}
    >
      {children}
    </ClerkProvider>
  );
}
