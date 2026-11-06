/**
 * Business hours — "is the shop open right now?"
 *
 * Stored on Vendor.businessHours as JSON:
 *   { enabled: boolean, days: number[] (0=Sun..6=Sat), open: "HH:MM", close: "HH:MM" }
 * plus Vendor.tzOffsetMinutes (Togo = 0 / GMT). We shift "now" by the offset
 * and read the wall clock in UTC, which gives the vendor's local time without
 * pulling a timezone database.
 *
 * When hours aren't enabled we treat the shop as always open (no away message).
 */

export type BusinessHours = {
  enabled?: boolean;
  days?: number[];
  open?: string;
  close?: string;
};

export function parseHours(raw: unknown): BusinessHours {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  return {
    enabled: Boolean(o.enabled),
    days: Array.isArray(o.days) ? o.days.map(Number).filter((n) => n >= 0 && n <= 6) : undefined,
    open: typeof o.open === "string" ? o.open : undefined,
    close: typeof o.close === "string" ? o.close : undefined,
  };
}

function toMinutes(hhmm: string | undefined, fallback: number): number {
  if (!hhmm) return fallback;
  const [h, m] = hhmm.split(":").map((x) => parseInt(x, 10));
  if (!Number.isFinite(h) || !Number.isFinite(m)) return fallback;
  return h * 60 + m;
}

export function isOpenNow(
  hours: BusinessHours,
  tzOffsetMinutes = 0,
  now: Date = new Date(),
): boolean {
  if (!hours.enabled) return true; // not configured → always open

  const local = new Date(now.getTime() + tzOffsetMinutes * 60_000);
  const day = local.getUTCDay();
  if (hours.days && hours.days.length > 0 && !hours.days.includes(day)) return false;

  const mins = local.getUTCHours() * 60 + local.getUTCMinutes();
  const openM = toMinutes(hours.open, 0);
  const closeM = toMinutes(hours.close, 24 * 60 - 1);

  // Overnight window (e.g. 20:00 → 02:00) wraps midnight.
  if (closeM <= openM) return mins >= openM || mins < closeM;
  return mins >= openM && mins < closeM;
}
