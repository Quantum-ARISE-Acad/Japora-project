/**
 * Japora receivables — vendor-tracked IOUs for "sell now, pay later" orders.
 *
 * Most African retail still runs on book debt (gbese/karatasi). The receivable
 * table is the structured version of that notebook — created when an unpaid
 * order is captured, settled when the cash actually shows up. We deliberately
 * keep status as a string (OPEN | PARTIAL | PAID | WRITTEN_OFF) to stay in
 * lockstep with the migration-light schema convention.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";

type Tx = Prisma.TransactionClient | typeof prisma;

export const RECEIVABLE_STATUSES = [
  "OPEN",
  "PARTIAL",
  "PAID",
  "WRITTEN_OFF",
] as const;
export type ReceivableStatus = (typeof RECEIVABLE_STATUSES)[number];

export type CreateInput = {
  amountCents: number;
  customerId?: string | null;
  dueDate?: Date | string | null;
  note?: string;
};

/**
 * Create a receivable for an unpaid order. Safe to call from inside the order
 * transaction (pass the tx) or post-hoc from a dashboard action (pass prisma).
 */
export async function createForUnpaidOrder(
  tx: Tx,
  vendorId: string,
  orderId: string | null,
  { amountCents, customerId, dueDate, note }: CreateInput,
) {
  const amount = Math.max(0, Math.floor(amountCents || 0));
  const due =
    dueDate instanceof Date
      ? dueDate
      : typeof dueDate === "string" && dueDate
        ? new Date(dueDate)
        : null;

  return tx.receivable.create({
    data: {
      vendorId,
      orderId: orderId ?? null,
      customerId: customerId ?? null,
      amountCents: amount,
      status: "OPEN",
      dueDate: due,
      note: (note || "").trim(),
    },
  });
}

export type MarkPaidInput = { amountCents: number };

/**
 * Record a payment against a receivable.
 *  - amount >= outstanding total → status PAID + paidAt set.
 *  - amount < outstanding total  → status PARTIAL, balance left for next call.
 *
 * We store the *running* paid figure by decrementing amountCents (the
 * remaining-due column). This keeps `totalsOpen` a simple SUM without a
 * separate paid-cents column.
 */
export async function markPaid(
  id: string,
  vendorId: string,
  { amountCents }: MarkPaidInput,
) {
  const row = await prisma.receivable.findFirst({
    where: { id, vendorId },
  });
  if (!row) return null;
  if (row.status === "PAID" || row.status === "WRITTEN_OFF") return row;

  const pay = Math.max(0, Math.floor(amountCents || 0));
  const remaining = Math.max(0, row.amountCents - pay);

  if (remaining === 0) {
    return prisma.receivable.update({
      where: { id },
      data: {
        amountCents: 0,
        status: "PAID",
        paidAt: new Date(),
      },
    });
  }

  return prisma.receivable.update({
    where: { id },
    data: {
      amountCents: remaining,
      status: "PARTIAL",
    },
  });
}

export type ListOpts = { status?: ReceivableStatus | "ALL" };

/**
 * Vendor-scoped receivable list. OPEN/PARTIAL surface first (those are the
 * ones the vendor needs to chase), then by due date ascending so the most
 * overdue rows bubble up.
 */
export async function listForVendor(vendorId: string, { status }: ListOpts = {}) {
  const where: Prisma.ReceivableWhereInput = {
    vendorId,
    ...(status && status !== "ALL" ? { status } : {}),
  };

  const rows = await prisma.receivable.findMany({
    where,
    include: {
      customer: true,
      order: { select: { id: true, customerName: true, totalCents: true } },
    },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  // Push PAID / WRITTEN_OFF below OPEN / PARTIAL deterministically (status
  // string sort isn't enough — "PAID" < "PARTIAL" alphabetically).
  const rank: Record<string, number> = {
    OPEN: 0,
    PARTIAL: 1,
    PAID: 2,
    WRITTEN_OFF: 3,
  };
  rows.sort((a, b) => (rank[a.status] ?? 9) - (rank[b.status] ?? 9));
  return rows;
}

/**
 * Sum of outstanding receivables (OPEN + PARTIAL). Powers the "₦ outstanding"
 * card on the dashboard overview.
 */
export async function totalsOpen(vendorId: string): Promise<number> {
  const agg = await prisma.receivable.aggregate({
    _sum: { amountCents: true },
    where: {
      vendorId,
      status: { in: ["OPEN", "PARTIAL"] },
    },
  });
  return agg._sum.amountCents ?? 0;
}
