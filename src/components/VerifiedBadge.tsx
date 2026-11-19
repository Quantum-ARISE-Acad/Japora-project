"use client";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * "Verified shop" badge — Japora's trust signal. Pure presentational; render it
 * wherever a shop name appears publicly (catalog header, marketplace card).
 */

export default function VerifiedBadge({
  size = "md",
  withLabel = true,
  className = "",
}: {
  size?: "sm" | "md";
  withLabel?: boolean;
  className?: string;
}) {
  const { tr } = usePublicLang();
  const dim = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  return (
    <span
      className={
        "inline-flex items-center gap-1 align-middle text-sky-600 " + className
      }
      title={tr("Boutique vérifiée — WhatsApp confirmé et commandes honorées", "Verified shop — WhatsApp confirmed and orders fulfilled")}
    >
      <svg viewBox="0 0 24 24" className={dim} fill="currentColor" aria-hidden>
        <path d="M12 1.6l2.4 1.8 3 .1 1 2.8 2.4 1.7-.8 2.9.8 2.9-2.4 1.7-1 2.8-3 .1L12 22.4l-2.4-1.8-3-.1-1-2.8L3.2 16l.8-2.9-.8-2.9 2.4-1.7 1-2.8 3-.1L12 1.6z" />
        <path d="M10.6 14.6l-2.2-2.2-1.3 1.3 3.5 3.5 6-6-1.3-1.3-4.7 4.7z" fill="#fff" />
      </svg>
      {withLabel && (
        <span className={(size === "sm" ? "text-xs" : "text-sm") + " font-semibold"}>{tr("Vérifiée", "Verified")}</span>
      )}
    </span>
  );
}
