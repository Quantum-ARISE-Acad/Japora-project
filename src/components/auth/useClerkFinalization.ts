"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeClerkAuthentication } from "@/lib/clerk-auth-finalize";

type FinalizeInput = {
  sessionId?: string | null;
  setActive?: (params: { session: string }) => Promise<unknown>;
  payload?: Record<string, unknown>;
};

export function useClerkFinalization(redirectTo = "/dashboard") {
  const router = useRouter();
  const inFlightRef = useRef(false);
  const completedRef = useRef(false);
  const [error, setError] = useState("");

  const finalize = useCallback(async (input: FinalizeInput = {}): Promise<boolean> => {
    if (completedRef.current) return true;
    if (inFlightRef.current) return false;

    inFlightRef.current = true;
    setError("");
    try {
      await finalizeClerkAuthentication({
        ...input,
        redirectTo,
        router,
      });
      completedRef.current = true;
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to finish signing in.");
      return false;
    } finally {
      inFlightRef.current = false;
    }
  }, [redirectTo, router]);

  return { finalize, error, clearError: () => setError("") };
}
