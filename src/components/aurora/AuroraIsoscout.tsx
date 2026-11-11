"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * AuroraIsoscout — animated SVG illustrations for empty states.
 *
 * Why "isoscout": "isometric scout" — a friendly object that guides the
 * user to the next action ("your shelf is empty, here's a sketch of a
 * shelf, here's a CTA"). Each variant uses line-art in arctic palette
 * with a soft aurora wash behind it, and an anime.js "draw-on" entrance
 * via stroke-dasharray. Falls back to CSS fade if anime fails to load.
 *
 * Use like:
 *
 *   <AuroraIsoscout
 *     variant="orders"
 *     title="No orders yet"
 *     body="Share your catalog link — orders will land here as customers tap Order."
 *     action={<Link href="/dashboard/products" className="btn-primary">Add a product</Link>}
 *   />
 */

export type IsoscoutVariant =
  | "orders"
  | "products"
  | "customers"
  | "cart"
  | "receivables"
  | "broadcasts";

type Props = {
  variant: IsoscoutVariant;
  title?: ReactNode;
  body?: ReactNode;
  action?: ReactNode;
  /** Compact mode — half the illustration height. Useful inside cards. */
  compact?: boolean;
  className?: string;
};

export default function AuroraIsoscout({
  variant,
  title,
  body,
  action,
  compact = false,
  className = "",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const root = ref.current;
    if (!root) return;
    const paths = root.querySelectorAll<SVGPathElement>("[data-draw]");
    if (paths.length === 0) return;

    // Prime each path with dasharray = length so it appears un-drawn.
    paths.forEach((p) => {
      const len = p.getTotalLength?.() ?? 0;
      if (!len) return;
      p.style.strokeDasharray = `${len}`;
      p.style.strokeDashoffset = `${len}`;
    });

    import("animejs")
      .then(({ animate, stagger }) => {
        animate(paths, {
          strokeDashoffset: 0,
          duration: 900,
          delay: stagger(100),
          ease: "outQuart",
        });
        const fills = root.querySelectorAll<SVGElement>("[data-fade]");
        if (fills.length) {
          animate(fills, {
            opacity: [0, 1],
            translateY: [6, 0],
            duration: 480,
            delay: stagger(80, { start: 600 }),
            ease: "outQuint",
          });
        }
      })
      .catch(() => {
        // Plain reveal if anime fails.
        paths.forEach((p) => (p.style.strokeDashoffset = "0"));
        root
          .querySelectorAll<SVGElement>("[data-fade]")
          .forEach((el) => (el.style.opacity = "1"));
      });
  }, [variant]);

  const size = compact ? 160 : 220;

  return (
    <div
      ref={ref}
      className={
        "flex flex-col items-center text-center " +
        (compact ? "py-4 " : "py-10 ") +
        className
      }
    >
      {/* Soft aurora wash behind the art */}
      <div
        className="relative"
        style={{
          width: size,
          height: size,
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background:
              "radial-gradient(closest-side, rgba(230,230,250,0.85), rgba(176,196,222,0.4) 60%, transparent)",
          }}
        />
        <svg
          viewBox="0 0 220 220"
          width={size}
          height={size}
          className="relative"
          aria-hidden="true"
        >
          <Variant kind={variant} />
        </svg>
      </div>

      {title && <h3 className="a-headline-sm mt-5 text-arctic-900">{title}</h3>}
      {body && (
        <p className="a-body-md a-measure mt-2 text-arctic-700">{body}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ---------------- Variants ----------------
 * Line-art on stroke="var(--arctic-800)", subtle fills on "var(--arctic-400)".
 * Each path gets data-draw so the entry animation can find it.
 * Soft circles / accents get data-fade for the secondary reveal.
 */

function Variant({ kind }: { kind: IsoscoutVariant }) {
  const s = "var(--arctic-800)";
  const a = "var(--arctic-400)";
  const wash = "var(--arctic-200)";

  switch (kind) {
    case "orders":
      // A receipt with a small notification badge.
      return (
        <g fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path
            data-draw
            d="M62 36 L158 36 L158 184 L130 168 L110 184 L90 168 L62 184 Z"
          />
          <path data-draw d="M78 64 H142" />
          <path data-draw d="M78 84 H142" />
          <path data-draw d="M78 104 H120" />
          <path data-draw d="M78 130 H142" />
          <path data-draw d="M78 146 H110" />
          <circle data-fade cx="160" cy="42" r="12" fill={a} opacity="0" />
          <circle data-fade cx="160" cy="42" r="22" fill={wash} opacity="0" />
        </g>
      );

    case "products":
      // A glass shelf with a floating item.
      return (
        <g fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path data-draw d="M30 152 H190" />
          <path data-draw d="M30 152 L34 178" />
          <path data-draw d="M190 152 L186 178" />
          <rect data-draw x="60" y="116" width="32" height="36" rx="4" />
          <rect data-draw x="100" y="100" width="36" height="52" rx="4" />
          <rect data-draw x="144" y="124" width="28" height="28" rx="4" />
          <circle data-fade cx="118" cy="58" r="14" fill={a} opacity="0" />
          <path
            data-draw
            d="M108 58 L116 66 L130 50"
            stroke="var(--arctic-50)"
            strokeWidth="2.4"
          />
        </g>
      );

    case "customers":
      // Three silhouettes drifting in.
      return (
        <g fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle data-draw cx="70" cy="92" r="18" />
          <path data-draw d="M44 154 C48 130 64 124 70 124 C76 124 92 130 96 154" />
          <circle data-draw cx="150" cy="92" r="18" />
          <path data-draw d="M124 154 C128 130 144 124 150 124 C156 124 172 130 176 154" />
          <circle data-draw cx="110" cy="76" r="22" />
          <path data-draw d="M76 162 C82 132 100 124 110 124 C120 124 138 132 144 162" />
          <circle data-fade cx="190" cy="46" r="6" fill={a} opacity="0" />
          <circle data-fade cx="36" cy="60" r="4" fill={a} opacity="0" />
        </g>
      );

    case "cart":
      // A glass bowl with a single floating ball.
      return (
        <g fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path data-draw d="M44 92 H176 L156 168 H64 Z" />
          <path data-draw d="M44 92 L36 60 H22" />
          <circle data-fade cx="110" cy="58" r="14" fill={a} opacity="0" />
          <circle data-draw cx="86" cy="186" r="8" />
          <circle data-draw cx="138" cy="186" r="8" />
        </g>
      );

    case "receivables":
      // Two coins stacked + a soft halo.
      return (
        <g fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <ellipse data-draw cx="110" cy="80" rx="46" ry="14" />
          <path data-draw d="M64 80 V104" />
          <path data-draw d="M156 80 V104" />
          <path data-draw d="M64 104 C64 112 84 118 110 118 C136 118 156 112 156 104" />
          <ellipse data-draw cx="110" cy="138" rx="46" ry="14" fill="none" />
          <path data-draw d="M64 138 V162" />
          <path data-draw d="M156 138 V162" />
          <path data-draw d="M64 162 C64 170 84 176 110 176 C136 176 156 170 156 162" />
          <path data-draw d="M104 80 V100" stroke={a} />
          <path data-draw d="M116 80 V100" stroke={a} />
        </g>
      );

    case "broadcasts":
      // A megaphone with soft sound waves.
      return (
        <g fill="none" stroke={s} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path data-draw d="M40 100 L40 140 L72 140 L120 168 L120 72 L72 100 Z" />
          <path data-draw d="M120 100 C140 110 140 130 120 140" stroke={a} />
          <path data-draw d="M138 84 C168 102 168 138 138 156" stroke={a} />
          <circle data-fade cx="178" cy="58" r="5" fill={a} opacity="0" />
          <circle data-fade cx="190" cy="80" r="3" fill={a} opacity="0" />
        </g>
      );
  }
}
