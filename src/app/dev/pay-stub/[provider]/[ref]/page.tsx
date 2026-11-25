import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import PayStubClient from "./PayStubClient";

type Params = { params: Promise<{ provider: string; ref: string }> };

export const metadata = { title: "Japora — Test payment" };

/**
 * Dev-only mock checkout page. Stub payment providers (momo / orange / wave /
 * chipper / cash) redirect customers here during checkout. The page reads the
 * pending PaymentIntent, shows what would normally be a hosted payment form,
 * and exposes Pay/Fail/Pending buttons that drive the same state transitions
 * the real provider webhooks do.
 *
 * This is the missing piece that makes the entire commerce loop demoable
 * end-to-end without any Paystack/Flutterwave/M-Pesa credentials.
 */
export default async function PayStubPage({ params }: Params) {
  const { provider, ref } = await params;

  const enabled =
    process.env.NODE_ENV !== "production" ||
    process.env.JAPORA_ENABLE_DEV_PAY_STUB === "1";
  if (!enabled) notFound();

  const intent = await prisma.paymentIntent.findFirst({
    where: { providerRef: ref },
  });
  if (!intent) notFound();

  const order = intent.orderId
    ? await prisma.order.findUnique({
        where: { id: intent.orderId },
        include: { items: true, vendor: { select: { shopName: true } } },
      })
    : null;

  const providerLabel: Record<string, string> = {
    paystack: "Paystack",
    flutterwave: "Flutterwave",
    mpesa: "M-Pesa",
    momo: "MTN MoMo",
    orange: "Orange Money",
    wave: "Wave",
    chipper: "Chipper Cash",
    cash: "Cash on delivery",
    manual: "Manual",
  };
  const label = providerLabel[provider] ?? provider;

  return (
    <div className="flex min-h-screen items-center justify-center bg-arctic-100 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-lg font-black text-white">J</span>
            <span className="text-xl font-bold text-arctic-900">Japora</span>
          </Link>
        </div>

        <div className="card overflow-hidden">
          <div className="border-b border-arctic-200 bg-amber-50 px-5 py-3 text-xs font-semibold text-amber-800">
            🧪 DEV MODE — this is a test checkout page. No real money will move.
          </div>

          <div className="space-y-4 p-6">
            <div>
              <div className="text-xs uppercase tracking-wide text-arctic-600">
                Pay with
              </div>
              <div className="text-xl font-bold text-arctic-900">{label}</div>
            </div>

            {order ? (
              <div className="rounded-xl border border-arctic-200 bg-arctic-50 p-4">
                <div className="mb-2 text-xs uppercase tracking-wide text-arctic-600">
                  Order from {order.vendor?.shopName}
                </div>
                <ul className="space-y-1 text-sm text-arctic-700">
                  {order.items.map((it) => (
                    <li key={it.id} className="flex justify-between gap-3">
                      <span className="truncate">
                        {it.quantity}× {it.productName}
                        {it.size && <span className="text-arctic-400"> ({it.size})</span>}
                      </span>
                      <span className="whitespace-nowrap font-medium">
                        {formatMoney(it.quantity * it.unitPriceCents, intent.currency)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-3 flex items-center justify-between border-t border-arctic-200 pt-2 text-sm font-bold">
                  <span>Total</span>
                  <span>{formatMoney(intent.amountCents, intent.currency)}</span>
                </div>
                {order.customerName && (
                  <div className="mt-2 text-xs text-arctic-600">
                    Customer: {order.customerName}
                    {order.customerPhone && <> · {order.customerPhone}</>}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-arctic-200 bg-arctic-50 p-4">
                <div className="text-sm text-arctic-600">
                  Amount: <strong>{formatMoney(intent.amountCents, intent.currency)}</strong>
                </div>
                <div className="text-xs text-arctic-600">
                  Reference: {ref}
                </div>
              </div>
            )}

            <div className="text-xs text-arctic-600">
              Status:{" "}
              <span className="font-mono font-semibold">{intent.status}</span>
            </div>

            <PayStubClient
              providerRef={ref}
              alreadyTerminal={
                intent.status === "succeeded" ||
                intent.status === "failed" ||
                intent.status === "refunded"
              }
            />

            <p className="text-center text-xs text-arctic-400">
              In production this page is replaced by the real {label} hosted
              checkout. This dev stub exists so you can verify the order →
              payment → receivable flow without external credentials.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
