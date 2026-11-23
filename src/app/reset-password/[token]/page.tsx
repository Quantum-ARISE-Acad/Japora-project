"use client";

import { useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { tr } = usePublicLang();
  const { token } = use(params);
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirm) {
      setError(tr("Les mots de passe ne correspondent pas.", "Passwords don't match."));
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || tr("Impossible de réinitialiser le mot de passe.", "Could not reset password."));
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 1500);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm a-fade-in">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-shape-md bg-arctic-800 text-lg font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        <div className="glass glass-edge rounded-shape-xl p-6">
          {done ? (
            <div className="space-y-2 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-arctic-200/80 text-2xl backdrop-blur-glass-thin a-pulse">✅</div>
              <h1 className="a-headline-sm text-arctic-900">{tr("Mot de passe mis à jour", "Password updated")}</h1>
              <p className="a-body-md text-arctic-600">{tr("Redirection vers la connexion…", "Redirecting you to sign in…")}</p>
            </div>
          ) : (
            <>
              <h1 className="a-headline-sm text-arctic-900">{tr("Choisir un nouveau mot de passe", "Set a new password")}</h1>
              <p className="a-body-md mt-1 text-arctic-600">
                8+ characters. Mix letters and numbers.
              </p>
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="label">{tr("Nouveau mot de passe", "New password")}</label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="label">{tr("Confirmer le nouveau mot de passe", "Confirm new password")}</label>
                  <input
                    className="input"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
                {error && (
                  <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">{error}</p>
                )}
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? tr("Enregistrement…", "Saving…") : tr("Mettre à jour le mot de passe", "Update password")}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
