/** Shared customer segment rules safe to use in both server and client code. */
export const VIP_QUALIFYING_ORDER_COUNT = 3;

export function isCustomerVip(candidate: {
  qualifyingOrderCount?: number | null;
  orderCount?: number | null;
} = {}): boolean {
  const count = Number(candidate.qualifyingOrderCount ?? candidate.orderCount ?? 0);
  return Number.isFinite(count) && count >= VIP_QUALIFYING_ORDER_COUNT;
}

export function isCustomerInactiveFor30Days(
  lastOrderAt: Date | string | null | undefined,
  now: Date | number = Date.now(),
): boolean {
  if (lastOrderAt == null) return false;
  const last = lastOrderAt instanceof Date ? lastOrderAt.getTime() : new Date(lastOrderAt).getTime();
  const current = now instanceof Date ? now.getTime() : now;
  return Number.isFinite(last) && Number.isFinite(current) && current - last >= 30 * 24 * 60 * 60 * 1000;
}
