"use client";

import { type ReactNode, useEffect, useState } from "react";

/**
 * M3 top app bar — sticky, glass, with a subtle scroll-state lift.
 *
 * Two states (per M3):
 *   - At top of page : transparent glass, no shadow
 *   - Scrolled       : surface tints up + elevation-1 lifts in
 *
 * https://m3.material.io/components/app-bars/guidelines
 *
 * The transition between states is a 320ms emphasized ease so it feels
 * intentional, not snappy.
 */

type Props = {
  leading?: ReactNode;
  trailing?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export default function AuroraAppBar({
  leading,
  trailing,
  children,
  className = "",
}: Props) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 4);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={
        "sticky top-0 z-30 border-b transition-all duration-medium ease-emphasized " +
        (scrolled
          ? "border-arctic-400/30 bg-white/70 backdrop-blur-glass-thick shadow-elev-1"
          : "border-transparent bg-transparent backdrop-blur-0") +
        " " +
        className
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {leading}
          {children}
        </div>
        <div className="flex shrink-0 items-center gap-2">{trailing}</div>
      </div>
    </header>
  );
}
