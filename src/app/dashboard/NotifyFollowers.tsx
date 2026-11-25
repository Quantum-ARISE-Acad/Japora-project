"use client";

import { useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph from "@/components/Glyph";

/**
 * "Tell your followers" — one WhatsApp blast to everyone who opted in for new
 * drops. Distinct from broadcasts (which target past customers).
 */
export default function NotifyFollowers({ followerCount }: { followerCount: number }) {
  const { tr } = usePublicLang();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");

  async function send() {
    setSending(true);
    setResult("");
    const res = await fetch("/api/followers/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) {
      setResult(data.error || tr("Échec de l'envoi.", "Could not send."));
      return;
    }
    setResult(
      tr(
        `Envoyé à ${data.sent} abonné${data.sent === 1 ? "" : "s"}.`,
        `Sent to ${data.sent} follower${data.sent === 1 ? "" : "s"}.`,
      ),
    );
    setMessage("");
    setOpen(false);
  }

  return (
    <div className="glass glass-edge rounded-shape-lg p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="a-label-md text-arctic-700">{tr("Abonnés", "Followers")}</div>
          <div className="a-display-sm text-arctic-900">{followerCount}</div>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="btn-ghost"
          disabled={followerCount === 0}
        >
          <Glyph name="megaphone" size={14} /> {tr("Nouvel arrivage", "New drop")}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <textarea
            className="input min-h-[64px]"
            placeholder={tr(
              "Nouvel arrivage disponible en boutique — répondez pour réserver le vôtre.",
              "Fresh stock just landed — reply to reserve yours.",
            )}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
          />
          <button onClick={send} disabled={sending || !message.trim()} className="btn-primary">
            {sending
              ? tr("Envoi…", "Sending…")
              : tr(`Envoyer à ${followerCount}`, `Send to ${followerCount}`)}
          </button>
        </div>
      )}

      {result && <p className="mt-2 a-body-sm text-arctic-700">{result}</p>}
    </div>
  );
}
