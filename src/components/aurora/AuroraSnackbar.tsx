"use client";

import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

/**
 * M3 snackbar — Aurora flavour. Single-line, glass surface, slides in from
 * the bottom. One snackbar at a time per M3.
 * https://m3.material.io/components/snackbar/guidelines
 *
 * Usage:
 *   1. Wrap the app subtree in <AuroraSnackbarProvider>.
 *   2. Anywhere below, useSnackbar() to get the show(msg, opts) callback.
 */

type Snack = {
  id: number;
  message: ReactNode;
  action?: { label: string; onClick: () => void };
  tone?: "default" | "success" | "error";
};

type Ctx = (message: ReactNode, opts?: Omit<Snack, "id" | "message">) => void;
const SnackCtx = createContext<Ctx | null>(null);

export function useSnackbar(): Ctx {
  const ctx = useContext(SnackCtx);
  if (!ctx) throw new Error("useSnackbar must be used inside <AuroraSnackbarProvider>");
  return ctx;
}

export default function AuroraSnackbarProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Snack | null>(null);
  const counter = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback<Ctx>((message, opts = {}) => {
    counter.current += 1;
    const snack: Snack = {
      id: counter.current,
      message,
      action: opts.action,
      tone: opts.tone ?? "default",
    };
    if (timer.current) clearTimeout(timer.current);
    setCurrent(snack);
    timer.current = setTimeout(
      () => setCurrent((c) => (c?.id === snack.id ? null : c)),
      opts.action ? 8000 : 4000,
    );
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <SnackCtx.Provider value={value}>
      {children}
      {current && typeof document !== "undefined"
        ? createPortal(<Snackbar key={current.id} snack={current} onClose={() => setCurrent(null)} />, document.body)
        : null}
    </SnackCtx.Provider>
  );
}

function Snackbar({ snack, onClose }: { snack: Snack; onClose: () => void }) {
  const accent =
    snack.tone === "success"
      ? "border-l-2 border-l-arctic-800"
      : snack.tone === "error"
        ? "border-l-2 border-l-red-500"
        : "";
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 flex justify-center px-4 pointer-events-none"
    >
      <div
        className={
          "pointer-events-auto flex max-w-[560px] items-center gap-3 rounded-shape-md bg-arctic-900/92 px-4 py-3 text-arctic-50 shadow-elev-3 backdrop-blur-glass-thin a-rise-in " +
          accent
        }
      >
        <span className="text-[14px] leading-5">{snack.message}</span>
        {snack.action && (
          <button
            onClick={() => {
              snack.action!.onClick();
              onClose();
            }}
            className="ml-2 rounded-shape-sm px-2 py-1 text-[12px] font-semibold uppercase tracking-[0.06em] text-arctic-200 hover:bg-white/10"
          >
            {snack.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
