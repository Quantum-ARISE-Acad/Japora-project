"use client";

import { type InputHTMLAttributes, useId } from "react";

/**
 * M3 continuous slider — Aurora flavour. Track 4px, thumb 20px, growth on
 * active (per M3-Expressive interaction). Value label appears above the thumb.
 * https://m3.material.io/components/sliders/specs
 */

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  label?: string;
  showValue?: boolean;
  formatValue?: (v: number) => string;
};

export default function AuroraSlider({
  label,
  showValue = true,
  formatValue,
  value,
  min = 0,
  max = 100,
  className = "",
  id,
  ...rest
}: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  const numericValue = Number(value ?? 0);
  const pct =
    ((numericValue - Number(min)) / (Number(max) - Number(min))) * 100;
  const display = formatValue ? formatValue(numericValue) : String(numericValue);

  return (
    <div className={"w-full " + className}>
      {(label || showValue) && (
        <div className="mb-2 flex items-baseline justify-between">
          {label && <label htmlFor={inputId} className="a-label-md text-arctic-700">{label}</label>}
          {showValue && <span className="a-label-lg text-arctic-900">{display}</span>}
        </div>
      )}
      <div className="relative h-6">
        <span
          aria-hidden
          className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-arctic-300"
        />
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-arctic-800 transition-all duration-short ease-standard"
          style={{ width: `${pct}%` }}
        />
        <input
          id={inputId}
          type="range"
          value={value}
          min={min}
          max={max}
          className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-arctic-800
            [&::-webkit-slider-thumb]:shadow-elev-2
            [&::-webkit-slider-thumb]:transition-all
            [&::-webkit-slider-thumb]:duration-short
            [&::-webkit-slider-thumb]:ease-spring
            [&:active::-webkit-slider-thumb]:scale-110
            [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5
            [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-0
            [&::-moz-range-thumb]:bg-arctic-800"
          {...rest}
        />
      </div>
    </div>
  );
}
