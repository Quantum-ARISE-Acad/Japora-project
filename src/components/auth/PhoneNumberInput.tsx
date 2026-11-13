"use client";

import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";

const PHONE_COUNTRIES = getCountries();

export default function PhoneNumberInput({
  id,
  label,
  value,
  country,
  onChange,
  onCountryChange,
  required = true,
}: {
  id: string;
  label: string;
  value: string;
  country: CountryCode;
  onChange: (value: string) => void;
  onCountryChange: (country: CountryCode) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="grid grid-cols-[minmax(132px,0.9fr)_minmax(0,1.4fr)] gap-2">
        <select
          className="input"
          aria-label="Country calling code"
          autoComplete="tel-country-code"
          value={country}
          onChange={(event) => onCountryChange(event.target.value as CountryCode)}
        >
          {PHONE_COUNTRIES.map((countryCode) => (
            <option key={countryCode} value={countryCode}>
              {countryCode} (+{getCountryCallingCode(countryCode)})
            </option>
          ))}
        </select>
        <input
          id={id}
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="90 12 34 56"
          required={required}
        />
      </div>
      <span className="mt-1 block text-[11px] text-arctic-500">
        Enter a local number for the selected country, or an international number beginning with +.
      </span>
    </div>
  );
}
