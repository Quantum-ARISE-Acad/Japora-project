import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentVendor } from "@/lib/auth";
import { getPaymentProvider, newReference } from "@/lib/payments";
import {
  devPaymentSimulatorEnabled,
  getVendorFedaPayConfig,
  hasRealFedaPaySecretKey,
  resolveRequestOrigin,
  settleFedaPayPaymentIntent,
  testFedaPayConnection,
  verifyFedaPayIntentOutcome,
} from "@/lib/payments/fedapay";

/**
 * POST /api/payments/fedapay/complete
 *
 * Handles:
 * 1. `action: "initiate_link"` — creates a FedaPay PaymentIntent for a PaymentLink and returns `checkoutUrl` (real FedaPay URL or sandbox fallback).
 * 2. `action: "initiate_test"` — creates a FedaPay test PaymentIntent from the vendor Money dashboard.
 * 3. `action: "initiate_subscription"` — creates a FedaPay PaymentIntent for the vendor's Japora Pro subscription.
 * 4. `action: "complete"` (default) — completes/settles a FedaPay PaymentIntent, updates linked Order / PaymentLink / Subscription, and sends WhatsApp Cloud API confirmation.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const action = String(body.action || "complete");
  const appBaseUrl = resolveRequestOrigin(req.headers, req.url);

  // 0. Test FedaPay API connection (Sandbox or Live) from Dashboard Money
  if (action === "test_connection") {
    const vendor = await getCurrentVendor();
    if (!vendor) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }
    const env = body.environment === "live" ? "live" : "sandbox";
    const cfg = await getVendorFedaPayConfig(vendor.id, env);
    const providedSecret =
      typeof body.secretKey === "string" && body.secretKey.trim() && !body.secretKey.includes("••••")
        ? body.secretKey.trim()
        : cfg.secretKey;

    const result = await testFedaPayConnection(providedSecret, env);
    return NextResponse.json(result, { status: 200 });
  }

  // 1. Initiate FedaPay checkout for a PaymentLink
  if (action === "initiate_link") {
    const paymentLinkId = String(body.paymentLinkId || "").trim();
    const customerName = String(body.customerName || "Client").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const network = String(body.network || "T-Money").trim();

    if (!paymentLinkId) {
      return NextResponse.json({ error: "paymentLinkId requis." }, { status: 400 });
    }

    const link = await prisma.paymentLink.findUnique({
      where: { id: paymentLinkId },
      include: { vendor: { select: { id: true, shopName: true, currency: true } } },
    });
    if (!link) {
      return NextResponse.json({ error: "Lien de paiement introuvable." }, { status: 404 });
    }
    if (link.isPaid) {
      return NextResponse.json({ error: "Ce lien de paiement a déjà été réglé." }, { status: 409 });
    }

    const reference = newReference();
    const returnUrl = `/pay/link/${link.id}?paid=1`;

    const intent = await prisma.paymentIntent.create({
      data: {
        vendorId: link.vendorId,
        provider: "fedapay",
        providerRef: reference,
        amountCents: link.amountCents,
        currency: link.currency || link.vendor.currency || "XOF",
        status: "pending",
        metadata: JSON.stringify({
          type: "payment_link",
          reference,
          paymentLinkId: link.id,
          title: link.description || "Lien de paiement",
          customerName,
          customerPhone,
          network,
          returnUrl,
        }),
      },
    });

    const provider = getPaymentProvider("fedapay");
    try {
      const initRes = await provider.initiate({
        orderId: link.id,
        vendorId: link.vendorId,
        amountCents: link.amountCents,
        currency: link.currency || link.vendor.currency || "XOF",
        customerName,
        customerPhone,
        reference,
        network,
        returnUrl,
        appBaseUrl,
        metadata: {
          reference,
          paymentLinkId: link.id,
          title: link.description || "Lien de paiement",
        },
      });

      const rawObj =
        initRes.raw && typeof initRes.raw === "object"
          ? (initRes.raw as Record<string, unknown>)
          : {};
      const nextMeta = {
        type: "payment_link",
        reference,
        paymentLinkId: link.id,
        title: link.description || "Lien de paiement",
        customerName,
        customerPhone,
        network,
        returnUrl,
        ...(typeof rawObj.environment === "string" ? { environment: rawObj.environment } : {}),
        ...(typeof rawObj.mode === "string" ? { mode: rawObj.mode } : {}),
      };

      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          providerRef: initRes.providerRef,
          metadata: JSON.stringify(nextMeta),
        },
      });

      return NextResponse.json({
        ok: true,
        paymentIntentId: intent.id,
        providerRef: initRes.providerRef,
        checkoutUrl: initRes.checkoutUrl || `/pay/fedapay-sandbox/${reference}`,
      });
    } catch (e) {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Erreur FedaPay." },
        { status: 502 },
      );
    }
  }

  // 2. Initiate a FedaPay Test Payment or Pro Subscription from Dashboard Money
  if (action === "initiate_test" || action === "initiate_subscription") {
    const vendor = await getCurrentVendor();
    if (!vendor) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const isSub = action === "initiate_subscription";
    const currency = vendor.currency || "XOF";
    const defaultAmountCents = isSub
      ? currency === "XOF" || currency === "XAF"
        ? 5000 * 100
        : 900
      : Number(body.amountCents) > 0
        ? Number(body.amountCents)
        : currency === "XOF" || currency === "XAF"
          ? 2500 * 100
          : 1000;

    const reference = newReference();
    const returnUrl = `/dashboard/billing?ok=1&ref=${reference}`;

    const intent = await prisma.paymentIntent.create({
      data: {
        vendorId: vendor.id,
        provider: "fedapay",
        providerRef: reference,
        amountCents: defaultAmountCents,
        currency,
        status: "pending",
        metadata: JSON.stringify({
          type: isSub ? "subscription" : "fedapay_test",
          reference,
          subscriptionVendorId: isSub ? vendor.id : undefined,
          title: isSub
            ? "Abonnement Japora Pro (Mensuel)"
            : String(body.title || "Encaissement Test FedaPay"),
          customerName: vendor.shopName,
          customerPhone: vendor.whatsappNumber || vendor.momoNumber || "+22890000001",
          returnUrl,
        }),
      },
    });

    const provider = getPaymentProvider("fedapay");
    try {
      const initRes = await provider.initiate({
        orderId: intent.id,
        vendorId: vendor.id,
        amountCents: defaultAmountCents,
        currency,
        customerName: vendor.shopName,
        customerPhone: vendor.whatsappNumber || "+22890000001",
        reference,
        returnUrl,
        appBaseUrl,
        metadata: {
          reference,
          type: isSub ? "subscription" : "fedapay_test",
          subscriptionVendorId: isSub ? vendor.id : undefined,
        },
      });

      const rawObj =
        initRes.raw && typeof initRes.raw === "object"
          ? (initRes.raw as Record<string, unknown>)
          : {};
      const nextMeta = {
        type: isSub ? "subscription" : "fedapay_test",
        reference,
        subscriptionVendorId: isSub ? vendor.id : undefined,
        title: isSub
          ? "Abonnement Japora Pro (Mensuel)"
          : String(body.title || "Encaissement Test FedaPay"),
        customerName: vendor.shopName,
        customerPhone: vendor.whatsappNumber || vendor.momoNumber || "+22890000001",
        returnUrl,
        ...(typeof rawObj.environment === "string" ? { environment: rawObj.environment } : {}),
        ...(typeof rawObj.mode === "string" ? { mode: rawObj.mode } : {}),
      };

      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: {
          providerRef: initRes.providerRef,
          metadata: JSON.stringify(nextMeta),
        },
      });

      return NextResponse.json({
        ok: true,
        paymentIntentId: intent.id,
        providerRef: initRes.providerRef,
        checkoutUrl: initRes.checkoutUrl || `/pay/fedapay-sandbox/${reference}`,
      });
    } catch (e) {
      await prisma.paymentIntent.update({
        where: { id: intent.id },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Erreur FedaPay." },
        { status: 502 },
      );
    }
  }

  // 3. Complete / Settle a FedaPay Transaction
  const providerRef = String(body.providerRef || "").trim();
  const fedaTxId = body.fedaTxId ? String(body.fedaTxId).trim() : undefined;
  const outcome = body.outcome === "failed" ? "failed" : "succeeded";
  const wallet = String(body.wallet || "T-Money Togo").trim();
  const customerPhone = String(body.customerPhone || "").trim();
  const customerName = String(body.customerName || "").trim();

  if (!providerRef) {
    return NextResponse.json({ error: "Référence de transaction manquante." }, { status: 400 });
  }

  const intent = await prisma.paymentIntent.findFirst({
    where: {
      provider: "fedapay",
      OR: [
        { providerRef },
        { metadata: { contains: providerRef } },
      ],
    },
    orderBy: { createdAt: "desc" },
  });

  if (!intent) {
    return NextResponse.json({ error: "Transaction introuvable." }, { status: 404 });
  }

  // The browser only reports what it saw. A real FedaPay payment is checked with
  // FedaPay; the sandbox checkout is accepted only where the simulator is allowed.
  let intentMeta: { environment?: unknown; mode?: unknown } = {};
  try {
    intentMeta = intent.metadata ? JSON.parse(intent.metadata) : {};
  } catch {
    // ignore malformed metadata
  }
  const storedEnv =
    intentMeta.environment === "live" || intentMeta.environment === "sandbox"
      ? intentMeta.environment
      : undefined;
  const cfg = await getVendorFedaPayConfig(intent.vendorId, storedEnv);
  const createdBySimulator = intentMeta.mode === "sandbox_local";
  let verifiedOutcome: "succeeded" | "failed" | "pending";
  if (!createdBySimulator && hasRealFedaPaySecretKey(cfg.secretKey, cfg.environment)) {
    verifiedOutcome = (await verifyFedaPayIntentOutcome(intent, fedaTxId)).outcome;
  } else if (devPaymentSimulatorEnabled()) {
    verifiedOutcome = outcome;
  } else {
    return NextResponse.json({ error: "Paiement simulé désactivé sur ce serveur." }, { status: 403 });
  }

  const settled = await settleFedaPayPaymentIntent({
    intentId: intent.id,
    outcome: verifiedOutcome,
    fedaTxId,
    wallet,
    customerPhone: customerPhone || undefined,
    customerName: customerName || undefined,
  });

  return NextResponse.json({
    ok: true,
    status: settled.status,
    redirectUrl: settled.redirectUrl,
    providerRef,
  });
}
