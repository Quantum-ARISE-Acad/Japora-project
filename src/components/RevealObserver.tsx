"use client";

import { useEffect } from "react";

/**
 * The page's choreographer. One IntersectionObserver for every [data-reveal]
 * on the page, plus the counted figures the design's thesis rests on.
 *
 * Three guarantees, in the order they matter:
 *
 * 1. Nothing is hidden until scripting is confirmed. `html.js` is set by the
 *    inline bootstrap in layout.tsx *before first paint*, so there is no flash
 *    of revealed-then-hidden content; and a reader whose JS failed gets the
 *    whole page rather than an empty one.
 * 2. A safety net reveals anything the observer missed. A guard that only
 *    works when the thing it guards is working is not a guard.
 * 3. prefers-reduced-motion skips the whole mechanism. The information is in
 *    the layout, not in the movement, so removing the movement removes
 *    nothing.
 *
 * Cost: no library, no layout reads, compositor-only properties.
 */

/** Items inside a [data-reveal-group] arrive one beat apart, so a set reads as a set. */
const STAGGER_MS = 70;
const MAX_STAGGER_MS = 420;
const SAFETY_NET_MS = 1200;
const COUNT_DUR_MS = 900;

export default function RevealObserver() {
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js");

    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const nodes = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    const counters = Array.from(
      document.querySelectorAll<HTMLElement>("[data-count]")
    );

    if (reduced) {
      nodes.forEach((el) => el.classList.add("is-revealed"));
      return;
    }

    /** Count a figure from zero to the value already written in the DOM. */
    const runCount = (el: HTMLElement) => {
      if (el.dataset.counted === "1") return;
      el.dataset.counted = "1";
      const target = Number(el.dataset.count);
      if (!Number.isFinite(target)) return;
      const prefix = el.dataset.countPrefix ?? "";
      const suffix = el.dataset.countSuffix ?? "";
      const fmt = new Intl.NumberFormat(el.dataset.countLocale || "fr-FR");
      const final = el.textContent;
      const start = performance.now();

      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / COUNT_DUR_MS);
        // ease-out quint: fast arrival, long settle — the figure lands.
        const eased = 1 - Math.pow(1 - p, 5);
        el.textContent = prefix + fmt.format(Math.round(target * eased)) + suffix;
        if (p < 1) requestAnimationFrame(tick);
        else if (final) el.textContent = final;
      };
      requestAnimationFrame(tick);
    };

    const reveal = (el: HTMLElement) => {
      if (el.classList.contains("is-revealed")) return;
      el.classList.add("is-revealed");
      if (el.hasAttribute("data-count")) runCount(el);
      el.querySelectorAll<HTMLElement>("[data-count]").forEach(runCount);
    };

    // Stagger is assigned per group, so neighbours arrive in reading order.
    document
      .querySelectorAll<HTMLElement>("[data-reveal-group]")
      .forEach((group) => {
        Array.from(group.querySelectorAll<HTMLElement>("[data-reveal]")).forEach(
          (el, i) => {
            el.style.setProperty(
              "--reveal-delay",
              `${Math.min(i * STAGGER_MS, MAX_STAGGER_MS)}ms`
            );
          }
        );
      });

    let observer: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const el = entry.target as HTMLElement;
            if (el.hasAttribute("data-reveal")) reveal(el);
            else runCount(el);
            observer?.unobserve(entry.target);
          });
        },
        // Fire a little before the element's top edge arrives, so the motion
        // finishes as the reader gets there rather than starting then.
        { rootMargin: "0px 0px -12% 0px", threshold: 0.01 }
      );
      nodes.forEach((el) => observer?.observe(el));
      // A figure outside any [data-reveal] still deserves to be counted when
      // it arrives, rather than waiting for the safety net.
      counters
        .filter((el) => !el.closest("[data-reveal]"))
        .forEach((el) => observer?.observe(el));
    } else {
      nodes.forEach(reveal);
      counters.forEach(runCount);
    }

    // The net: anything still hidden after this is revealed regardless.
    const net = window.setTimeout(() => {
      nodes.forEach(reveal);
      counters.forEach(runCount);
    }, SAFETY_NET_MS);

    return () => {
      window.clearTimeout(net);
      observer?.disconnect();
    };
  }, []);

  return null;
}
