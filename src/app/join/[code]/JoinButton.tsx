"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** One-click join for an already-logged-in vendor. */
export default function JoinButton({ code, coopName }: { code: string; coopName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function join() {
    setLoading(true);
    setError("");
    const res = await fetch("/api/cooperative/join", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not join.");
      return;
    }
    router.push("/dashboard/settings");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button onClick={join} disabled={loading} className="btn-primary w-full">
        {loading ? "Joining…" : `Join ${coopName}`}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
