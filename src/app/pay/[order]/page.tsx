import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { buildUssdInstructions } from "@/lib/payments/ussd";
import { apiFallbackForCurrency, PROVIDER_META } from "@/lib/payments";
import VerifiedBadge from "@/components/VerifiedBadge";
import PayClient from "./PayClient";

/**
 * Customer pay surface — /pay/[order].
 *
 * The order id is the capability token: anyone the vendor hands the link to can
 * pay. We lead with USSD (dial-code) mobile money — the quick/default method
 * that works on any phone with no smartphone, data, card, or provider account —
 * and offer the hosted provider API ("pay automatically") only as a fallback
 * where the vendor has a rail configured.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ order: string }>;
}): Promise<Metadata> {
  const { order } = await params;
  const row = await prisma.order.findFirst({
    where: { id: order, deletedAt: null },
    select: { vendor: { select: { shopName: true } } },
  });
  return {
    title: row ? `Pay ${row.vendor.shopName}` : "Pay",
    robots: { index: false },
  };
}

export default async function PayPage({ params }: { params: Promise<{ order: string }> }) {
  const { order: orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    include: {
      items: true,
      vendor: {
        select: {
          shopName: true,
          whatsappNumber: true,
          momoNumber: true,
          currency: true,
          verifiedAt: true,
        },
      },
    },
  });
  if (!order) notFound();

  const currency = order.vendor.currency || "XOF";
  const balanceCents = Math.max(0, order.totalCents - order.paidCents);
  const fullyPaid = balanceCents <= 0;

  // Prefer the dedicated mobile-money payee; fall back to the WhatsApp number
  // (usually the same SIM in Togo) when the vendor hasn't set a separate one.
  const payeeNumber = order.vendor.momoNumber || order.vendor.whatsappNumber || "";
  let ussd = buildUssdInstructions({ currency, payeeNumber, amountCents: balanceCents });
  if (ussd.networks.length === 0) {
    ussd = buildUssdInstructions({ currency: "XOF", payeeNumber, amountCents: balanceCents });
  }
  const apiProvider = apiFallbackForCurrency(currency);
  const apiLabel = apiProvider ? PROVIDER_META[apiProvider].label : null;
  const ref = orderId.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-arctic-100 px-4 py-8">
      <div className="mx-auto w-full max-w-md a-fade-in">
        {/* Brand */}
        <Link href="/" className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-800 text-base font-black text-arctic-50">
            J
          </span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        <div className="card overflow-hidden">
          {/* Header: who + how much */}
          <div className="border-b border-arctic-400/30 px-5 py-4">
            <div className="flex items-center gap-1.5">
              <p className="a-label-md text-arctic-500">Pay</p>
              <span className="a-label-md font-semibold text-arctic-800">{order.vendor.shopName}</span>
              {order.vendor.verifiedAt && <VerifiedBadge size="sm" withLabel={false} />}
            </div>
            <p className="mt-1 a-num text-3xl font-bold text-arctic-900">
              {formatMoney(balanceCents, currency)}
            </p>
            <p className="mt-0.5 a-label-md text-arctic-500">
              Order {ref}
              {order.paidCents > 0 && !fullyPaid && (
                <> · {formatMoney(order.paidCents, currency)} already paid</>
              )}
            </p>
          </div>

          {fullyPaid ? (
            <div className="space-y-3 p-6 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand/10 text-brand-dark">
                {/* check */}
                <svg viewBox="0 0 24 24" width={22} height={22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 12.5l5 5L20 6" />
                </svg>
              </div>
              <p className="font-semibold text-arctic-900">This order is fully paid.</p>
              <p className="a-body-sm text-arctic-600">Nothing left to pay. Thank you!</p>
              <Link href="/" className="btn-ghost mt-2 inline-flex">Done</Link>
            </div>
          ) : (
            <PayClient
              orderId={order.id}
              currency={currency}
              amountLabel={formatMoney(balanceCents, currency)}
              ussd={ussd}
              apiProvider={apiProvider}
              apiLabel={apiLabel}
              shopName={order.vendor.shopName}
              vendorWhatsApp={order.vendor.whatsappNumber || order.vendor.momoNumber || ""}
            />
          )}
        </div>

        {/* Order lines */}
        <div className="mt-4 rounded-shape-lg border border-arctic-400/30 bg-arctic-50 p-4">
          <p className="a-eyebrow mb-2">Your order</p>
          <ul className="a-ledger space-y-1">
            {order.items.map((it) => (
              <li key={it.id} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-arctic-700">
                  {it.quantity}× {it.productName}
                  {it.size && <span className="text-arctic-400"> ({it.size})</span>}
                </span>
                <span className="a-num whitespace-nowrap font-medium text-arctic-800">
                  {formatMoney(it.quantity * it.unitPriceCents, currency)}
                </span>
              </li>
            ))}
            {order.deliveryFeeCents > 0 && (
              <li className="flex justify-between text-sm">
                <span>Livraison</span>
                <span>{formatMoney(order.deliveryFeeCents, currency)}</span>
              </li>
            )}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-arctic-400/30 pt-2 text-sm font-bold">
            <span className="text-arctic-900">Total</span>
            <span className="a-num text-arctic-900">{formatMoney(order.totalCents, currency)}</span>
          </div>
        </div>

        <p className="mt-5 text-center a-label-md text-arctic-500">
          Powered by <span className="font-semibold text-arctic-700">Japora</span>
        </p>
      </div>
    </div>
  );
}
