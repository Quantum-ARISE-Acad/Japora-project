"use client";

import { useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph from "@/components/Glyph";

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
      setError(data.error || tr("Impossible de renvoyer le message.", "Could not resend."));
    }
  }

  return (
    <div className="border-b border-aurora-warning/30 bg-aurora-warning-bg px-4 py-2 text-center text-sm text-aurora-warning-text">
      <span className="mr-3">
        <Glyph name="mail" size={14} /> {tr("Veuillez vérifier", "Please verify")} <strong>{email}</strong> {tr("pour garder votre boutique active.", "to keep your shop active.")}
      </span>
      <button
        onClick={resend}
        disabled={sending}
        className="font-semibold underline hover:no-underline disabled:opacity-60"
      >
        {sending ? tr("Envoi…", "Sending…") : sent ? tr("Envoyé", "Sent") : tr("Renvoyer l’e-mail", "Resend email")}
      </button>
      {error && <span className="ml-3 text-aurora-error-text">{error}</span>}
    </div>
  );
}
