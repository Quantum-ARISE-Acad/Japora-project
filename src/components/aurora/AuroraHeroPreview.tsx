"use client";

import { useEffect, useRef, useState } from "react";
import Glyph from "@/components/Glyph";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * Hero preview — a stylized "live WhatsApp shop + order coming in" showcase.
 * Interactive tabs allow switching between:
 *  1) Live Order & Kanban (Tableau de bord)
 *  2) WhatsApp Bot Conversation (Chat IA)
 *  3) 6 PM Hustle Summary (Bilan du soir)
 */
export default function AuroraHeroPreview() {
  const { tr } = usePublicLang();
  const ref = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"orders" | "bot" | "summary">("orders");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const root = ref.current;
    if (!root) return;
    const rows = root.querySelectorAll<HTMLElement>("[data-rise]");
    if (rows.length === 0) return;

    import("animejs")
      .then(({ animate, stagger }) => {
        animate(rows, {
          opacity: [0, 1],
          translateY: [12, 0],
          duration: 520,
          delay: stagger(70, { start: 120 }),
          ease: "outQuint",
        });
      })
      .catch(() => {
        rows.forEach((el) => el.classList.add("a-rise-in"));
      });
  }, []);

  return (
    <div
      ref={ref}
      className="relative"
      style={{ animation: "a-aurora-drift 6s ease-in-out infinite" }}
    >
      {/* Soft aurora ring behind the card */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-shape-xl opacity-75 blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--gold) / 0.30), rgb(var(--c-300) / 0.38) 60%, transparent)",
        }}
      />

      {/* Floating Live Payment Notification Badge */}
      <div
        data-rise
        className="mb-3 flex items-center justify-between gap-3 rounded-shape-full border border-emerald-500/30 bg-white/85 px-4 py-2 shadow-elev-2 backdrop-blur-md"
      >
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-ping rounded-full bg-emerald-500" />
          <span className="text-xs font-bold text-arctic-900">
            {tr("Paiement T-Money confirmé", "T-Money payment confirmed")}
          </span>
        </div>
        <span className="a-num text-xs font-bold text-emerald-700">
          +18 500 FCFA · Payé
        </span>
      </div>

      <div className="glass glass-edge rounded-shape-xl p-5 shadow-elev-3">
        {/* Window chrome + Mode Switcher */}
        <div
          data-rise
          className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-arctic-200/60 pb-3 text-[11px] text-arctic-700"
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/70" />
            <span className="ml-1.5 font-mono text-[10px] tracking-wide text-arctic-600">
              japora.app/c/adas-fashion
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-arctic-100/80 p-0.5">
            {[
              { id: "orders", label: "Commandes" },
              { id: "bot", label: "Bot WhatsApp" },
              { id: "summary", label: "Bilan 18h" },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id as "orders" | "bot" | "summary")}
                className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all ${
                  activeTab === t.id
                    ? "bg-arctic-900 text-arctic-50 shadow-sm"
                    : "text-arctic-600 hover:text-arctic-900"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {activeTab === "orders" && (
          <div className="space-y-3 a-fade-in">
            {/* Live incoming order */}
            <div
              data-rise
              className="relative flex items-center gap-3 rounded-shape-md border border-white/70 bg-white/70 p-3.5 shadow-sm backdrop-blur-glass-thin"
            >
              <span
                aria-hidden
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-arctic-900 text-xs font-bold text-arctic-50"
              >
                AM
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="a-label-md font-bold text-arctic-900">Afiwa M.</span>
                  <span className="a-pulse rounded-full bg-emerald-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-800">
                    NOUVEAU
                  </span>
                </div>
                <div className="a-body-sm truncate text-arctic-700">
                  2× Robe Ankara Maxi (Taille M) · Lomé Centre
                </div>
              </div>
              <div className="text-right">
                <div className="a-num a-label-lg font-display font-bold text-brand-dark">
                  24 500 FCFA
                </div>
                <div className="a-body-sm text-emerald-700 font-medium">{tr("Payé T-Money", "Paid with T-Money")}</div>
              </div>
            </div>

            {/* Second incoming order */}
            <div
              data-rise
              className="relative flex items-center gap-3 rounded-shape-md border border-arctic-200/70 bg-white/45 p-3 backdrop-blur-glass-thin"
            >
              <span
                aria-hidden
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand/20 text-xs font-bold text-brand-dark"
              >
                KD
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="a-label-md text-arctic-900">Koffi D.</span>
                  <span className="rounded-full bg-arctic-200 px-1.5 py-0.5 text-[9px] font-semibold text-arctic-700">
                    Flooz
                  </span>
                </div>
                <div className="a-body-sm truncate text-arctic-600">
                  1× Chemise Lin Artisanal (L) · Agoè
                </div>
              </div>
              <div className="text-right">
                <div className="a-num text-xs font-bold text-arctic-900">12 000 FCFA</div>
                <div className="text-[10px] text-arctic-600">{tr("il y a 4 min", "4 min ago")}</div>
              </div>
            </div>

            {/* Status row — mini kanban */}
            <div data-rise className="grid grid-cols-4 gap-1.5 pt-1 text-center">
              {[
                { k: "Nouvelles", n: 4, on: true },
                { k: "Confirmées", n: 3, on: false },
                { k: "Payées", n: 9, on: false },
                { k: "Livrées", n: 18, on: false },
              ].map((c) => (
                <div
                  key={c.k}
                  className={
                    "rounded-shape-sm border px-2 py-2 " +
                    (c.on
                      ? "border-arctic-900 bg-arctic-900 text-arctic-50 shadow-sm"
                      : "border-arctic-300/60 bg-white/60 text-arctic-800")
                  }
                >
                  <div className="text-[10px] font-semibold">{c.k}</div>
                  <div className="a-num mt-0.5 text-sm font-bold">{c.n}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "bot" && (
          <div className="space-y-2.5 a-fade-in">
            <div className="rounded-shape-md bg-arctic-100/80 p-3 text-xs text-arctic-800">
              <div className="text-[10px] font-bold text-arctic-600 mb-1">
                {tr("Cliente (+228 90 •• •• 42)", "Customer (+228 90 •• •• 42)")}
              </div>
              {tr("Bonjour ! C'est combien la robe Ankara Maxi en taille M ?", "Hello! How much is the Ankara Maxi dress in size M?")}
            </div>
            <div className="ml-4 rounded-shape-md border border-brand/30 bg-brand/10 p-3 text-xs text-arctic-900">
              <div className="flex items-center justify-between text-[10px] font-bold text-brand-dark mb-1">
                <span>{tr("Bot Japora · Réponse instantanée", "Japora bot · Instant reply")}</span>
                <span>00:01s</span>
              </div>
              {tr("Bonjour ! La", "Hello! The")} <strong>{tr("Robe Ankara Maxi", "Ankara Maxi dress")}</strong> {tr("est à", "is")} <strong>12 250 FCFA</strong>{tr(". Il reste", ". There are")} <strong>4 pièces en taille M</strong>{tr(". Souhaitez-vous commander avec livraison à Lomé ?", " left. Would you like to order with delivery in Lomé?")}
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-bold text-arctic-900 shadow-xs">
                  {tr("Commander (Taille M)", "Order (size M)")}
                </span>
                <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold text-arctic-700 shadow-xs">
                  {tr("Voir tout le catalogue", "See the whole catalog")}
                </span>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-shape-sm bg-emerald-500/10 px-3 py-2 text-[11px] font-medium text-emerald-800">
              <span>{tr("Lien de paiement T-Money / Flooz envoyé automatiquement", "T-Money / Flooz payment link sent automatically")}</span>
              <span className="font-bold">24h/24</span>
            </div>
          </div>
        )}

        {activeTab === "summary" && (
          <div className="space-y-3 a-fade-in">
            <div className="rounded-shape-md border border-brand/30 bg-white/80 p-4">
              <div className="flex items-center justify-between">
                <span className="a-eyebrow">{tr("Récapitulatif WhatsApp · 18h00", "WhatsApp summary · 6:00 pm")}</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  {tr("Envoyé sur WhatsApp", "Sent on WhatsApp")}
                </span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <div className="rounded-shape-sm bg-arctic-100/70 p-2.5">
                  <div className="text-[10px] text-arctic-600">{tr("Ventes du jour", "Today's sales")}</div>
                  <div className="a-num mt-0.5 text-sm font-bold text-arctic-900">
                    148 500 F
                  </div>
                </div>
                <div className="rounded-shape-sm bg-arctic-100/70 p-2.5">
                  <div className="text-[10px] text-arctic-600">{tr("Commandes", "Orders")}</div>
                  <div className="a-num mt-0.5 text-sm font-bold text-arctic-900">
                    14 payées
                  </div>
                </div>
                <div className="rounded-shape-sm bg-arctic-100/70 p-2.5">
                  <div className="text-[10px] text-arctic-600">{tr("Top Produit", "Top product")}</div>
                  <div className="mt-0.5 truncate text-xs font-bold text-brand-dark">
                    {tr("Robe Ankara", "Ankara dress")}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-arctic-200/60 pt-2.5 text-[11px] text-arctic-700">
                <span>{tr("Alerte stock : Sac Bogolan (plus que 2 en stock)", "Stock alert: Bogolan bag (only 2 left)")}</span>
                <span className="font-semibold text-brand-dark">{tr("Gérer →", "Manage →")}</span>
              </div>
            </div>
          </div>
        )}

        {/* Hustle summary stub footer */}
        <div
          data-rise
          className="mt-3.5 flex items-center justify-between rounded-shape-md border border-arctic-400/35 bg-arctic-200/55 px-3 py-2 backdrop-blur-glass-thin"
        >
          <div className="a-body-sm inline-flex items-center gap-1.5 text-arctic-800">
            <Glyph name="moon" size={15} className="text-brand-dark" />
            <span>{tr("Bilan quotidien envoyé à 18h sur votre WhatsApp", "Daily summary sent at 6 pm on your WhatsApp")}</span>
          </div>
          <div className="a-label-md text-brand-dark">{tr("Actif", "Active")}</div>
        </div>
      </div>
    </div>
  );
}
