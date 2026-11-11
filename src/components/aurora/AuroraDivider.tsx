"use client";

import { type ReactNode } from "react";

/**
 * M3 divider with optional inline label ("OR", "Today", etc.) — Aurora-tinted.
 * https://m3.material.io/components/divider/specs
 */

type Props = {
  label?: ReactNode;
  className?: string;
};

export default function AuroraDivider({ label, className = "" }: Props) {
  if (!label) {
    return (
      <hr
        aria-hidden
        className={"my-4 h-px border-0 bg-aurora-divider " + className}
      />
    );
  }
  return (
    <div className={"my-5 flex items-center gap-3 " + className} role="separator">
      <span className="h-px flex-1 bg-aurora-divider" aria-hidden />
      <span className="a-label-md text-arctic-700">{label}</span>
      <span className="h-px flex-1 bg-aurora-divider" aria-hidden />
    </div>
  );
}
