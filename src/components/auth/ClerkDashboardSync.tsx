"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { isClerkConfigured } from "./ClerkAuthProvider";

export default function ClerkDashboardSync({
  vendorId,
  needsOnboarding,
}: {
  vendorId: string;
  needsOnboarding: boolean;
}) {
  const router = useRouter();
  const syncedRef = useRef(false);
  const clerkActive = isClerkConfigured();

  let clerkUserHook: any = null;
  try {
    if (clerkActive) {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      clerkUserHook = useUser();
    }
  } catch {
    clerkUserHook = null;
  }

  const isLoaded = clerkUserHook?.isLoaded ?? true;
  const isSignedIn = clerkUserHook?.isSignedIn ?? false;
  const user = clerkUserHook?.user ?? null;

  useEffect(() => {
    if (syncedRef.current) return;
    if (clerkActive && !isLoaded) return;

    let pendingRaw: string | null = null;
    try {
      pendingRaw = sessionStorage.getItem("japora_pending_signup");
    } catch {
      pendingRaw = null;
    }

    const sessionSyncKey = `japora_clerk_synced_${vendorId}_${user?.id || "local"}`;
    const alreadySyncedThisTab =
      !pendingRaw && sessionStorage.getItem(sessionSyncKey) === "1";

    if (alreadySyncedThisTab) {
      syncedRef.current = true;
      return;
    }

    if (!isSignedIn && !pendingRaw) {
      syncedRef.current = true;
      return;
    }

    syncedRef.current = true;

    let pending: Record<string, unknown> = {};
    if (pendingRaw) {
      try {
        pending = JSON.parse(pendingRaw) as Record<string, unknown>;
      } catch {
        pending = {};
      }
    }

    const email =
      user?.primaryEmailAddress?.emailAddress ||
      user?.emailAddresses?.[0]?.emailAddress ||
      (typeof pending.email === "string" ? pending.email : "");

    if (!email && !user?.id) return;

    const hasGoogle =
      Array.isArray(user?.externalAccounts) &&
      user.externalAccounts.some((acc: any) =>
        String(acc?.provider || "").includes("google"),
      );

    fetch("/api/auth/clerk-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clerkId: user?.id || null,
        email,
        firstName: user?.firstName || null,
        lastName: user?.lastName || null,
        name:
          (typeof pending.name === "string" && pending.name) ||
          user?.fullName ||
          "",
        avatarUrl: user?.imageUrl || null,
        shopName:
          typeof pending.shopName === "string" ? pending.shopName : "",
        whatsappNumber:
          typeof pending.whatsappNumber === "string"
            ? pending.whatsappNumber
            : "",
        currency:
          typeof pending.currency === "string" ? pending.currency : "XOF",
        language:
          typeof pending.language === "string" ? pending.language : "fr",
        category:
          typeof pending.category === "string" ? pending.category : "",
        region: typeof pending.region === "string" ? pending.region : "",
        password:
          typeof pending.password === "string" ? pending.password : null,
        authProvider: hasGoogle ? "google" : "clerk_email",
        isGoogleOneClick: Boolean(pending.isGoogleOneClick) || hasGoogle,
      }),
    })
      .then((r) => r.json().catch(() => ({})))
      .then((data) => {
        try {
          sessionStorage.removeItem("japora_pending_signup");
          sessionStorage.setItem(sessionSyncKey, "1");
        } catch {
          // ignore
        }
        if (data?.needsOnboarding || needsOnboarding) {
          window.dispatchEvent(new CustomEvent("japora:open-onboarding"));
        }
        if (pendingRaw) {
          router.refresh();
        }
      })
      .catch(() => {});
  }, [clerkActive, isLoaded, isSignedIn, user, vendorId, needsOnboarding, router]);

  return null;
}

