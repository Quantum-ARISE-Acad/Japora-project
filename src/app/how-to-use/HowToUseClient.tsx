"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";

/**
 * "How Japora works" — an animated, scroll-driven explainer.
 *
 * anime.js (v4, lazy-imported) does the explaining: the hero rises in on load,
 * the gold "ledger line" draws itself down the page as you scroll, each numbered
 * step lifts into place when it enters the viewport, and the headline metric
 * counts up. Everything degrades gracefully: if anime fails to load or the user
 * prefers reduced motion, the final state is shown immediately (no hidden
 * content, no motion). Built on the Lumière system — Playfair display, gold
 * accents, the ledger.
 */

type Step = {
  n: string;
  title: string;
  body: string;
  icon: "shop" | "tag" | "share" | "chat" | "wallet" | "moon";
};

const STEPS: Step[] = [
  { n: "01", title: "Open your shop", body: "Phone number or email — about ninety seconds. No app to install; it runs on the WhatsApp you already use.", icon: "shop" },
  { n: "02", title: "Add what you sell", body: "Photo, price, sizes, stock. Or import your existing WhatsApp Business catalog in one tap.", icon: "tag" },
  { n: "03", title: "Share one link", body: "Drop your catalog link in your Status, bio, and market groups — or print the QR for your stall.", icon: "share" },
  { n: "04", title: "The bot answers", body: "Customers ask “how much?” and the bot replies from your live catalog, day or night. You handle the tricky ones.", icon: "chat" },
  { n: "05", title: "They pay inline", body: "T-Money, Flooz, Moov, Orange Money — settled in the chat. You see ✓ Paid the moment the money clears.", icon: "wallet" },
  { n: "06", title: "Read the 6 PM summary", body: "Orders, what’s unpaid, your top seller, what to restock. The day distilled — sent to your WhatsApp.", icon: "moon" },
];

