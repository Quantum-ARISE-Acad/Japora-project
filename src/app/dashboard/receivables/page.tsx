import { requireVendor } from "@/lib/auth";
import { listForVendor, totalsOpen } from "@/lib/receivables";
import ReceivablesClient from "./ReceivablesClient";

export default async function ReceivablesPage() {
  const vendor = await requireVendor();

  const [receivables, outstandingCents] = await Promise.all([
    listForVendor(vendor.id),
    totalsOpen(vendor.id),
  ]);

  const rows = receivables.map((r) => ({
    id: r.id,
    amountCents: r.amountCents,
    status: r.status,
    dueDate: r.dueDate ? r.dueDate.toISOString() : null,
    paidAt: r.paidAt ? r.paidAt.toISOString() : null,
    note: r.note,
    createdAt: r.createdAt.toISOString(),
    customer: r.customer
      ? {
          id: r.customer.id,
          name: r.customer.name,
          phone: r.customer.phone,
        }
      : null,
    order: r.order
      ? {
          id: r.order.id,
          customerName: r.order.customerName,
          totalCents: r.order.totalCents,
        }
      : null,
  }));

  return (
    <ReceivablesClient
      initialRows={rows}
      outstandingCents={outstandingCents}
      currency={vendor.currency}
      shopName={vendor.shopName}
    />
  );
}
