import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  getPaymentProvider,
  isValidProviderName,
  type PaymentProviderName,
} from "@/lib/payments";
import { evaluateAndGrant } from "@/lib/trust";
import { recordConfirmedOrder } from "@/lib/funnel";
import { settleFedaPayPaymentIntent } from "@/lib/payments/fedapay";

/**
 * POST /api/payments/webhook/[provider]
 *
 * Single inbound hook for every rail. The path parameter selects the provider
 * impl; that impl verifies its own signature against the raw request body. We
 * always return 200 after handling so retries don't pile up on our side — the
 * audit trail lives in PaymentIntent + structured logs.
 *
 * Event-shape mapping per provider is best-effort: each rail has its own
 * vocabulary (success/successful/0). We normalise to PaymentStatus and trust
 * provider.verify() for authoritative status when in doubt.
 */
type RouteContext = { params: Promise<{ provider: string }> };

export async function POST(req: NextRequest, ctx: RouteContext) {
  const { provider: providerParam } = await ctx.params;
  if (!isValidProviderName(providerParam)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  }
  const providerName = providerParam as PaymentProviderName;
  const provider = getPaymentProvider(providerName);

  const rawBody = await req.text();
  const sigOk = provider.verifyWebhookSignature(rawBody, req.headers);
  if (!sigOk) {
    logger.warn("payments.webhook.bad_signature", { provider: providerName });
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let payload: Record<string, unknown> = {};
  if (rawBody) {
    try {
      payload = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      // CinetPay / PayGate post form-encoded notifications, not JSON.
      try {
        payload = Object.fromEntries(new URLSearchParams(rawBody));
      } catch {
        logger.warn("payments.webhook.unparseable", { provider: providerName });
        // Still 200 so the provider doesn't infinite-retry — we logged it.
        return NextResponse.json({ ok: true });
      }
    }
  }

  const parsed = extractEvent(providerName, payload);
  logger.info("payments.webhook.received", {
    provider: providerName,
    providerRef: parsed.providerRef,
    eventStatus: parsed.status,
  });

  if (!parsed.providerRef) {
    return NextResponse.json({ ok: true });
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: {
      provider: providerName,
      OR: [
        { providerRef: parsed.providerRef },
        { metadata: { contains: parsed.providerRef } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });
  if (!intent) {
    logger.warn("payments.webhook.intent_not_found", {
      provider: providerName,
      providerRef: parsed.providerRef,
    });
    return NextResponse.json({ ok: true });
  }

  // Dedicated FedaPay webhook handling (covers Orders, PaymentLinks, and Subscriptions + WhatsApp notification)
  if (providerName === "fedapay") {
    const obj = (payload.object ?? payload.transaction ?? payload.data ?? {}) as Record<string, any>;
    const fedaId = obj.id !== undefined ? String(obj.id) : intent.providerRef || "";
    let verifiedOutcome = parsed.status;
    try {
      const v = await provider.verify(fedaId);
      verifiedOutcome = v.status;
    } catch {
      // keep parsed.status
    }
    await settleFedaPayPaymentIntent({
      intentId: intent.id,
      outcome: verifiedOutcome,
      fedaTxId: obj.id !== undefined ? String(obj.id) : undefined,
      rawTransaction: obj,
    });
    return NextResponse.json({ ok: true });
  }

  // For trust: confirm status via the provider's verify endpoint when the
  // event reports success. Webhook payloads can be tampered with even when
  // the signature checks out (e.g. via a leaked HMAC secret in dev). The
  // verify call is the source of truth for "money received".
  let finalStatus = parsed.status;
  let verifiedAmountCents: number | undefined = parsed.amountCents;
  if (parsed.status === "succeeded") {
    try {
      const v = await provider.verify(parsed.providerRef);
      finalStatus = v.status;
      if (typeof v.amountCents === "number") verifiedAmountCents = v.amountCents;
    } catch (e) {
      logger.error("payments.webhook.verify_failed", {
        provider: providerName,
        providerRef: parsed.providerRef,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Idempotency: skip if we've already recorded a terminal status.
  if (intent.status === "succeeded" || intent.status === "failed" || intent.status === "refunded") {
    logger.info("payments.webhook.already_terminal", {
      paymentIntentId: intent.id,
      currentStatus: intent.status,
    });
    return NextResponse.json({ ok: true });
  }

  await prisma.paymentIntent.update({
    where: { id: intent.id },
    data: {
      status: finalStatus === "succeeded" ? "succeeded" : finalStatus === "failed" ? "failed" : "pending",
      completedAt: finalStatus === "succeeded" || finalStatus === "failed" ? new Date() : null,
    },
  });

  if (finalStatus === "succeeded" && intent.orderId) {
    const amount = verifiedAmountCents ?? intent.amountCents;
    const order = await prisma.order.findUnique({ where: { id: intent.orderId } });
    if (order) {
      const newPaid = Math.min(order.totalCents, order.paidCents + amount);
      const fullyPaid = newPaid >= order.totalCents;
      await prisma.order.update({
        where: { id: order.id },
        data: {
          paidCents: newPaid,
          status: fullyPaid ? "PAID" : order.status,
        },
      });
      logger.info("payments.webhook.order_updated", {
        orderId: order.id,
        paidCents: newPaid,
        fullyPaid,
      });

      if (fullyPaid) {
        const linked = await prisma.receivable.findMany({
          where: { orderId: order.id, status: { not: "PAID" } },
        });
        for (const r of linked) {
          await prisma.receivable.update({
            where: { id: r.id },
            data: { status: "PAID", paidAt: new Date() },
          });
          logger.info("payments.webhook.receivable_settled", {
            receivableId: r.id,
            orderId: order.id,
          });
        }
        // Re-check verified-shop criteria now that another order is paid.
        await evaluateAndGrant(order.vendorId).catch(() => {});
        const v = await prisma.vendor.findUnique({ where: { id: order.vendorId }, select: { shopSlug: true } });
        if (v) {
          await recordConfirmedOrder({
            orderId: order.id,
            vendorId: order.vendorId,
            shopSlug: v.shopSlug,
            totalCents: order.totalCents,
            sessionId: order.sessionId,
          }).catch(() => {});
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Pluck { providerRef, status, amountCents } from each rail's event shape.
 * Defensive — unknown shapes simply yield undefined fields, and the caller
 * treats that as "no-op, still 200 the provider".
 */
function extractEvent(
  provider: PaymentProviderName,
  payload: Record<string, unknown>,
): { providerRef?: string; status: "pending" | "succeeded" | "failed"; amountCents?: number } {
  // FedaPay webhook: { entity: "event", name: "transaction.approved", object: { id, status, amount, custom_metadata } }
  if (provider === "fedapay") {
    const obj = (payload.object ?? payload.transaction ?? payload.data ?? {}) as Record<string, unknown>;
    const customMeta = (obj.custom_metadata ?? {}) as Record<string, unknown>;
    const ref =
      typeof customMeta.reference === "string"
        ? customMeta.reference
        : obj.id !== undefined
          ? String(obj.id)
          : typeof payload.providerRef === "string"
            ? payload.providerRef
            : undefined;
    const eventName = String(payload.name ?? "");
    const status = String(obj.status ?? payload.status ?? "").toLowerCase();
    const mapped =
      eventName.includes("approved") ||
      eventName.includes("transferred") ||
      status === "approved" ||
      status === "succeeded"
        ? "succeeded"
        : eventName.includes("declined") ||
            eventName.includes("canceled") ||
            status === "declined" ||
            status === "failed"
          ? "failed"
          : "pending";
    const amountMajor = typeof obj.amount === "number" ? obj.amount : undefined;
    return {
      providerRef: ref,
      status: mapped,
      amountCents: typeof amountMajor === "number" ? Math.round(amountMajor * 100) : undefined,
    };
  }
  // Paystack: { event: "charge.success", data: { reference, status, amount } }
  if (provider === "paystack") {
    const event = String(payload.event ?? "");
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const reference = typeof data.reference === "string" ? data.reference : undefined;
    const status = typeof data.status === "string" ? data.status : "";
    const amount = typeof data.amount === "number" ? data.amount : undefined;
    const mapped =
      event === "charge.success" || status === "success"
        ? "succeeded"
        : event === "charge.failed" || status === "failed" || status === "abandoned"
        ? "failed"
        : "pending";
    return { providerRef: reference, status: mapped, amountCents: amount };
  }
  // Flutterwave: { event: "charge.completed", data: { tx_ref, status, amount } }
  if (provider === "flutterwave") {
    const data = (payload.data ?? {}) as Record<string, unknown>;
    const reference = typeof data.tx_ref === "string" ? data.tx_ref : undefined;
    const status = typeof data.status === "string" ? data.status : "";
    const amountMajor = typeof data.amount === "number" ? data.amount : undefined;
    const mapped =
      status === "successful"
        ? "succeeded"
        : status === "failed"
        ? "failed"
        : "pending";
    return {
      providerRef: reference,
      status: mapped,
      amountCents: typeof amountMajor === "number" ? Math.round(amountMajor * 100) : undefined,
    };
  }
  // CinetPay notify (form-encoded): { cpm_trans_id, cpm_amount, ... }.
  // The notify is just a ping — we return "succeeded" so the webhook handler
  // runs the authoritative /payment/check via verify().
  if (provider === "cinetpay") {
    const ref =
      typeof payload.cpm_trans_id === "string"
        ? payload.cpm_trans_id
        : typeof payload.transaction_id === "string"
          ? payload.transaction_id
          : undefined;
    return { providerRef: ref, status: ref ? "succeeded" : "pending" };
  }
  // PayGate notify (form-encoded): { identifier, tx_reference, ... }.
  // Same pattern — defer to verify() (/api/v1/status) for the real outcome.
  if (provider === "paygate") {
    const ref =
      typeof payload.identifier === "string"
        ? payload.identifier
        : typeof payload.tx_reference === "string"
          ? payload.tx_reference
          : undefined;
    return { providerRef: ref, status: ref ? "succeeded" : "pending" };
  }
  // M-Pesa Daraja STK callback:
  // { Body: { stkCallback: { CheckoutRequestID, ResultCode, CallbackMetadata: { Item: [...] } } } }
  if (provider === "mpesa") {
    const body = (payload.Body ?? {}) as Record<string, unknown>;
    const cb = (body.stkCallback ?? {}) as Record<string, unknown>;
    const ref = typeof cb.CheckoutRequestID === "string" ? cb.CheckoutRequestID : undefined;
    const code = cb.ResultCode;
    const meta = (cb.CallbackMetadata ?? {}) as Record<string, unknown>;
    const items = Array.isArray(meta.Item) ? (meta.Item as Array<Record<string, unknown>>) : [];
    let amountMajor: number | undefined;
    for (const it of items) {
      if (it.Name === "Amount" && typeof it.Value === "number") amountMajor = it.Value;
    }
    const mapped =
      code === 0 || code === "0" ? "succeeded" : code === undefined ? "pending" : "failed";
    return {
      providerRef: ref,
      status: mapped,
      amountCents: typeof amountMajor === "number" ? Math.round(amountMajor * 100) : undefined,
    };
  }
  // Stubs: accept { providerRef, status, amountCents } payloads for dev.
  const ref =
    typeof payload.providerRef === "string"
      ? payload.providerRef
      : typeof payload.reference === "string"
      ? payload.reference
      : undefined;
  const status = typeof payload.status === "string" ? payload.status : "";
  const mapped =
    status === "succeeded" || status === "success"
      ? "succeeded"
      : status === "failed"
      ? "failed"
      : "pending";
  const amountCents = typeof payload.amountCents === "number" ? payload.amountCents : undefined;
  return { providerRef: ref, status: mapped, amountCents };
}
