"use client";

import { useEffect, useRef } from "react";
import Glyph from "@/components/Glyph";

/**
 * Hero preview — a stylized "live order coming in" card. Floats in the
 * aurora mesh with a slow drift animation; the NEW badge gets a soft pulse
 * to convey "your bot is awake right now". Pure SVG + CSS for perf.
 *
 * Entry choreography: when the component mounts, anime.js (lazy-imported)
 * runs a staggered rise of the inner rows. If anime fails to load, CSS
 * keyframes still play. First-paint cost: 0kb of anime — it only loads
 * after hydrate.
 */
export default function AuroraHeroPreview() {
  const ref = useRef<HTMLDivElement>(null);

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
        // CSS `.a-rise-in` already provides a baseline animation.
        rows.forEach((el) => el.classList.add("a-rise-in"));
      });
  }, []);

  return (
    <div ref={ref} className="relative" style={{ animation: "a-aurora-drift 6s ease-in-out infinite" }}>
      {/* Soft aurora ring behind the card */}
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[40px] opacity-70 blur-2xl"
        style={{
          background:
            "radial-gradient(closest-side, rgb(var(--gold) / 0.28), rgb(var(--c-300) / 0.35) 60%, transparent)",
        }}
      />

      <div className="glass glass-edge rounded-shape-xl p-5">
        {/* Window chrome */}
        <div data-rise className="mb-4 flex items-center gap-2 text-[10px] text-arctic-700">
          <span className="h-2 w-2 rounded-full bg-arctic-400/60" />
          <span className="h-2 w-2 rounded-full bg-arctic-400/60" />
          <span className="h-2 w-2 rounded-full bg-arctic-400/60" />
          <span className="ml-2 tracking-[0.06em]">japora.app/c/adas-fashion</span>
        </div>

        {/* Live incoming order — the headline moment of M3 Expressive */}
        <div
          data-rise
          className="relative mb-3 flex items-center gap-3 rounded-shape-md border border-white/70 bg-white/55 p-3 backdrop-blur-glass-thin"
        >
          <span
            aria-hidden
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-arctic-800 text-[11px] font-bold text-arctic-50"
          >
            CO
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="a-label-md text-arctic-900">Chioma O.</span>
              <span className="a-pulse rounded-full bg-arctic-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-arctic-900">
                NEW
              </span>
            </div>
            <div className="a-body-sm truncate text-arctic-700">
              2× Ankara Maxi · M
            </div>
          </div>
          <div className="text-right">
            <div className="a-num a-label-lg font-display font-semibold text-brand-dark">₦37,000</div>
            <div className="a-body-sm text-arctic-600">just now</div>
          </div>
        </div>

        {/* Status row — mini kanban */}
        <div data-rise className="grid grid-cols-4 gap-1.5 text-center">
          {[
            { k: "New", n: 4, on: true },
            { k: "Confirmed", n: 2, on: false },
            { k: "Paid", n: 5, on: false },
            { k: "Delivered", n: 11, on: false },
          ].map((c) => (
            <div
              key={c.k}
              className={
                "rounded-shape-sm border px-2 py-1.5 " +
                (c.on
                  ? "border-arctic-800 bg-arctic-800 text-arctic-50"
                  : "border-arctic-400/40 bg-white/55 text-arctic-800")
              }
            >
              <div className="a-label-md leading-3">{c.k}</div>
              <div className="a-label-md leading-4 opacity-80">{c.n}</div>
            </div>
          ))}
        </div>

        {/* Hustle summary stub */}
        <div
          data-rise
          className="mt-3 flex items-center justify-between rounded-shape-md border border-arctic-400/35 bg-arctic-200/55 px-3 py-2 backdrop-blur-glass-thin"
        >
          <div className="a-body-sm inline-flex items-center gap-1.5 text-arctic-800">
            <Glyph name="moon" size={15} className="text-brand-dark" /> 6 PM summary ready
          </div>
          <div className="a-label-md text-arctic-700">tonight</div>
        </div>
      </div>
    </div>
  );
}
