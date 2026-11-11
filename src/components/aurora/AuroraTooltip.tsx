"use client";

import {
  type ReactNode,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";

/**
 * M3 plain tooltip — Aurora flavour. Glass surface, anchored to its target,
 * shows on hover + focus. 500ms enter delay, instant exit (per M3 guidelines).
 * https://m3.material.io/components/tooltips/specs
 *
 * Usage:
 *   <AuroraTooltip content="Refresh"><button>↻</button></AuroraTooltip>
 */

type Props = {
  content: ReactNode;
  /** Where the tooltip pops relative to the anchor. Defaults to "top". */
  placement?: "top" | "bottom";
  children: ReactNode;
};

export default function AuroraTooltip({
  content,
  placement = "top",
  children,
}: Props) {
  const tooltipId = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function show() {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setOpen(true), 500);
  }
  function hide() {
    if (timerRef.current) clearTimeout(timerRef.current);
    setOpen(false);
  }

  // We clone the child so it inherits the listeners + a11y attrs. Falls back
  // to a wrapper span if the child isn't a single React element.
  const trigger =
    isValidElement(children) ? (
      cloneElement(
        children as React.ReactElement<Record<string, unknown>>,
        {
          onMouseEnter: show,
          onMouseLeave: hide,
          onFocus: show,
          onBlur: hide,
          "aria-describedby": open ? tooltipId : undefined,
        },
      )
    ) : (
      <span
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        aria-describedby={open ? tooltipId : undefined}
      >
        {children}
      </span>
    );

  return (
    <span ref={ref} className="relative inline-block">
      {trigger}
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={
            "pointer-events-none absolute left-1/2 z-40 -translate-x-1/2 whitespace-nowrap rounded-shape-sm border border-white/60 bg-arctic-900/92 px-2.5 py-1.5 text-[12px] font-medium text-arctic-50 shadow-elev-2 backdrop-blur-glass-thin a-rise-in " +
            (placement === "top" ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+8px)]")
          }
        >
          {content}
        </span>
      )}
    </span>
  );
}
