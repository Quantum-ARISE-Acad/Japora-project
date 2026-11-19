import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import {
  fedapayProvider,
  settleFedaPayPaymentIntent,
  resolveRequestOrigin,
  extractFedaWebhookEntity,
  getVendorFedaPayConfig,
  verifyFedaPaySignatureWithSecret,
  verifyFedaPayIntentOutcome,
  type FedaJson,
} from "@/lib/payments/fedapay";
import type { Prisma } from "@prisma/client";

/**
 * GET /api/payments/fedapay/callback
 *
 * Browser redirect endpoint after a buyer completes (or cancels) checkout on
 * FedaPay (`https://process.fedapay.com/...` or `https://sandbox-process.fedapay.com/...`).
 *
 * FedaPay appends `?id=<FEDAPAY_TX_ID>&status=<approved|declined|canceled>&close=true`
 * to our `callback_url` (`/api/payments/fedapay/callback?ref=japora_...`).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fedaTxId = searchParams.get("id")?.trim() || "";
  const ref = searchParams.get("ref")?.trim() || "";
  const statusParam = (searchParams.get("status") || "").toLowerCase().trim();
  const returnUrlParam = searchParams.get("returnUrl")?.trim() || "";

  const baseUrl = resolveRequestOrigin(req.headers, req.url);
  // Only paths on our own site: a full URL here would let anyone use Japora to redirect elsewhere.
  const toAbsoluteUrl = (path: string) => {
    const safe = path.startsWith("/") && !path.startsWith("//") ? path : "/dashboard/billing";
    return `${baseUrl}${safe}`;
  };

  try {
    // 1. Locate the PaymentIntent by FedaPay transaction ID or Japora reference
    const orFilters: Prisma.PaymentIntentWhereInput[] = [];
    if (fedaTxId) {
      orFilters.push({ providerRef: fedaTxId });
    }
    if (ref) {
      orFilters.push({ providerRef: ref });
      orFilters.push({ metadata: { contains: ref } });
    }

    const intent =
      orFilters.length > 0
        ? await prisma.paymentIntent.findFirst({
            where: {
              provider: "fedapay",
              OR: orFilters,
            },
            orderBy: { createdAt: "desc" },
          })
        : null;

    if (!intent) {
      logger.warn("payments.fedapay.callback_intent_not_found", {
        fedaTxId,
        ref,
        statusParam,
      });
      return NextResponse.redirect(
        toAbsoluteUrl(returnUrlParam || "/dashboard/billing"),
      );
    }

    // 2. Verify authoritative status from FedaPay API v1 (`GET /v1/transactions/{id}`).
    // The `status` query parameter comes from the browser and is not trusted.
    const verified = await verifyFedaPayIntentOutcome(intent, fedaTxId || undefined);
    const verifiedOutcome = verified.outcome;
    const rawJson = (verified.raw || {}) as FedaJson;
    const rawTx = rawJson["v1/transaction"] || rawJson.transaction || rawJson.data || null;

    const settled = await settleFedaPayPaymentIntent({
      intentId: intent.id,
      outcome: verifiedOutcome,
      fedaTxId: fedaTxId || undefined,
      rawTransaction: rawTx,
    });

    return NextResponse.redirect(toAbsoluteUrl(settled.redirectUrl));
  } catch (err) {
    logger.error("payments.fedapay.callback_error", {
      fedaTxId,
      ref,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.redirect(
      toAbsoluteUrl(returnUrlParam || "/dashboard/billing"),
    );
  }
}

/**
 * POST /api/payments/fedapay/callback
 *
 * Also supports FedaPay webhook POST notifications sent to this URL.
 */
export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    if (!fedapayProvider.verifyWebhookSignature(rawBody, req.headers)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const payload = JSON.parse(rawBody || "{}") as FedaJson;
    const obj = extractFedaWebhookEntity(payload);
    const customMeta = (obj.custom_metadata || {}) as FedaJson;
    const fedaTxId = obj.id ? String(obj.id) : "";
    const ref = typeof customMeta.reference === "string" ? customMeta.reference : "";

    const orFilters: Prisma.PaymentIntentWhereInput[] = [];
    if (fedaTxId) orFilters.push({ providerRef: fedaTxId });
    if (ref) {
      orFilters.push({ providerRef: ref });
      orFilters.push({ metadata: { contains: ref } });
    }

    const intent =
      orFilters.length > 0
        ? await prisma.paymentIntent.findFirst({
            where: { provider: "fedapay", OR: orFilters },
            orderBy: { createdAt: "desc" },
          })
        : null;

    if (!intent) {
      return NextResponse.json({ ok: true, note: "intent_not_found" });
    }

    // A webhook secret set by the vendor in the dashboard must also match.
    const vendorCfg = await getVendorFedaPayConfig(intent.vendorId);
    if (
      vendorCfg.webhookSecret &&
      !verifyFedaPaySignatureWithSecret(rawBody, req.headers, vendorCfg.webhookSecret)
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const verified = await verifyFedaPayIntentOutcome(intent, fedaTxId || undefined);
    const settled = await settleFedaPayPaymentIntent({
      intentId: intent.id,
      outcome: verified.outcome,
      fedaTxId: fedaTxId || undefined,
      rawTransaction: obj,
    });

    return NextResponse.json({ ok: true, status: settled.status });
  } catch (err) {
    logger.error("payments.fedapay.webhook_post_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true });
  }
}

