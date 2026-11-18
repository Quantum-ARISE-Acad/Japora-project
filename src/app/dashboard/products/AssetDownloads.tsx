"use client";

import { useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * Per-product share kit. WhatsApp has no API to post to Status for you, so the
 * honest flow is: download the ready-made card, copy a caption, open WhatsApp,
 * and add it to your Status. We make those three taps frictionless.
 *
 * The status card is the hero (1080×1920); IG/TikTok formats round it out.
 */

type Props = {
  productId: string;
  productName: string;
  priceText?: string;
  shopSlug?: string;
};

const FORMATS: Array<{ key: "status" | "ig" | "tiktok"; label: string; hint: string }> = [
  { key: "status", label: "WhatsApp Status", hint: "1080×1920" },
  { key: "ig", label: "Instagram", hint: "1080×1080" },
  { key: "tiktok", label: "TikTok", hint: "1080×1920" },
];

export default function AssetDownloads({ productId, productName, priceText, shopSlug }: Props) {
  const { tr } = usePublicLang();
  const [copied, setCopied] = useState(false);
  const safeSlug =
    productName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) ||
    "product";

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const catalogUrl = shopSlug ? `${base}/c/${shopSlug}` : "";
  const caption =
    `${productName}${priceText ? ` — ${priceText}` : ""}\n` +
    `DM to order 📦${catalogUrl ? `\nShop: ${catalogUrl}` : ""}`;

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — no-op
    }
  }

  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="self-center a-label-md text-arctic-600">{tr("Partager", "Share")}</span>
        {FORMATS.map((f) => (
          <a
            key={f.key}
            href={`/api/products/${productId}/asset/${f.key}`}
            download={`japora-${safeSlug}-${f.key}.svg`}
            className={
              "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold transition " +
              (f.key === "status"
                ? "border-arctic-800 bg-arctic-800 text-arctic-50 hover:bg-arctic-900"
                : "border-arctic-400/45 bg-white/70 text-arctic-800 hover:bg-arctic-100/70")
            }
          >
            {f.label}
            <span className="text-[10px] font-normal opacity-70">{f.hint}</span>
          </a>
        ))}
        <button
          onClick={copyCaption}
          className="rounded-full border border-arctic-400/45 bg-white/70 px-2.5 py-1 text-xs font-semibold text-arctic-800 hover:bg-arctic-100/70"
        >
          {copied ? tr("Légende copiée ✓", "Caption copied ✓") : tr("Copier légende", "Copy caption")}
        </button>
      </div>
      <p className="a-label-md text-arctic-500">
        {tr(
          "Télécharger → ouvrir WhatsApp → Statut → ajouter l'image et coller la légende.",
          "Download → open WhatsApp → Status → add the image & paste the caption.",
        )}
      </p>
    </div>
  );
}
