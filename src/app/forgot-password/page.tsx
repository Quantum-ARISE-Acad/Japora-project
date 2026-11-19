"use client";

import { useState } from "react";
import Link from "next/link";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function ForgotPasswordPage() {
  const { tr } = usePublicLang();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    setSubmitted(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm a-fade-in">
        <Link href="/" className="group mb-8 flex items-center justify-center gap-2.5">
          <span className="grid h-10 w-10 place-items-center rounded-shape-md bg-arctic-800 text-lg font-black text-arctic-50 transition-transform duration-short ease-spring group-hover:rotate-6 group-hover:scale-105">J</span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        <div className="glass glass-edge rounded-shape-xl p-6">
          {submitted ? (
            <div className="space-y-3 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-arctic-200/80 text-2xl backdrop-blur-glass-thin">
                📬
              </div>
              <h1 className="a-headline-sm text-arctic-900">{tr("Consultez votre boîte de réception", "Check your inbox")}</h1>
              <p className="a-body-md text-arctic-700">
                {tr("Si un compte existe pour", "If an account exists for")}{" "}
                <span className="font-semibold text-arctic-900">{email}</span>{tr(", un lien de réinitialisation arrive. Il expire dans une heure.", ", a reset link is on its way. The link expires in an hour.")}
              </p>
              <Link href="/login" className="btn-ghost mt-2 w-full">
                {tr("Retour à la connexion", "Back to sign in")}
              </Link>
            </div>
          ) : (
            <>
              <h1 className="a-headline-sm text-arctic-900">{tr("Réinitialiser votre mot de passe", "Reset your password")}</h1>
              <p className="a-body-md mt-1 text-arctic-600">
                {tr("Saisissez votre e-mail. Nous vous enverrons un lien de réinitialisation.", "Type your email. We'll send a reset link.")}
              </p>
              <form onSubmit={onSubmit} className="mt-5 space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input
                    className="input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <button className="btn-primary w-full" disabled={loading}>
                  {loading ? tr("Envoi…", "Sending…") : tr("Envoyer le lien", "Send reset link")}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center a-body-sm text-arctic-600">
          {tr("Vous vous en souvenez ?", "Remembered it?")}{" "}
          <Link href="/login" className="font-semibold text-arctic-900 hover:underline">
            {tr("Se connecter", "Sign in")}
          </Link>
        </p>
      </div>
    </div>
  );
}
