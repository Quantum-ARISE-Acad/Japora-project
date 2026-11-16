"use client";

import { useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function UnverifiedBanner({ email }: { email: string }) {
  const { tr } = usePublicLang();
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
      setError(data.error || tr("Échec du renvoi.", "Could not resend."));
    }
  }

  return (
    <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <span className="mr-3">
        📬{" "}
        {tr(
          <>
            Veuillez vérifier <strong>{email}</strong> pour garder votre boutique active.
          </>,
          <>
            Please verify <strong>{email}</strong> to keep your shop active.
          </>,
        )}
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="font-semibold underline hover:no-underline disabled:opacity-60"
      >
        {sending
          ? tr("Envoi…", "Sending…")
          : sent
            ? tr("Envoyé ✓", "Sent ✓")
            : tr("Renvoyer l'e-mail", "Resend email")}
      </button>
      {error && <span className="ml-3 text-red-700">{error}</span>}
    </div>
  );
}
