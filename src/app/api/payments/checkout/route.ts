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
import { resolveRequestOrigin } from "@/lib/payments/fedapay";
import { getServerTr } from "@/lib/public-locale";

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
  const tr = await getServerTr();
  let body: { orderId?: string; provider?: string; returnUrl?: string; network?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: tr("Corps JSON invalide.", "Invalid JSON body.") }, { status: 400 });
  }

  const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
  const providerName = typeof body.provider === "string" ? body.provider.trim() : "";
  const returnUrl = typeof body.returnUrl === "string" ? body.returnUrl.trim() : undefined;
  const network = typeof body.network === "string" ? body.network.trim() : undefined;

  if (!orderId) {
    return NextResponse.json({ error: tr("orderId est obligatoire.", "orderId is required.") }, { status: 400 });
  }
  if (!providerName || !isValidProviderName(providerName)) {
    return NextResponse.json({ error: tr("Moyen de paiement inconnu.", "Unknown payment provider.") }, { status: 400 });
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
    return NextResponse.json({ error: tr("Commande introuvable.", "Order not found.") }, { status: 404 });
  }

  const balanceCents = Math.max(0, order.totalCents - order.paidCents);
  if (balanceCents <= 0) {
    return NextResponse.json(
      { error: tr("Cette commande est déjà entièrement payée.", "Order already fully paid.") },
      { status: 409 },
    );
  }

  const provider = getPaymentProvider(providerName as PaymentProviderName);
  const reference = newReference();
  const appBaseUrl = resolveRequestOrigin(req.headers, req.url);

  // Create the intent up-front so we always have an audit row even if the
  // provider call later throws.
  const effectiveReturnUrl = returnUrl || `/pay/${order.id}?paid=1`;
  const initialMeta: Record<string, unknown> = {
    ip,
    reference,
    orderId: order.id,
    title: `Commande #${order.id.slice(-6).toUpperCase()}`,
    customerName: order.customerName,
    customerPhone: order.customerPhone,
    network: network ?? (providerName === "cash" ? "Paiement à la livraison" : null),
    returnUrl: effectiveReturnUrl,
  };

  const intent = await prisma.paymentIntent.create({
    data: {
      orderId: order.id,
      vendorId: order.vendorId,
      provider: providerName,
      providerRef: reference,
      amountCents: balanceCents,
      currency: order.vendor.currency || "XOF",
      status: "created",
      metadata: JSON.stringify(initialMeta),
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
      appBaseUrl,
      reference,
      network,
      metadata: { orderId: order.id, vendorId: order.vendorId, reference },
    });

    const rawObj =
      result.raw && typeof result.raw === "object"
        ? (result.raw as Record<string, unknown>)
        : {};
    const mergedMeta = {
      ...initialMeta,
      ...(typeof rawObj.environment === "string" ? { environment: rawObj.environment } : {}),
      ...(typeof rawObj.mode === "string" ? { mode: rawObj.mode } : {}),
    };

    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        providerRef: result.providerRef,
        status: result.status === "failed" ? "failed" : "pending",
        metadata: JSON.stringify(mergedMeta),
      },
    });

    // When Cash on Delivery is selected on /pay/[order], tag the order note if not already tagged
    if (providerName === "cash" && !(order.note || "").includes("Paiement à la livraison")) {
      const nextNote = `[PAIEMENT: Paiement à la livraison]\n${order.note || ""}`.trim();
      await prisma.order
        .update({
          where: { id: order.id },
          data: { note: nextNote },
        })
        .catch(() => {});
    }

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
      environment: typeof rawObj.environment === "string" ? rawObj.environment : undefined,
      mode: typeof rawObj.mode === "string" ? rawObj.mode : undefined,
    });
  } catch (e) {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "failed" },
    });
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("payments.checkout.error", {
      orderId: order.id,
      provider: providerName,
      error: msg,
    });
    return NextResponse.json(
      { error: msg || "Impossible d'initialiser le paiement FedaPay." },
      { status: 502 },
    );
  }
}
