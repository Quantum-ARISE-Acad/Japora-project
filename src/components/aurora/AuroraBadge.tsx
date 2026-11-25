"use client";

import { type ReactNode } from "react";

/**
 * M3 badge — small / large, attached to a parent.
 * https://m3.material.io/components/badges/specs
 */

type Props = {
  /** A short string/number for "large" badges. Empty/undefined → dot variant. */
  count?: ReactNode;
  tone?: "default" | "primary" | "success" | "error";
  /** Position relative to the anchor (use inside a relative container). */
  className?: string;
};

export default function AuroraBadge({
  count,
  tone = "primary",
  className = "",
}: Props) {
  const toneClass = {
    default: "bg-arctic-300 text-arctic-900",
    primary: "bg-arctic-800 text-arctic-50",
    success: "bg-signal-fill text-white",
    error: "bg-red-500 text-white",
  }[tone];

  if (count === undefined || count === null || count === "") {
    return (
      <span
        aria-hidden
        className={
          "absolute right-0 top-0 h-2 w-2 -translate-y-0.5 translate-x-0.5 rounded-full " +
          toneClass +
          " " +
          className
        }
      />
    );
  }

  return (
    <span
      aria-hidden
      className={
        "absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none " +
        toneClass +
        " " +
        className
      }
    >
      {count}
    </span>
  );
}
