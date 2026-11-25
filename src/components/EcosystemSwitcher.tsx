"use client";

import { useEffect, useRef, useState } from "react";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph, { type GlyphName } from "@/components/Glyph";

export interface PlatformItem {
  id: "japora" | "soko" | "wescrow";
  name: string;
  badge: string;
  tagline: string;
  icon: string;
  href: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PLATFORMS: PlatformItem[] = [
  {
    id: "japora",
    name: "Japora",
    badge: "Boutiques",
    tagline: "Vente en ligne, gestion de stocks & commandes vendeurs",
    icon: "bag",
    href: "http://localhost:5174/dashboard",
    color: "text-emerald-700 dark:text-emerald-400",
    bgColor: "bg-emerald-500/10 dark:bg-emerald-500/20",
    borderColor: "border-emerald-500/30",
  },
  {
    id: "soko",
    name: "Soko CRM",
    badge: "WhatsApp CRM",
    tagline: "Capture d'opportunités, matching acheteur/vendeur & closing",
    icon: "chat",
    href: "http://localhost:5173",
    color: "text-amber-700 dark:text-amber-400",
    bgColor: "bg-amber-500/10 dark:bg-amber-500/20",
    borderColor: "border-amber-500/30",
  },
  {
    id: "wescrow",
    name: "WEscrow",
    badge: "Safe Hands",
    tagline: "Paiements sous séquestre sécurisé & résolution de litiges",
    icon: "shield",
    href: "http://localhost:3000",
    color: "text-indigo-700 dark:text-indigo-400",
    bgColor: "bg-indigo-500/10 dark:bg-indigo-500/20",
    borderColor: "border-indigo-500/30",
  },
];

export default function EcosystemSwitcher({
  current = "japora",
}: {
  current?: "japora" | "soko" | "wescrow";
}) {
  const { tr } = usePublicLang();
  const [open, setOpen] = useState(false);
  const [navigatingId, setNavigatingId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleNavigate = async (e: React.MouseEvent, p: PlatformItem) => {
    if (p.id === current) return;
    e.preventDefault();
    setNavigatingId(p.id);

    try {
      const res = await fetch("/api/auth/sso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetApp: p.id }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.ticket) {
          if (p.id === "wescrow") {
            window.location.href = `http://localhost:3000/api/auth/sso?ticket=${data.ticket}&redirect=/dashboard`;
            return;
          } else if (p.id === "soko") {
            window.location.href = `http://localhost:5173/?sso_ticket=${data.ticket}`;
            return;
          }
        }
      }
    } catch {
      // Fallback
    }
    window.location.href = p.href;
  };

  return (
    <div className="relative inline-block text-left" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={tr("Changer de plateforme dans la suite Wataru", "Switch platform in the Wataru suite")}
        className="inline-flex h-9 sm:h-10 items-center gap-2 rounded-shape-full border border-arctic-400/40 bg-arctic-50/70 px-3 text-xs font-semibold text-arctic-700 backdrop-blur-sm transition-all hover:border-brand hover:bg-arctic-100 hover:text-arctic-900"
      >
        <Glyph name="globe" size={18} />
        <span className="hidden md:inline">{tr("Écosystème", "Ecosystem")}</span>
        <span className="text-[10px] uppercase font-bold tracking-wider text-brand px-1.5 py-0.2 bg-brand/10 rounded">
          Suite
        </span>
        <svg
          className={`h-3.5 w-3.5 text-arctic-600 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border border-arctic-300/80 bg-white/95 p-3 shadow-2xl backdrop-blur-xl z-50 dark:bg-slate-900/95 dark:border-slate-700 a-rise-in">
          <div className="mb-2 px-2 py-1 flex items-center justify-between border-b border-arctic-200/60 pb-2 dark:border-slate-800">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-arctic-400 dark:text-slate-400">
                {tr("Suite Wataru Commerce", "Wataru Commerce suite")}
              </p>
              <p className="text-xs font-semibold text-arctic-800 dark:text-white">
                {tr("Plateformes Interconnectées", "Connected platforms")}
              </p>
            </div>
            <span className="text-[10px] rounded-full bg-emerald-500/10 px-2 py-0.5 font-bold text-emerald-700 dark:text-emerald-400 border border-emerald-500/20">
              {tr("Synchro Active", "Sync active")}
            </span>
          </div>

          <div className="space-y-1.5">
            {PLATFORMS.map((p) => {
              const isCurrent = p.id === current;
              const isNavigating = navigatingId === p.id;
              return (
                <a
                  key={p.id}
                  href={p.href}
                  onClick={(e) => handleNavigate(e, p)}
                  className={`group flex items-start gap-3 rounded-xl p-2.5 transition-all cursor-pointer ${
                    isCurrent
                      ? "bg-brand/10 border border-brand/40 shadow-xs"
                      : "hover:bg-arctic-100 dark:hover:bg-slate-800/80 border border-transparent"
                  }`}
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl ${p.bgColor} border ${p.borderColor}`}
                  >
                    <Glyph name={isNavigating ? "clock" : (p.icon as GlyphName)} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-sm font-bold text-arctic-900 dark:text-white group-hover:text-brand transition-colors">
                        {p.name}
                      </p>
                      {isCurrent ? (
                        <span className="rounded-full bg-gold-fill px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                          {tr("Actuel", "Current")}
                        </span>
                      ) : isNavigating ? (
                        <span className="rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold animate-pulse">
                          {tr("Connexion SSO…", "SSO sign-in…")}
                        </span>
                      ) : (
                        <span className="text-[10px] font-medium text-arctic-600 dark:text-slate-400">
                          {p.badge} ↗
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] leading-snug text-arctic-600 dark:text-slate-400 line-clamp-2">
                      {isNavigating ? tr("Transfert de session sécurisé vers ", "Secure session transfer to ") + p.name + "…" : p.tagline}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>

          <div className="mt-2.5 pt-2 border-t border-arctic-200/50 dark:border-slate-800 px-2 flex items-center justify-between text-[11px] text-arctic-600 dark:text-slate-400">
            <span>{tr("Flux de données unifié", "Unified data flow")}</span>
            <span className="text-brand font-medium">Japora ↔ Soko ↔ WEscrow</span>
          </div>
        </div>
      )}
    </div>
  );
}
