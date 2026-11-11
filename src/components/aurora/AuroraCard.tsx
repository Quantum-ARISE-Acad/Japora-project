"use client";

import {
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useRef,
} from "react";

/**
 * M3 card — glass surface with optional "follow-cursor highlight" effect.
 * https://m3.material.io/components/cards/specs
 *
 * Variants:
 *   - elevated : default — glass surface with elev-1
 *   - filled   : lavender container (tonal)
 *   - outlined : transparent with steel-blue border
 *
 * Interaction: when interactive=true, the card lifts on hover and a soft
 * radial highlight follows the cursor — the M3-Expressive "pointer affinity"
 * pattern. This is a CSS-only effect (no JS animation cost on idle).
 */

type Variant = "elevated" | "filled" | "outlined";

type Props = HTMLAttributes<HTMLDivElement> & {
  variant?: Variant;
  interactive?: boolean;
  children: ReactNode;
};

export default function AuroraCard({
  variant = "elevated",
  interactive = false,
  className = "",
  children,
  onMouseMove,
  ...rest
}: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    onMouseMove?.(e);
    if (!interactive) return;
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  const base =
    "relative overflow-hidden rounded-shape-lg transition-all duration-short ease-spring";
  const variantClasses = {
    elevated:
      "glass glass-edge", // glass + top-edge highlight
    filled:
      "border border-arctic-300/60 bg-arctic-200/55 backdrop-blur-glass-thin",
    outlined:
      "border border-arctic-400/55 bg-white/35 backdrop-blur-glass-thin",
  }[variant];
  const hover = interactive ? "a-hover-lift cursor-pointer" : "";

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={`${base} ${variantClasses} ${hover} ${className}`.trim()}
      {...rest}
    >
      {interactive && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-short ease-standard"
          style={{
            background:
              "radial-gradient(280px at var(--mx, 50%) var(--my, 50%), rgba(176, 196, 222, 0.35), transparent 70%)",
          }}
          // Reveal the cursor halo on hover via parent group state.
          ref={(el) => {
            if (!el) return;
            const parent = el.parentElement;
            if (!parent) return;
            parent.addEventListener("mouseenter", () => (el.style.opacity = "1"));
            parent.addEventListener("mouseleave", () => (el.style.opacity = "0"));
          }}
        />
      )}
      <div className="relative z-[2]">{children}</div>
    </div>
  );
}
