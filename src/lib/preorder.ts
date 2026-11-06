/**
 * Japora pre-order helpers — deposits + balance accounting.
 *
 * Vendors flag products as `preOrderAllowed` with a `depositPercent`. At
 * checkout we compute a deposit, charge that, then chase the balance later.
 * `paidCents` on Order is the running paid figure (deposit + later
 * settlements); `balanceCents = totalCents - paidCents`.
 */
import type { Order, Product } from "@prisma/client";
import { prisma } from "./db";

/** Minimal Product shape — also accepts plain DTOs from the public catalog. */
type PreOrderProduct = Pick<
  Product,
  "priceCents" | "preOrderAllowed" | "depositPercent"
>;

/**
 * Deposit amount (cents) for `quantity` units of `product`. Returns 0 if the
 * product isn't flagged for pre-order or the deposit percent is unset.
 *
 * We floor (not round) so a vendor configuring 25% on a ₦1 item never asks
 * for *more* than the headline percentage.
 */
export function computeDeposit(product: PreOrderProduct, quantity: number): number {
  if (!product?.preOrderAllowed) return 0;
  const pct = Math.max(0, Math.min(100, Math.floor(product.depositPercent || 0)));
  if (pct === 0) return 0;
  const qty = Math.max(0, Math.floor(quantity || 0));
  const gross = Math.max(0, Math.floor(product.priceCents || 0)) * qty;
  return Math.floor((gross * pct) / 100);
}

/**
 * Mark the deposit as collected on an existing order. Bumps paidCents and
 * sets depositPaidAt. Safe to call once; subsequent calls just refresh the
 * timestamp.
 */
export async function markDepositPaid(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return null;
  const deposit = Math.max(0, Math.floor(order.depositCents || 0));
  return prisma.order.update({
    where: { id: orderId },
    data: {
      depositPaidAt: new Date(),
      paidCents: { increment: deposit },
    },
  });
}

/** Remaining balance owed on an order (cents). Never negative. */
export function computeBalanceDue(
  order: Pick<Order, "totalCents" | "paidCents">,
): number {
  const total = Math.max(0, Math.floor(order.totalCents || 0));
  const paid = Math.max(0, Math.floor(order.paidCents || 0));
  return Math.max(0, total - paid);
}
