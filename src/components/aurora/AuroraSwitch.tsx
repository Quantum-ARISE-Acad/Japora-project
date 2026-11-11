"use client";

import { type InputHTMLAttributes, useId } from "react";

/**
 * M3 switch — Aurora flavour. Track 52×32, thumb 20→24 (the M3-Expressive
 * thumb-grows-when-on detail). Controlled component — pass `checked` +
 * `onChange`.
 * https://m3.material.io/components/switch/specs
 */

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  description?: string;
};

export default function AuroraSwitch({
  label,
  description,
  id,
  className = "",
  checked,
  disabled,
  ...rest
}: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label
      htmlFor={inputId}
      className={
        "group inline-flex items-center gap-3 " +
        (disabled ? "cursor-not-allowed opacity-50 " : "cursor-pointer ") +
        className
      }
    >
      <input
        id={inputId}
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        {...rest}
      />
      <span
        aria-hidden
        className={
          "relative inline-block h-8 w-[52px] rounded-full border transition-colors duration-short ease-standard peer-focus-visible:ring-[3px] peer-focus-visible:ring-arctic-400/40 " +
          (checked
            ? "border-arctic-800 bg-arctic-800"
            : "border-arctic-400/55 bg-white/70 backdrop-blur-glass-thin")
        }
      >
        <span
          className={
            "absolute top-1/2 grid -translate-y-1/2 place-items-center rounded-full transition-all duration-short ease-spring " +
            (checked
              ? "left-[26px] h-6 w-6 bg-arctic-50"
              : "left-1 h-5 w-5 bg-arctic-400")
          }
        />
      </span>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block a-label-lg text-arctic-900">{label}</span>}
          {description && (
            <span className="block a-body-sm text-arctic-600">{description}</span>
          )}
        </span>
      )}
    </label>
  );
}
