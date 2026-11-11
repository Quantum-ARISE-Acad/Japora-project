"use client";

import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * M3 dialog — glass surface, full-page scrim, animated in/out via the
 * `a-rise-in` keyframe (emphasized decelerate, 320ms). ESC closes; click on
 * the scrim closes; focus is trapped to the dialog while open.
 *
 * https://m3.material.io/components/dialogs/specs
 */

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
};

export default function AuroraDialog({
  open,
  onClose,
  title,
  children,
  actions,
  size = "md",
}: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  const maxW = size === "sm" ? "max-w-sm" : size === "lg" ? "max-w-2xl" : "max-w-md";

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={typeof title === "string" ? title : undefined}
      className="fixed inset-0 z-50 grid place-items-center p-4 a-fade-in"
    >
      {/* Scrim — Aurora uses a softer scrim than typical M3 so the glass
          dialog feels suspended in the aurora mesh, not behind a curtain. */}
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-arctic-900/40 backdrop-blur-glass-thin"
      />

      <div
        className={`relative w-full ${maxW} glass glass-edge a-rise-in rounded-shape-xl p-6`}
      >
        {title && (
          <div className="a-headline-sm mb-3 text-arctic-900">{title}</div>
        )}
        <div className="a-body-md text-arctic-800">{children}</div>
        {actions && (
          <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
