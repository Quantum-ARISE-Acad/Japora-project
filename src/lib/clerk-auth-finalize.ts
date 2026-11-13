export interface ClerkFinalizeOptions {
  sessionId?: string | null;
  setActive?: (params: { session: string }) => Promise<unknown>;
  payload?: Record<string, unknown>;
  redirectTo?: string;
  router?: {
    replace: (url: string) => void;
    refresh: () => void;
  };
  fetcher?: typeof fetch;
  retryDelayMs?: number;
}

export interface ClerkSyncResponse {
  ok: true;
  vendorId?: string;
  shopSlug?: string;
}

/** Activate (when supplied), sync the authenticated Clerk user, then redirect. */
export async function finalizeClerkAuthentication({
  sessionId,
  setActive,
  payload = {},
  redirectTo = "/dashboard",
  router,
  fetcher = fetch,
  retryDelayMs = 250,
}: ClerkFinalizeOptions): Promise<ClerkSyncResponse> {
  if (sessionId) {
    if (!setActive) throw new Error("Clerk session activation is unavailable.");
    await setActive({ session: sessionId });
  }

  let lastError = "Unable to synchronize your Japora account.";
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetcher("/api/auth/clerk-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "same-origin",
      });
      const data = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        vendorId?: string;
        shopSlug?: string;
      };

      if (response.ok && data.ok === true) {
        if (router) {
          router.replace(redirectTo);
          router.refresh();
        }
        return { ok: true, vendorId: data.vendorId, shopSlug: data.shopSlug };
      }

      lastError = data.error || `Account synchronization failed (${response.status}).`;
      if (response.status !== 401 || attempt === 1) break;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Network error during account synchronization.";
      if (attempt === 1) break;
    }

    if (retryDelayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  throw new Error(lastError);
}
