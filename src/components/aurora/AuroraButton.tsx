"use client";

import {
  type ButtonHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  useRef,
} from "react";

/**
 * M3 Expressive button with an Aurora ripple.
 *
 * The ripple is rendered as a span anchored to the click position. We try
 * to animate it with anime.js (spring physics) for the buttery feel, but
 * fall through to CSS if the import fails — the component is never broken.
 *
 * Variants map to M3:
 *   - filled    : primary action (dark slate, ghost-white text)
 *   - tonal     : soft container action (lavender)
 *   - outlined  : alternative emphasis (glass, slate border)
 *   - text      : low emphasis (transparent, slate text)
 *
 * https://m3.material.io/components/all-buttons
 * https://m3.material.io/styles/motion/transitions/transition-patterns
 */

type Variant = "filled" | "tonal" | "outlined" | "text";
type Size = "sm" | "md" | "lg";

export type AuroraButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  pulse?: boolean;
};

export default function AuroraButton({
  variant = "filled",
  size = "md",
  loading = false,
  iconLeft,
  iconRight,
  pulse = false,
  className = "",
  onClick,
  children,
  disabled,
  ...rest
}: AuroraButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  async function handleClick(e: MouseEvent<HTMLButtonElement>) {
    spawnRipple(e);
    onClick?.(e);
  }

  function spawnRipple(e: MouseEvent<HTMLButtonElement>) {
    const btn = ref.current;
    if (!btn) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const ripple = document.createElement("span");
    ripple.className = "ripple";
    ripple.style.width = ripple.style.height = `${size}px`;
    ripple.style.left = `${e.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${e.clientY - rect.top - size / 2}px`;
    btn.appendChild(ripple);

    // Try anime.js for the buttery spring; gracefully fall back to the CSS
    // keyframe baked into the .ripple class.
    import("animejs")
      .then(({ animate }) => {
        animate(ripple, {
          scale: [0, 2.6],
          opacity: [0.18, 0],
          duration: 520,
          ease: "outQuint",
          onComplete: () => ripple.remove(),
        });
      })
      .catch(() => {
        // The CSS @keyframes a-ripple handles the animation already; just
        // clean up after it finishes.
        setTimeout(() => ripple.remove(), 540);
      });
  }

  const base = "a-btn";
  const variantClass = {
    filled: "a-btn--filled",
    tonal: "a-btn--tonal",
    outlined: "a-btn--outlined",
    text: "a-btn--text",
  }[variant];
  const sizeClass = size === "sm" ? "a-btn--sm" : size === "lg" ? "a-btn--lg" : "";
  const extra = pulse ? " a-pulse" : "";

  return (
    <button
      ref={ref}
      type={rest.type ?? "button"}
      onClick={handleClick}
      disabled={disabled || loading}
      className={`${base} ${variantClass} ${sizeClass}${extra} ${className}`.trim()}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : (
        iconLeft && <span aria-hidden className="-ml-1 inline-flex">{iconLeft}</span>
      )}
      <span className="relative z-[2]">{children}</span>
      {iconRight && !loading && (
        <span aria-hidden className="-mr-1 inline-flex">{iconRight}</span>
      )}
    </button>
  );
}
