"use client";

import { useState } from "react";
import Glyph from "@/components/Glyph";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * "Follow for new drops" — a customer opts into a shop's new-stock alerts with
 * just their WhatsApp number. The repeat-business loop WhatsApp Channels hint
 * at, but tied to the shop's actual catalog.
 */
export default function FollowButton({
  shopSlug,
  shopName,
}: {
  shopSlug: string;
  shopName: string;
}) {
  const { tr } = usePublicLang();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/follow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shopSlug, phone }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error || tr("Impossible de suivre cette boutique.", "Could not follow this shop."));
      return;
    }
    setDone(data.message || tr(`Vous recevrez les nouveautés de ${shopName}.`, `You'll hear from ${shopName} when new stock drops.`));
  }

  if (done) {
    return (
      <span className="a-label-md inline-flex items-center gap-1.5 rounded-shape-full border border-arctic-400/45 bg-arctic-200/65 px-3 py-1.5 text-arctic-800 backdrop-blur-glass-thin">
        <Glyph name="bell" size={14} className="text-brand-dark" /> {tr("Abonné", "Following")}
      </span>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost shrink-0 gap-1.5">
        <Glyph name="bell" size={15} /> {tr("Suivre", "Follow")}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <input
        className="input !min-h-0 w-44 py-2"
        inputMode="tel"
        placeholder={tr("Votre numéro WhatsApp", "Your WhatsApp number")}
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        required
        autoFocus
      />
      <button className="btn-primary btn-sm" disabled={loading}>
        {loading ? "…" : tr("Suivre", "Follow")}
      </button>
      {error && <span className="a-body-sm text-red-600">{error}</span>}
    </form>
  );
}
