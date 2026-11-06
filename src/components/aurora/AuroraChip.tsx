"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";

/**
 * M3 chip — assist / filter / input. We expose a single Chip that toggles
 * via aria-selected; consumers manage the state.
 *
 * https://m3.material.io/components/chips/specs
 *
 * Accessibility:
 *   - When `selected` is provided, the chip becomes a toggle button with
 *     aria-pressed; otherwise it's a plain button.
 *   - Min target 32×88 per M3 — kept above Fitts threshold for primary chips
 *     by setting min-w-[88px] when label-only.
 */

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  icon?: ReactNode;
  /** Optional tail like a count badge or a × close affordance. */
  trailing?: ReactNode;
};

export default function AuroraChip({
  selected,
  icon,
  trailing,
  className = "",
  children,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      aria-pressed={typeof selected === "boolean" ? selected : undefined}
      data-selected={selected ? "true" : undefined}
      className={
        "a-chip " +
        (selected ? "a-chip--selected " : "") +
        className
      }
      {...rest}
    >
      {icon && <span aria-hidden className="inline-flex">{icon}</span>}
      <span className="truncate">{children}</span>
      {trailing && <span aria-hidden className="ml-0.5 inline-flex">{trailing}</span>}
    </button>
  );
}
