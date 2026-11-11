"use client";

import {
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
  forwardRef,
  useId,
  useState,
} from "react";

/**
 * M3 outlined text field — the Aurora flavour.
 *
 * Floating label, leading + trailing slots, helper / error text, glass
 * surface. The label "lifts" via a CSS-only translate driven by :focus and
 * :placeholder-shown — no JS state needed for that.
 *
 * https://m3.material.io/components/text-fields/specs
 */

type Props = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  helper?: string;
  error?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  containerClassName?: string;
};

const AuroraTextField = forwardRef(function AuroraTextField(
  {
    id,
    label,
    helper,
    error,
    leading,
    trailing,
    containerClassName = "",
    className = "",
    placeholder,
    ...rest
  }: Props,
  ref: Ref<HTMLInputElement>,
) {
  const auto = useId();
  const fieldId = id ?? auto;
  const helperId = `${fieldId}-helper`;
  const [focus, setFocus] = useState(false);

  const stateRing = error
    ? "ring-[3px] ring-red-500/25 border-red-500/70"
    : focus
      ? "ring-[3px] ring-arctic-400/40 border-arctic-800/70"
      : "border-arctic-400/45";

  return (
    <div className={"w-full " + containerClassName}>
      <div
        className={
          "group relative flex items-center gap-2 rounded-shape-md border bg-white/65 px-3.5 backdrop-blur-glass-thin transition-all duration-short ease-standard " +
          stateRing
        }
        style={{ minHeight: 56 }}
      >
        {leading && (
          <span className="text-arctic-700 [&>svg]:h-5 [&>svg]:w-5">{leading}</span>
        )}
        <div className="relative flex-1">
          {label && (
            <label
              htmlFor={fieldId}
              className={
                "pointer-events-none absolute left-0 origin-top-left text-arctic-700 transition-all duration-short ease-standard " +
                "peer-focus:-translate-y-2.5 peer-focus:scale-75 " +
                "peer-[:not(:placeholder-shown)]:-translate-y-2.5 peer-[:not(:placeholder-shown)]:scale-75"
              }
              style={{
                top: 18,
                fontSize: 14,
              }}
            >
              {label}
            </label>
          )}
          <input
            ref={ref}
            id={fieldId}
            placeholder={placeholder ?? " "}
            onFocus={(e) => {
              setFocus(true);
              rest.onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocus(false);
              rest.onBlur?.(e);
            }}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={helper || error ? helperId : undefined}
            className={
              "peer w-full bg-transparent text-arctic-900 outline-none placeholder:text-transparent " +
              "py-5 pt-7 text-[14px] leading-5 " +
              className
            }
            {...rest}
          />
        </div>
        {trailing && (
          <span className="text-arctic-700 [&>svg]:h-5 [&>svg]:w-5">{trailing}</span>
        )}
      </div>
      {(helper || error) && (
        <p
          id={helperId}
          className={
            "mt-1.5 px-1 text-[12px] " +
            (error ? "text-red-600" : "text-arctic-600")
          }
        >
          {error || helper}
        </p>
      )}
    </div>
  );
});

export default AuroraTextField;
