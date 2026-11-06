"use client";

import { useState } from "react";

export default function UnverifiedBanner({ email }: { email: string }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function resend() {
    setSending(true);
    setError("");
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    setSending(false);
    if (res.ok) {
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Could not resend.");
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <span className="mr-3">
        📬 Please verify <strong>{email}</strong> to keep your shop active.
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="font-semibold underline hover:no-underline disabled:opacity-60"
      >
        {sending ? "Sending…" : sent ? "Sent ✓" : "Resend email"}
      </button>
      {error && <span className="ml-3 text-red-700">{error}</span>}
    </div>
  );
}
