export const ORDER_STATUSES = [
  "NEW",
  "CONFIRMED",
  "PAID",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function formatMoney(cents: number, currency = "USD"): string {
  const amount = (Number.isFinite(cents) ? cents : 0) / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Convert a user-entered price string/number (e.g. "25.50") into integer cents. */
export function parsePriceToCents(input: string | number): number {
  if (typeof input === "number") {
    if (!Number.isFinite(input) || input < 0) return 0;
    return Math.round(input * 100);
  }
  const s = String(input).trim();
  // Reject any minus sign before stripping — otherwise "-50" would become "50".
  if (/-/.test(s)) return 0;
  const cleaned = s.replace(/[^0-9.]/g, "");
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return slug || "shop";
}

export function parseSizes(sizes: string): string[] {
  return sizes
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Build a https://wa.me deep link with an optional prefilled message. */
export function waMeLink(phone: string, text?: string): string {
  const digits = (phone || "").replace(/[^0-9]/g, "");
  const query = text ? `?text=${encodeURIComponent(text)}` : "";
  return `https://wa.me/${digits}${query}`;
}

export function digitsOnly(phone: string): string {
  return (phone || "").replace(/[^0-9]/g, "");
}
