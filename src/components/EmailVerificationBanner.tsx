"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function EmailVerificationBanner({
  email,
  verified,
}: {
  email: string;
  verified: boolean;
}) {
  const router = useRouter();
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
        setError(data.error || "Impossible d'envoyer l'email de vérification.");
      } else {
        setSent(true);
        if (data.verifyUrl) {
          setVerifyUrl(data.verifyUrl);
        }
      }
    } catch (err: any) {
      setError(err.message || "Erreur réseau.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mb-6 rounded-shape-lg border border-amber-500/30 bg-amber-500/10 p-4 text-amber-950 backdrop-blur-glass-thin dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <h3 className="text-sm font-semibold">
              Votre adresse email n'est pas encore vérifiée ({email})
            </h3>
            <p className="mt-0.5 text-xs opacity-90">
              La vérification protège votre boutique et vous permet de recevoir les notifications de commandes.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {sent ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                ✓ Email envoyé !
              </span>
              {verifyUrl && (
                <Link
                  href={verifyUrl}
                  className="rounded-shape-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition"
                >
                  ⚡ Valider maintenant (Démo)
                </Link>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="rounded-shape-md bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-700 transition disabled:opacity-50"
            >
              {loading ? "Envoi en cours…" : "Renvoyer l'email de confirmation"}
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
