/**
 * Currency helpers and conversion engine for Japora & Wataru ecosystem.
 *
 * Japora stores every monetary value as an integer of hundredths-of-major-unit
 * ("cents"), uniformly, regardless of currency. That keeps the schema simple
 * and lets Intl.NumberFormat handle per-currency display decimals for free.
 *
 * Supports West African, Central African, East African, and international currencies:
 * - XOF: Franc CFA BCEAO (Togo, Bénin, Côte d'Ivoire, Sénégal, etc.)
 * - XAF: Franc CFA BEAC (Cameroun, Gabon, Congo, etc.)
 * - USD: US Dollar ($)
 * - EUR: Euro (€)
 * - GHS: Ghanaian Cedi (GH₵)
 * - NGN: Nigerian Naira (₦)
 * - KES: Kenyan Shilling (KSh)
 */

/** ISO-4217 zero-decimal currencies relevant to Japora's markets (+ common ones). */
export const ZERO_DECIMAL = new Set<string>([
  "XOF", // West African CFA franc — Togo, Benin, Côte d'Ivoire, Senegal, Burkina, Mali, Niger, Guinea-Bissau
  "XAF", // Central African CFA franc — Cameroon, Gabon, Chad, CAR, Congo, Eq. Guinea
  "GNF", // Guinean franc
  "RWF", // Rwandan franc
  "UGX", // Ugandan shilling
  "BIF", "DJF", "KMF", "MGA", "VUV", "XPF",
  "JPY", "KRW", "VND", "CLP", "PYG",
]);

export function isZeroDecimal(currency: string): boolean {
  return ZERO_DECIMAL.has((currency || "").toUpperCase());
}

/** Major units (naira, XOF francs, dollars) as a number, from stored cents. */
export function majorUnits(cents: number): number {
  return (Number.isFinite(cents) ? cents : 0) / 100;
}

/** The stored integer itself, sanitised — i.e. minor units (kobo for NGN). */
export function minorUnits(cents: number): number {
  return Math.max(0, Math.round(Number.isFinite(cents) ? cents : 0));
}

/**
 * Integer amount in *major* units for a provider, rounded UP to `multipleOf`
 * (default 1). XOF aggregators want whole francs; CinetPay specifically
 * requires XOF/XAF to be a multiple of 5.
 */
export function providerMajorAmount(
  cents: number,
  opts: { multipleOf?: number } = {},
): number {
  const m = Math.max(1, Math.floor(opts.multipleOf ?? 1));
  const major = Math.ceil(majorUnits(cents));
  return m === 1 ? major : Math.ceil(major / m) * m;
}

/**
 * Convert a provider's reported *major-unit* amount back into stored cents,
 * so webhook verification can reconcile against PaymentIntent.amountCents.
 */
export function majorToCents(amountMajor: number): number {
  return Math.round((Number.isFinite(amountMajor) ? amountMajor : 0) * 100);
}

/* =====================================================================
 * Multi-Currency Conversion System
 * ===================================================================== */

export type CurrencyCode = "XOF" | "XAF" | "USD" | "EUR" | "GHS" | "NGN" | "KES";

export interface CurrencyInfo {
  code: CurrencyCode;
  label: string;
  symbol: string;
  flag: string;
  rateToXof: number; // Value of 1 unit of this currency in XOF
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<CurrencyCode, CurrencyInfo> = {
  XOF: {
    code: "XOF",
    label: "Franc CFA (XOF)",
    symbol: "FCFA",
    flag: "🇹🇬",
    rateToXof: 1.0,
    decimals: 0,
  },
  XAF: {
    code: "XAF",
    label: "Franc CFA (XAF)",
    symbol: "FCFA",
    flag: "🇨🇲",
    rateToXof: 1.0,
    decimals: 0,
  },
  USD: {
    code: "USD",
    label: "Dollar US ($)",
    symbol: "$",
    flag: "🇺🇸",
    rateToXof: 600.0,
    decimals: 2,
  },
  EUR: {
    code: "EUR",
    label: "Euro (€)",
    symbol: "€",
    flag: "🇪🇺",
    rateToXof: 655.957,
    decimals: 2,
  },
  GHS: {
    code: "GHS",
    label: "Cedi Ghanéen (GH₵)",
    symbol: "GH₵",
    flag: "🇬🇭",
    rateToXof: 40.0,
    decimals: 2,
  },
  NGN: {
    code: "NGN",
    label: "Naira Nigérian (₦)",
    symbol: "₦",
    flag: "🇳🇬",
    rateToXof: 0.40,
    decimals: 0,
  },
  KES: {
    code: "KES",
    label: "Shilling Kényan (KSh)",
    symbol: "KSh",
    flag: "🇰🇪",
    rateToXof: 4.62,
    decimals: 0,
  },
};

export const CURRENCY_LIST = Object.values(SUPPORTED_CURRENCIES);

export function normalizeCurrency(code?: string | null): CurrencyCode {
  if (!code) return "XOF";
  const upper = code.trim().toUpperCase() as CurrencyCode;
  return SUPPORTED_CURRENCIES[upper] ? upper : "XOF";
}

/**
 * Converts an amount in cents from one currency to another.
 * Both inputs and outputs are in cents (1 unit = 100 cents).
 */
export function convertCurrency(
  amountCents: number,
  from: string,
  to: string,
): number {
  if (!amountCents || isNaN(amountCents)) return 0;
  const fromCode = normalizeCurrency(from);
  const toCode = normalizeCurrency(to);

  if (fromCode === toCode) return amountCents;

  const fromInfo = SUPPORTED_CURRENCIES[fromCode];
  const toInfo = SUPPORTED_CURRENCIES[toCode];

  // 1. Convert amount to XOF units
  const unitsFrom = amountCents / 100;
  const xofValue = unitsFrom * fromInfo.rateToXof;

  // 2. Convert XOF value to target currency units
  const unitsTo = xofValue / toInfo.rateToXof;

  // 3. Return as target cents
  return Math.round(unitsTo * 100);
}

/**
 * Format an amount in cents for a given currency code.
 */
export function formatCurrencyAmount(
  amountCents: number,
  currencyCode: string,
): string {
  const code = normalizeCurrency(currencyCode);
  const info = SUPPORTED_CURRENCIES[code];
  const units = amountCents / 100;

  const formattedNum = new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  }).format(units);

  if (info.symbol === "$" || info.symbol === "€" || info.symbol === "£") {
    return `${info.symbol}${formattedNum}`;
  }
  return `${formattedNum} ${info.symbol}`;
}

/**
 * Converts and formats money with optional original reference note.
 */
export function formatConvertedPrice(
  amountCents: number,
  baseCurrency: string,
  displayCurrency: string,
): {
  primary: string;
  original?: string;
  convertedCents: number;
} {
  const base = normalizeCurrency(baseCurrency);
  const display = normalizeCurrency(displayCurrency);

  if (base === display) {
    return {
      primary: formatCurrencyAmount(amountCents, base),
      convertedCents: amountCents,
    };
  }

  const convertedCents = convertCurrency(amountCents, base, display);
  return {
    primary: formatCurrencyAmount(convertedCents, display),
    original: formatCurrencyAmount(amountCents, base),
    convertedCents,
  };
}
