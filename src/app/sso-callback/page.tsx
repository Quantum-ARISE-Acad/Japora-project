"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useClerk, useSignIn, useSignUp } from "@clerk/nextjs";
import { isClerkConfigured } from "@/components/auth/ClerkAuthProvider";

export default function SsoCallbackPage() {
  const router = useRouter();
  const clerkActive = isClerkConfigured();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const { signUp } = useSignUp();
  const hasRun = useRef(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusText, setStatusText] = useState(
    "Vérification de votre compte Google et synchronisation avec Japora…",
  );

  useEffect(() => {
    if (!clerkActive) {
      router.replace("/dashboard");
      return;
    }

    if (!clerk?.loaded || !clerk?.client || hasRun.current) {
      return;
    }

    hasRun.current = true;

    async function completeGoogleSso() {
      try {
        const clientSignIn = clerk.client.signIn;
        const clientSignUp = clerk.client.signUp;

        // Read any pending signup metadata saved before Google redirect
        let pendingMeta: Record<string, any> | null = null;
        if (typeof window !== "undefined") {
          try {
            const raw = sessionStorage.getItem("japora_pending_signup");
            if (raw) {
              pendingMeta = JSON.parse(raw);
            }
          } catch {
            // ignore
          }
        }

        const syncAndRedirect = async (sessionId?: string | null) => {
          setStatusText("Activation de votre session et ouverture de votre boutique…");
          if (sessionId) {
            await clerk.setActive({ session: sessionId });
          }

          const extAccount =
            clientSignUp?.verifications?.externalAccount ||
            clientSignIn?.firstFactorVerification ||
            null;

          const detectedEmail =
            clientSignUp?.emailAddress ||
            clientSignIn?.identifier ||
            (extAccount as any)?.emailAddress ||
            clerk.user?.primaryEmailAddress?.emailAddress ||
            pendingMeta?.email ||
            "";

          const firstName =
            clientSignUp?.firstName ||
            clerk.user?.firstName ||
            pendingMeta?.name?.split(" ")?.[0] ||
            "";
          const lastName =
            clientSignUp?.lastName ||
            clerk.user?.lastName ||
            pendingMeta?.name?.split(" ")?.slice(1)?.join(" ") ||
            "";

          await fetch("/api/auth/clerk-sync", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              clerkId:
                clientSignUp?.createdUserId ||
                (clientSignIn as any)?.createdUserId ||
                clerk.user?.id ||
                null,
              email: detectedEmail,
              firstName,
              lastName,
              name:
                pendingMeta?.name ||
                [firstName, lastName].filter(Boolean).join(" ") ||
                undefined,
              shopName: pendingMeta?.shopName || undefined,
              whatsappNumber: pendingMeta?.whatsappNumber || undefined,
              currency: pendingMeta?.currency || undefined,
              language: pendingMeta?.language || undefined,
              category: pendingMeta?.category || undefined,
              region: pendingMeta?.region || undefined,
              isGoogleOneClick: Boolean(pendingMeta?.isGoogleOneClick ?? true),
              authProvider: "clerk_google",
            }),
          }).catch(() => {});

          window.location.href = "/dashboard";
        };

        // 0. If Clerk already has an active session, finish immediately
        if (clerk.session?.id) {
          await syncAndRedirect(clerk.session.id);
          return;
        }

        // 1. Resolve any pending Clerk Protect challenge in-place (prevents redirect to accounts.dev/sign-up/protect-check)
        const intentParam =
          typeof window !== "undefined"
            ? new URLSearchParams(window.location.search).get("intent")
            : null;
        const flow =
          intentParam === "signIn" || intentParam === "signUp"
            ? intentParam
            : undefined;

        setStatusText("Validation de sécurité Clerk en cours…");
        await (clerk as any).__internal_resolvePendingProtectCheck?.(flow);

        // 2. Check if SignIn is already complete
        if (
          (signIn as any)?.status === "complete" ||
          clientSignIn?.status === "complete"
        ) {
          await syncAndRedirect(
            clientSignIn?.createdSessionId || (signIn as any)?.createdSessionId,
          );
          return;
        }

        // 3. If SignUp is transferable to SignIn (existing user clicked Google on /signup)
        if (
          (signUp as any)?.isTransferable ||
          clientSignUp?.verifications?.externalAccount?.status === "transferable"
        ) {
          setStatusText("Compte existant détecté, connexion en cours…");
          if (typeof (signIn as any)?.create === "function") {
            await (signIn as any).create({ transfer: true });
          } else {
            await clientSignIn.create({ transfer: true });
          }
          await (clerk as any).__internal_resolvePendingProtectCheck?.("signIn");

          if (
            (signIn as any)?.status === "complete" ||
            (clerk.client.signIn as any)?.status === "complete"
          ) {
            await syncAndRedirect(
              (clerk.client.signIn as any)?.createdSessionId ||
                (signIn as any)?.createdSessionId,
            );
            return;
          }
        }

        // 4. If SignIn is transferable to SignUp (new user clicked Google on /login)
        if (
          (signIn as any)?.isTransferable ||
          clientSignIn?.firstFactorVerification?.status === "transferable"
        ) {
          setStatusText("Création de votre compte marchand Japora…");
          const unsafeMetadata = {
            role: "seller",
            ...(pendingMeta?.shopName ? { shopName: pendingMeta.shopName } : {}),
            ...(pendingMeta?.currency ? { currency: pendingMeta.currency } : {}),
            ...(pendingMeta?.language ? { language: pendingMeta.language } : {}),
          };

          if (typeof (signUp as any)?.create === "function") {
            await (signUp as any).create({ transfer: true, unsafeMetadata });
          } else {
            await clientSignUp.create({ transfer: true, unsafeMetadata });
          }
          await (clerk as any).__internal_resolvePendingProtectCheck?.("signUp");
        }

        // 5. If SignUp still has missing_requirements (e.g. protect_check, first_name, last_name, password)
        if (clientSignUp?.status === "missing_requirements") {
          await (clerk as any).__internal_resolvePendingProtectCheck?.("signUp");

          const missing: string[] = clientSignUp.missingFields || [];
          const updatePayload: Record<string, any> = {};

          if (missing.includes("first_name") && !clientSignUp.firstName) {
            updatePayload.firstName =
              pendingMeta?.name?.split(" ")?.[0] || "Commerçant";
          }
          if (missing.includes("last_name") && !clientSignUp.lastName) {
            updatePayload.lastName =
              pendingMeta?.name?.split(" ")?.slice(1)?.join(" ") || "Japora";
          }
          if (missing.includes("password")) {
            const randomSuffix = Math.random().toString(36).slice(2, 10);
            updatePayload.password =
              pendingMeta?.password && pendingMeta.password.length >= 15
                ? pendingMeta.password
                : `Japora!Google#${randomSuffix}2026`;
          }

          if (Object.keys(updatePayload).length > 0) {
            if (typeof (signUp as any)?.update === "function") {
              await (signUp as any).update(updatePayload);
            } else {
              await clientSignUp.update(updatePayload);
            }
            await (clerk as any).__internal_resolvePendingProtectCheck?.("signUp");
          }
        }

        // 6. Check if SignUp is now complete
        if (
          (signUp as any)?.status === "complete" ||
          clientSignUp?.status === "complete" ||
          clientSignUp?.createdSessionId
        ) {
          await syncAndRedirect(
            clientSignUp?.createdSessionId || (signUp as any)?.createdSessionId,
          );
          return;
        }

        // 7. Check if an existing session was returned (identifier_already_signed_in)
        const existingSessionId =
          (signIn as any)?.existingSession?.sessionId ||
          (signUp as any)?.existingSession?.sessionId ||
          (clientSignIn?.firstFactorVerification?.error as any)?.meta?.sessionId ||
          (clientSignUp?.verifications?.externalAccount?.error as any)?.meta
            ?.sessionId ||
          clerk.client.sessions?.[0]?.id;

        if (existingSessionId) {
          await syncAndRedirect(existingSessionId);
          return;
        }

        setErrorMsg(
          "La connexion Google n'a pas pu être finalisée automatiquement. Veuillez réessayer.",
        );
      } catch (err: any) {
        const msg =
          err?.errors?.[0]?.longMessage ||
          err?.errors?.[0]?.message ||
          err?.message ||
          "Erreur lors de la connexion avec Google.";
        setErrorMsg(msg);
      }
    }

    completeGoogleSso();
  }, [clerk, clerk?.loaded, clerkActive, router, signIn, signUp]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-arctic-50 px-4">
      {!errorMsg ? (
        <>
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-arctic-200 border-t-emerald-600" />
          <div className="text-center space-y-1 max-w-md">
            <p className="text-sm font-bold text-arctic-900">
              Connexion sécurisée avec Google en cours…
            </p>
            <p className="text-xs text-arctic-600">{statusText}</p>
          </div>
        </>
      ) : (
        <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-lg space-y-4">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-700 font-bold">
            !
          </div>
          <div className="space-y-1">
            <h1 className="text-base font-bold text-arctic-900">
              Connexion Google interrompue
            </h1>
            <p className="text-xs text-arctic-600">{errorMsg}</p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Link href="/login" className="btn-primary text-xs px-4 py-2">
              Retour à la connexion
            </Link>
            <Link href="/signup" className="btn-ghost text-xs px-4 py-2">
              Créer un compte
            </Link>
          </div>
        </div>
      )}
      <div id="clerk-captcha" />
    </div>
  );
}
