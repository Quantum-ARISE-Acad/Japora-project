import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { getClientIp, rateLimit, tooManyRequests, envLimit } from "@/lib/ratelimit";
import {
  getPaymentProvider,
  isValidProviderName,
  newReference,
  type PaymentProviderName,
} from "@/lib/payments";

/**
 * POST /api/payments/checkout
 *
 * Public — no vendor auth — because this is the buyer-facing flow. The order
 * id is the capability token: anyone with a valid id can pay. We rate-limit
 * per (ip, orderId) so a leaked id can't be replayed to spam provider APIs.
 *
 * Body: { orderId, provider, returnUrl? }
 * Returns: { checkoutUrl?, providerRef, status, paymentIntentId }
 */
export async function POST(req: NextRequest) {
  let body: { orderId?: string; provider?: string; returnUrl?: string; network?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const providerName = typeof body.provider === "string" ? body.provider.trim() : "";
  const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl.trim() : undefined;
  const network = typeof body.network === "string" ? body.network.trim() : undefined;

  if (!orderId) {
    return NextResponse.json({ error: "orderId is required." }, { status: 400 });
  }
  if (!providerName || !isValidProviderName(providerName)) {
    return NextResponse.json({ error: "Unknown payment provider." }, { status: 400 });
  }

  const ip = getClientIp(req);
  const rl = rateLimit({
    key: `payments.checkout:${ip}:${orderId}`,
    limit: envLimit("CHECKOUT_RATE_LIMIT", 10),
    windowMs: 60_000,
  });
  if (!rl.allowed) return tooManyRequests(rl);

  const order = await prisma.order.findFirst({
    where: { id: orderId, deletedAt: null },
    include: { vendor: { select: { id: true, currency: true } } },
  });
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const balanceCents = Math.max(0, order.totalCents - order.paidCents);
  if (balanceCents <= 0) {
    return NextResponse.json(
      { error: "Order already fully paid." },
      { status: 409 },
    );
  }

  const provider = getPaymentProvider(providerName as PaymentProviderName);
  const reference = newReference();

  // Create the intent up-front so we always have an audit row even if the
  // provider call later throws.
  const effectiveReturnUrl = returnUrl || `/pay/${order.id}?paid=1`;
  const intent = await prisma.paymentIntent.create({
    data: {
      orderId: order.id,
      vendorId: order.vendorId,
      provider: providerName,
      providerRef: reference,
      amountCents: balanceCents,
      currency: order.vendor.currency || "XOF",
      status: "created",
      metadata: JSON.stringify({
        ip,
        reference,
        orderId: order.id,
        title: `Commande #${order.id.slice(-6).toUpperCase()}`,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        network: network ?? null,
        returnUrl: effectiveReturnUrl,
      }),
    },
  });

  try {
    const result = await provider.initiate({
      orderId: order.id,
      vendorId: order.vendorId,
      amountCents: balanceCents,
      currency: order.vendor.currency || "XOF",
      customerEmail: undefined,
      customerPhone: order.customerPhone || undefined,
      customerName: order.customerName,
      returnUrl: effectiveReturnUrl,
      reference,
      network,
      metadata: { orderId: order.id, vendorId: order.vendorId, reference },
    });

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        providerRef: result.providerRef,
        status: result.status === "failed" ? "failed" : "pending",
      },
    });

    logger.info("payments.checkout.initiated", {
      orderId: order.id,
      vendorId: order.vendorId,
      provider: providerName,
      providerRef: result.providerRef,
      status: result.status,
      paymentIntentId: intent.id,
    });

    return NextResponse.json({
      paymentIntentId: intent.id,
      providerRef: result.providerRef,
      checkoutUrl: result.checkoutUrl ?? null,
      status: result.status,
    });
  } catch (e) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "failed" },
    });
    logger.error("payments.checkout.error", {
      orderId: order.id,
      provider: providerName,
      error: e instanceof Error ? e.message : String(e),
    });
    return NextResponse.json(
      { error: "Failed to initiate payment." },
      { status: 502 },
    );
  }
}
