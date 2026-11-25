"use client";

import { errorMessage } from "@/lib/errors";

import { useState } from "react";
import Link from "next/link";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph from "@/components/Glyph";

export default function EmailVerificationBanner({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const { tr } = usePublicLang();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (verified) return null;

  async function handleResend() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/resend-verification", {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || tr("Impossible d'envoyer l'email de vérification.", "Could not send the verification email."));
      } else {
        setSent(true);
        if (data.verifyUrl) {
          setVerifyUrl(data.verifyUrl);
        }
      }
    } catch (err) {
      setError(errorMessage(err, "Erreur réseau."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-shape-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950 backdrop-blur-glass-thin dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <Glyph name="alert" size={20} />
          <div>
            <h3 className="text-sm font-semibold">
              {tr("Votre adresse email n'est pas encore vérifiée (", "Your email address is not verified yet (")}{email})
            </h3>
            <p className="mt-0.5 text-xs opacity-90">
              {tr("La vérification protège votre boutique et vous permet de recevoir les notifications de commandes.", "Verification protects your shop and lets you receive order notifications.")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sent ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {tr("Email envoyé !", "Email sent!")}
              </span>
              {verifyUrl && (
                <Link
                  href={verifyUrl}
                  className="rounded-shape-md bg-aurora-warning px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                >
                  {tr("Valider maintenant (Démo)", "Verify now (demo)")}
                </Link>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="rounded-shape-md bg-aurora-warning px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50"
            >
              {loading ? tr("Envoi en cours…", "Sending…") : tr("Renvoyer l'email de confirmation", "Resend the confirmation email")}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
