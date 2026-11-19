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
} from "@/lib/payments/fedapay";

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
  const toAbsoluteUrl = (pathOrUrl: string) => {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      return pathOrUrl;
    }
    return `${baseUrl}${pathOrUrl.startsWith("/") ? "" : "/"}${pathOrUrl}`;
  };

  try {
    // 1. Locate the PaymentIntent by FedaPay transaction ID or Japora reference
    const orFilters: Array<Record<string, any>> = [];
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

    // 2. Verify authoritative status from FedaPay API v1 (`GET /v1/transactions/{id}`)
    const lookupId = fedaTxId || intent.providerRef;
    let verifiedOutcome: "succeeded" | "failed" | "pending" = "pending";
    let rawTx: Record<string, any> | null = null;

    if (lookupId) {
      const verifyRes = await fedapayProvider.verify(lookupId);
      verifiedOutcome = verifyRes.status;
      const rawJson = (verifyRes.raw || {}) as Record<string, any>;
      rawTx =
        rawJson["v1/transaction"] ||
        rawJson.transaction ||
        rawJson.data ||
        null;
    }

    // If API reports pending right at redirect time, check query param fallback for explicit cancel/decline
    if (verifiedOutcome === "pending") {
      if (
        statusParam === "declined" ||
        statusParam === "canceled" ||
        statusParam === "cancelled"
      ) {
        verifiedOutcome = "failed";
      }
    }

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

    const payload = JSON.parse(rawBody || "{}") as Record<string, any>;
    const obj = extractFedaWebhookEntity(payload);
    const customMeta = (obj.custom_metadata || {}) as Record<string, any>;
    const fedaTxId = obj.id ? String(obj.id) : "";
    const ref = typeof customMeta.reference === "string" ? customMeta.reference : "";

    const orFilters: Array<Record<string, any>> = [];
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

    const vendorCfg = await getVendorFedaPayConfig(intent.vendorId);
    if (
      vendorCfg.webhookSecret &&
      !verifyFedaPaySignatureWithSecret(rawBody, req.headers, vendorCfg.webhookSecret)
    ) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const verifyRes = await fedapayProvider.verify(fedaTxId || intent.providerRef || "");
    const settled = await settleFedaPayPaymentIntent({
      intentId: intent.id,
      outcome: verifyRes.status,
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

