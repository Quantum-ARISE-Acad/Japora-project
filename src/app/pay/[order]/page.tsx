import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { getVendorFedaPayConfig } from "@/lib/payments/fedapay";
import VerifiedBadge from "@/components/VerifiedBadge";
import PayClient from "./PayClient";
import { getServerTr } from "@/lib/public-locale";

/**
 * Customer pay surface — /pay/[order].
 *
 * Offers strictly two checkout solutions:
 *  1. FedaPay API v1 (T-Money, Flooz, MTN MoMo, Celtiis & Visa/Mastercard) — Live or Sandbox
 *  2. Paiement à la livraison (Cash on delivery)
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
    title: row
      ? (await getServerTr())(`Paiement — ${row.vendor.shopName}`, `Payment — ${row.vendor.shopName}`)
      : (await getServerTr())("Paiement", "Payment"),
    robots: { index: false },
  };
}

export default async function PayPage({
  params,
  searchParams,
}: {
  params: Promise<{ order: string }>;
  searchParams?: Promise<{ paid?: string; failed?: string; cod?: string }>;
}) {
  const tr = await getServerTr();
  const { order: orderId } = await params;
  const sp = (await searchParams) ?? {};

  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    include: {
      items: true,
      vendor: {
        select: {
          id: true,
          shopName: true,
          shopSlug: true,
          whatsappNumber: true,
          momoNumber: true,
          currency: true,
          verifiedAt: true,
        },
      },
    },
  });
  if (!order) notFound();

  const fedaConfig = await getVendorFedaPayConfig(order.vendor.id);
  const currency = order.vendor.currency || "XOF";
  const balanceCents = Math.max(0, order.totalCents - order.paidCents);
  const fullyPaid = balanceCents <= 0 || order.status === "PAID" || order.status === "DELIVERED";
  const isCashOnDelivery =
    sp.cod === "1" ||
    (order.note || "").toLowerCase().includes("paiement à la livraison") ||
    (order.note || "").toLowerCase().includes("[paiement: cash]");
  const ref = orderId.slice(0, 8).toUpperCase();

  return (
    <div className="min-h-screen bg-arctic-100 px-4 py-8">
      <div className="mx-auto w-full max-w-md a-fade-in">
        {/* Brand */}
        <Link href={`/c/${order.vendor.shopSlug}`} className="mb-6 flex items-center justify-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-shape-md bg-arctic-800 text-base font-black text-arctic-50">
            J
          </span>
          <span className="a-title-md tracking-[-0.01em] text-arctic-900">Japora</span>
        </Link>

        <div className="card overflow-hidden">
          {/* Header: who + how much */}
          <div className="border-b border-arctic-400/30 px-5 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <p className="a-label-md text-arctic-500">{tr("Commande chez", "Order at")}</p>
                <span className="a-label-md font-semibold text-arctic-800">{order.vendor.shopName}</span>
                {order.vendor.verifiedAt && <VerifiedBadge size="sm" withLabel={false} />}
              </div>
              {!fullyPaid && fedaConfig.environment === "sandbox" && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  {tr("Mode Sandbox", "Sandbox mode")}
                </span>
              )}
            </div>
            <p className="mt-1 a-num text-3xl font-bold text-arctic-900">
              {formatMoney(fullyPaid ? order.totalCents : balanceCents, currency)}
            </p>
            <p className="mt-0.5 a-label-md text-arctic-500">
              {tr("Commande #", "Order #")}{ref}
              {order.paidCents > 0 && !fullyPaid && (
                <> · {formatMoney(order.paidCents, currency)} {tr("déjà réglés", "already paid")}</>
              )}
            </p>
          </div>

          {fullyPaid ? (
            <div className="space-y-3 p-6 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-100 text-emerald-700">
                <svg viewBox="0 0 24 24" width={26} height={26} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M4 12.5l5 5L20 6" />
                </svg>
              </div>
              <p className="text-base font-bold text-arctic-900">
                {tr("Paiement confirmé !", "Payment confirmed!")}
              </p>
              <p className="a-body-sm text-arctic-600">
                {tr("Votre commande #", "Your order #")}{ref} {tr("chez", "at")} <strong>{order.vendor.shopName}</strong> {tr("est intégralement réglée. Merci pour votre confiance !", "is fully paid. Thank you for your trust!")}
              </p>
              <div className="pt-2 flex flex-col gap-2">
                <Link href={`/c/${order.vendor.shopSlug}`} className="btn-primary justify-center">
                  {tr("Retourner sur la boutique", "Back to the shop")} {order.vendor.shopName}
                </Link>
              </div>
            </div>
          ) : (
            <PayClient
              orderId={order.id}
              amountLabel={formatMoney(balanceCents, currency)}
              shopName={order.vendor.shopName}
              shopSlug={order.vendor.shopSlug}
              vendorWhatsApp={order.vendor.whatsappNumber || order.vendor.momoNumber || ""}
              fedaEnvironment={fedaConfig.environment}
              initialCodSelected={isCashOnDelivery}
              paymentFailed={sp.failed === "1"}
            />
          )}
        </div>

        {/* Order lines */}
        <div className="mt-4 rounded-shape-lg border border-arctic-400/30 bg-arctic-50 p-4">
          <p className="a-eyebrow mb-2">{tr("Votre commande", "Your order")}</p>
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
                <span>{tr("Livraison", "Delivery")}</span>
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
          {tr("Propulsé par", "Powered by")} <span className="font-semibold text-arctic-700">Japora × FedaPay</span>
        </p>
      </div>
    </div>
  );
}
