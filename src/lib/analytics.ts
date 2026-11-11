const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TZ_OFFSET_MINUTES = -12 * 60;
const MAX_TZ_OFFSET_MINUTES = 14 * 60;

export type DailyRevenuePoint = {
  dateKey: string;
  label: string;
  start: Date;
  endExclusive: Date;
  revenueCents: number;
  orderCount: number;
};

export type DailyRevenueWindow = {
  from: Date;
  toExclusive: Date;
  tzOffsetMinutes: number;
  days: DailyRevenuePoint[];
};

/**
 * Build calendar-day boundaries for a merchant's fixed UTC offset.
 * Prisma stores timestamps as instants; shifting by the saved vendor offset
 * before reading UTC date parts keeps grouping independent of the server TZ.
 */
export function buildDailyRevenueWindow(
  now: Date,
  tzOffsetMinutes: number,
  dayCount = 14,
): DailyRevenueWindow {
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 366) {
    throw new RangeError("dayCount must be an integer between 1 and 366");
  }

  const offset = Number.isFinite(tzOffsetMinutes)
    ? Math.max(MIN_TZ_OFFSET_MINUTES, Math.min(MAX_TZ_OFFSET_MINUTES, Math.round(tzOffsetMinutes)))
    : 0;
  const offsetMs = offset * 60_000;
  const localNow = new Date(now.getTime() + offsetMs);
  const localTodayStart = Date.UTC(
    localNow.getUTCFullYear(),
    localNow.getUTCMonth(),
    localNow.getUTCDate(),
  ) - offsetMs;
  const fromMs = localTodayStart - (dayCount - 1) * DAY_MS;
  const toMs = localTodayStart + DAY_MS;

  const days = Array.from({ length: dayCount }, (_, index) => {
    const startMs = fromMs + index * DAY_MS;
    const localDate = new Date(startMs + offsetMs);
    const year = localDate.getUTCFullYear();
    const month = String(localDate.getUTCMonth() + 1).padStart(2, "0");
    const day = String(localDate.getUTCDate()).padStart(2, "0");

    return {
      dateKey: `${year}-${month}-${day}`,
      label: `${day}/${month}`,
      start: new Date(startMs),
      endExclusive: new Date(startMs + DAY_MS),
      revenueCents: 0,
      orderCount: 0,
    };
  });

  return {
    from: new Date(fromMs),
    toExclusive: new Date(toMs),
    tzOffsetMinutes: offset,
    days,
  };
}

export function buildDailyRevenueSeries(
  orders: Array<{ createdAt: Date; totalCents: number }>,
  window: DailyRevenueWindow,
): DailyRevenuePoint[] {
  const byDate = new Map(window.days.map((day) => [day.dateKey, day]));
  const offsetMs = window.tzOffsetMinutes * 60_000;

  for (const order of orders) {
    const timestamp = order.createdAt.getTime();
    if (!Number.isFinite(timestamp) || timestamp < window.from.getTime() || timestamp >= window.toExclusive.getTime()) {
      continue;
    }

    const localDate = new Date(timestamp + offsetMs);
    const key = `${localDate.getUTCFullYear()}-${String(localDate.getUTCMonth() + 1).padStart(2, "0")}-${String(localDate.getUTCDate()).padStart(2, "0")}`;
    const day = byDate.get(key);
    if (!day) continue;

    day.revenueCents += Math.max(0, order.totalCents);
    day.orderCount += 1;
  }

  return window.days;
}

export function buildLocalHourBuckets(
  orders: Array<{ createdAt: Date }>,
  tzOffsetMinutes: number,
): number[] {
  const offset = Number.isFinite(tzOffsetMinutes)
    ? Math.max(MIN_TZ_OFFSET_MINUTES, Math.min(MAX_TZ_OFFSET_MINUTES, Math.round(tzOffsetMinutes)))
    : 0;
  const buckets = Array.from({ length: 24 }, () => 0);

  for (const order of orders) {
    const timestamp = order.createdAt.getTime();
    if (!Number.isFinite(timestamp)) continue;
    const localDate = new Date(timestamp + offset * 60_000);
    buckets[localDate.getUTCHours()] += 1;
  }

  return buckets;
}