export default function HowToUseClient() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const heroes = el.querySelectorAll<HTMLElement>("[data-hero]");
    const steps = el.querySelectorAll<HTMLElement>("[data-step]");
    const line = el.querySelector<SVGPathElement>("[data-ledger-line]");
    const counter = el.querySelector<HTMLElement>("[data-count]");

    // Reduced motion / no-JS-anim fallback: reveal everything, skip motion.
    const revealAll = () => {
      [...heroes, ...steps].forEach((n) => {
        n.style.opacity = "1";
        n.style.transform = "none";
      });
      if (line) line.style.strokeDashoffset = "0";
      if (counter && counter.dataset.count) counter.textContent = counter.dataset.count;
    };

    if (reduce) {
      revealAll();
      return;
    }

    let cancelled = false;
    let safety: number | undefined;

    import("animejs")
      .then(({ animate, stagger }) => {
        if (cancelled) return;

        // Hero: staggered rise on load.
        animate(heroes, {
          opacity: [0, 1],
          translateY: [14, 0],
          duration: 600,
          delay: stagger(90, { start: 80 }),
          ease: "outQuint",
        });

        // Headline metric counts up once it's on screen.
        if (counter) {
          const target = Number(counter.dataset.count || "0");
          const obj = { v: 0 };
          const io = new IntersectionObserver(
            (entries) => {
              entries.forEach((e) => {
                if (!e.isIntersecting) return;
                animate(obj, {
                  v: target,
                  duration: 1300,
                  ease: "outQuint",
                  onUpdate: () => {
                    counter.textContent = String(Math.round(obj.v));
                  },
                });
                io.unobserve(e.target);
              });
            },
            { threshold: 0.6 },
          );
          io.observe(counter);
        }

        // The ledger line draws itself as it scrolls into view.
        if (line) {
          const len = line.getTotalLength();
          line.style.strokeDasharray = String(len);
          line.style.strokeDashoffset = String(len);
          const io = new IntersectionObserver(
            (entries) => {
              entries.forEach((e) => {
                if (!e.isIntersecting) return;
                animate(line, {
                  strokeDashoffset: [len, 0],
                  duration: 1600,
                  ease: "inOutQuad",
                });
                io.unobserve(e.target);
              });
            },
            { threshold: 0.25 },
          );
          io.observe(line);
        }

        // Each step lifts into place as it enters the viewport.
        const revealStep = (node: HTMLElement) => {
          if (node.dataset.shown) return;
          node.dataset.shown = "1";
          animate(node.querySelectorAll<HTMLElement>("[data-rise]"), {
            opacity: [0, 1],
            translateY: [18, 0],
            duration: 620,
            delay: stagger(70),
            ease: "outQuint",
          });
        };
        const io = new IntersectionObserver(
          (entries) => {
            entries.forEach((e) => {
              if (!e.isIntersecting) return;
              revealStep(e.target as HTMLElement);
              io.unobserve(e.target);
            });
          },
          { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
        );
        steps.forEach((s) => io.observe(s));

        // Safety net: never leave content hidden. After a beat, reveal any step
        // the observer hasn't fired for yet (short viewport, no-scroll, etc.).
        safety = window.setTimeout(() => {
          steps.forEach((s) => revealStep(s as HTMLElement));
        }, 1600);
      })
      .catch(revealAll); // anime failed to load → show everything.

    return () => {
      cancelled = true;
      if (safety) window.clearTimeout(safety);
    };
  }, []);

  return (
    <div ref={root} className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-arctic-300/40 bg-arctic-50/80 backdrop-blur-glass-thin">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-brand font-display text-lg font-black text-white">
              J
            </span>
            <span className="font-display text-[17px] font-semibold text-arctic-900">Japora</span>
          </Link>
          <nav className="flex items-center gap-1.5">
            <ThemeToggle className="mr-0.5" />
            <Link href="/marketplace" className="btn-ghost hidden sm:inline-flex">
              Marketplace
            </Link>
            <Link href="/start" className="btn-primary">
              Start free
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4">
        {/* Hero */}
        <section className="py-16 text-center sm:py-24">
          <div data-hero style={{ opacity: 0 }} className="a-eyebrow">
            How Japora works
          </div>
          <h1
            data-hero
            style={{ opacity: 0 }}
            className="a-display-sm mx-auto mt-3 max-w-3xl text-arctic-900 sm:a-display-md"
          >
            From “how much?” to paid — without leaving WhatsApp.
          </h1>
          <p
            data-hero
            style={{ opacity: 0 }}
            className="a-body-lg mx-auto mt-4 max-w-xl text-arctic-700"
          >
            Six steps, start to settled. No new app for you or your customers — just the chat they
            already live in.
          </p>
          <div data-hero style={{ opacity: 0 }} className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/start" className="btn-primary">
              Start on WhatsApp
            </Link>
            <Link href="/marketplace" className="btn-ghost">
              Explore the marketplace →
            </Link>
          </div>
        </section>

        {/* Steps with the ledger line */}
        <section className="relative pb-8">
          {/* Gold "ledger" spine — sits behind the numbers on sm+; draws on scroll. */}
          <svg
            aria-hidden
            className="pointer-events-none absolute left-[27px] top-2 hidden h-[calc(100%-3rem)] w-2 sm:block"
            preserveAspectRatio="none"
            viewBox="0 0 2 100"
          >
            <path
              data-ledger-line
              d="M1 0 L1 100"
              fill="none"
              stroke="rgb(var(--gold) / 0.55)"
              strokeWidth="2"
              vectorEffect="non-scaling-stroke"
            />
          </svg>

          <ol className="space-y-5">
            {STEPS.map((s) => (
              <li key={s.n} data-step className="relative">
                <article className="flex items-start gap-4 sm:gap-6">
                  {/* Number medallion — serif, tabular, gold. */}
                  <div
                    data-rise
                    style={{ opacity: 0 }}
                    className="relative z-10 grid h-14 w-14 shrink-0 place-items-center rounded-full border border-brand/40 bg-arctic-50 font-display text-lg font-semibold text-brand-dark shadow-elev-1"
                  >
                    <span className="a-num">{s.n}</span>
                  </div>
                  <div className="card flex-1 p-5 sm:p-6">
                    <div data-rise style={{ opacity: 0 }} className="flex items-center gap-2.5">
                      <StepIcon name={s.icon} />
                      <h2 className="a-title-lg font-display text-arctic-900">{s.title}</h2>
                    </div>
                    <p data-rise style={{ opacity: 0 }} className="a-body-md a-measure mt-2 text-arctic-700">
                      {s.body}
                    </p>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </section>

        {/* Ledger metric — counts up on scroll. */}
        <section className="mb-14 mt-6">
          <div className="glass glass-edge mx-auto max-w-md rounded-shape-lg p-7 text-center">
            <div className="a-eyebrow">Time to your first shop</div>
            <div className="mt-2 flex items-end justify-center gap-1">
              <span
                data-count="90"
                className="a-num font-display text-6xl font-semibold leading-none text-arctic-900"
              >
                0
              </span>
              <span className="a-num pb-1 font-display text-2xl font-semibold text-brand-dark">
                sec
              </span>
            </div>
            <div className="mx-auto mt-4 h-px max-w-[12rem]">
              <hr className="a-rule-gold" />
            </div>
            <p className="a-body-sm mt-3 text-arctic-600">
              Scan a code, tap to confirm, your shop is live with the products you already had.
            </p>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="mb-20 text-center">
          <h2 className="a-headline-md font-display text-arctic-900">Your hustle, quietly handled.</h2>
          <p className="a-body-md mx-auto mt-2 max-w-md text-arctic-700">
            Start free — keep 97% when you sell. No monthly fee.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/start" className="btn-primary">
              Open my shop
            </Link>
            <Link href="/pricing" className="btn-ghost">
              See pricing
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-arctic-300/40 bg-arctic-50/55 backdrop-blur-glass-thin">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-6">
          <span className="a-body-sm text-arctic-700">© Japora</span>
          <nav className="flex items-center gap-5">
            <Link href="/pricing" className="a-label-md text-arctic-700 hover:text-arctic-900">Pricing</Link>
            <Link href="/marketplace" className="a-label-md text-arctic-700 hover:text-arctic-900">Marketplace</Link>
            <Link href="/start" className="a-label-md font-bold text-arctic-900 hover:underline">Start your shop →</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

/* Small line-art step glyphs (gold), consistent with the Lumière icon set. */
function StepIcon({ name }: { name: Step["icon"] }) {
  const paths: Record<Step["icon"], string> = {
    shop: "M4 9l1-4h14l1 4M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 20v-6h6v6",
    tag: "M3 7v5l9 9 6-6-9-9H4a1 1 0 0 0-1 1zM7.5 7.5h.01",
    share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
    chat: "M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.8-.8L3 21l1.9-4.2A8.4 8.4 0 0 1 3 11.5 8.5 8.5 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z",
    wallet: "M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2M3 7v10a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-2M3 7v3m18 5h-4a2 2 0 1 1 0-4h4v4z",
    moon: "M20 14.5A8 8 0 1 1 9.5 4 6.2 6.2 0 0 0 20 14.5z",
  };
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-brand-dark" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={paths[name]} />
    </svg>
  );
}
