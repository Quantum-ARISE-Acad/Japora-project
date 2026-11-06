"use client";

import { useState } from "react";

export default function BillingActions({
  hasSubscription,
  priceDisplay,
}: {
  hasSubscription: boolean;
  priceDisplay: string;
}) {
  const [loading, setLoading] = useState<"" | "checkout" | "portal">("");
  const [error, setError] = useState("");

  async function go(path: "checkout" | "portal") {
    setLoading(path);
    setError("");
    const res = await fetch(`/api/billing/${path}`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) {
      setLoading("");
      setError(data.error || "Could not open Stripe.");
      return;
    }
    window.location.href = data.url;
  }

  return (
    <div className="space-y-3">
      {hasSubscription ? (
        <button onClick={() => go("portal")} className="btn-primary w-full" disabled={loading !== ""}>
          {loading === "portal" ? "Opening…" : "Manage subscription"}
        </button>
      ) : (
        <button onClick={() => go("checkout")} className="btn-primary w-full" disabled={loading !== ""}>
          {loading === "checkout" ? "Opening Stripe…" : `Subscribe — ${priceDisplay}`}
        </button>
      )}
      {hasSubscription && (
        <button onClick={() => go("checkout")} className="btn-ghost w-full" disabled={loading !== ""}>
          {loading === "checkout" ? "Opening…" : "Start a new subscription"}
        </button>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
