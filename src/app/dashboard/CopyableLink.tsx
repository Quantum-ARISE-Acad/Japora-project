"use client";

import { useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";

export default function CopyableLink({ slug }: { slug: string }) {
  const { tr } = usePublicLang();
  const [copied, setCopied] = useState(false);
  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");
  const url = `${base}/c/${slug}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <code className="flex-1 truncate rounded-lg bg-arctic-200/65 px-3 py-2 text-sm text-arctic-800">
        {url}
      </code>
      <div className="flex gap-2">
        <button onClick={copy} className="btn-primary whitespace-nowrap">
          {copied ? tr("Copié !", "Copied!") : tr("Copier le lien", "Copy link")}
        </button>
        <a
          href={`/c/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost whitespace-nowrap"
        >
          {tr("Ouvrir ↗", "Open ↗")}
        </a>
      </div>
    </div>
  );
}
