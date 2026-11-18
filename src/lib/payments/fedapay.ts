/**
 * FedaPay Payment Provider (Live & Sandbox REST API v1) for Japora.
 *
 * Official FedaPay API endpoints:
 * - Live:    https://api.fedapay.com/v1
 * - Sandbox: https://sandbox-api.fedapay.com/v1
 *
 * Covers West Africa (Togo T-Money & Flooz/Moov, Bénin MTN/Moov/Celtiis,
 * Côte d'Ivoire, Sénégal, Burkina Faso, Mali, Niger, Guinée) + Visa / Mastercard.
 */
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "../db";
import { logger } from "../logger";
import { providerMajorAmount, majorToCents, convertCurrency } from "../currency";
import { formatMoney } from "../utils";
import { sendWhatsApp } from "../whatsapp";
import { evaluateAndGrant } from "../trust";
import { recordConfirmedOrder } from "../funnel";
import { recordVendorActivity } from "../clerk-vendor-sync";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

/** FedaPay answers with loosely shaped JSON (v1/transaction, transaction, data...). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- FedaPay's JSON has no published types
export type FedaJson = Record<string, any>;

export type FedaPayConfig = {
  environment: "sandbox" | "live";
  publicKey: string;
  secretKey: string;
  webhookSecret?: string;
  enabled: boolean;
};

export function fedapayConfigured(): boolean {
  // A simulator must not become the automatic fallback for real payments.
  return hasRealFedaPaySecretKey(process.env.FEDAPAY_SECRET_KEY || "");
}

export function getAppBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174").replace(/\/$/, "");
}

function resolveFedaPayEnvironment(
  secretKey: string,
  preferredEnv?: string | null,
): "sandbox" | "live" {
  const trimmed = (secretKey || "").trim();
  if (trimmed.startsWith("sk_live_")) return "live";
  if (trimmed.startsWith("sk_sandbox_")) return "sandbox";
  const env = (
    preferredEnv ||
    process.env.FEDAPAY_ENV ||
    process.env.FEDAPAY_ENVIRONMENT ||
    "sandbox"
  )
    .toLowerCase()
    .trim();
  return env === "live" || env === "production" ? "live" : "sandbox";
}

function isDemoOrEmptyKey(key?: string | null): boolean {
  const k = (key || "").trim();
  if (!k) return true;
  if (k.includes("japora_demo") || k.includes("test_placeholder") || k.includes("••••")) {
    return true;
  }
  return false;
}

export async function getVendorFedaPayConfig(vendorId?: string): Promise<FedaPayConfig> {
  const envSecretKey = (process.env.FEDAPAY_SECRET_KEY || "").trim();
  const envPublicKey = (
    process.env.FEDAPAY_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_FEDAPAY_PUBLIC_KEY ||
    ""
  ).trim();
  const envMode = resolveFedaPayEnvironment(envSecretKey, process.env.FEDAPAY_ENV);

  const defaultConfig: FedaPayConfig = {
    environment: envMode,
    publicKey: envPublicKey || "pk_sandbox_japora_demo",
    secretKey: envSecretKey,
    webhookSecret: (process.env.FEDAPAY_WEBHOOK_SECRET || "").trim(),
    enabled: true,
  };

  if (!vendorId) return defaultConfig;

  try {
    const vendor = await prisma.vendor.findUnique({
      where: { id: vendorId },
      select: { uiPrefs: true },
    });
    if (vendor?.uiPrefs) {
      const prefs =
        typeof vendor.uiPrefs === "string"
          ? JSON.parse(vendor.uiPrefs)
          : (vendor.uiPrefs as Record<string, unknown>);
      if (prefs?.fedapayConfig && typeof prefs.fedapayConfig === "object") {
        const fc = prefs.fedapayConfig as Record<string, unknown>;
        const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        const chosenSecret = !isDemoOrEmptyKey(str(fc.secretKey)) ? str(fc.secretKey) : defaultConfig.secretKey;
        const chosenPublic = !isDemoOrEmptyKey(str(fc.publicKey)) ? str(fc.publicKey) : defaultConfig.publicKey;
        const resolvedEnv = resolveFedaPayEnvironment(chosenSecret, str(fc.environment));
        return {
          environment: resolvedEnv,
          publicKey: chosenPublic,
          secretKey: chosenSecret,
          webhookSecret: str(fc.webhookSecret) || defaultConfig.webhookSecret,
          enabled: fc.enabled !== false,
        };
      }
    }
  } catch {
    // ignore JSON/DB errors and use default
  }

  return defaultConfig;
}

export function hasRealFedaPaySecretKey(secretKey: string): boolean {
  const trimmed = (secretKey || "").trim();
  if (!trimmed || isDemoOrEmptyKey(trimmed) || trimmed.length < 18) {
    return false;
  }
  return trimmed.startsWith("sk_sandbox_") || trimmed.startsWith("sk_live_");
}

export function fedaApiBaseUrl(env: "sandbox" | "live"): string {
  return env === "live"
    ? "https://api.fedapay.com/v1"
    : "https://sandbox-api.fedapay.com/v1";
}

/**
 * Parses a customer phone number into FedaPay's `{ number, country }` structure.
 * Supports Togo (+228), Bénin (+229), Côte d'Ivoire (+225), Sénégal (+221),
 * Burkina Faso (+226), Mali (+223), Niger (+227), Guinée (+224).
 */
export function parseFedaPayPhone(rawPhone?: string | null): {
  number: string;
  country: string;
} | null {
  if (!rawPhone) return null;
  const digits = rawPhone.replace(/[^\d+]/g, "");
  const cleanDigits = digits.replace(/^\+/, "").replace(/^00/, "");
  if (!cleanDigits || cleanDigits.length < 8) return null;

  const prefixes: Array<{ code: string; country: string; len: number }> = [
    { code: "228", country: "tg", len: 8 },
    { code: "229", country: "bj", len: 8 },
    { code: "225", country: "ci", len: 10 },
    { code: "221", country: "sn", len: 9 },
    { code: "226", country: "bf", len: 8 },
    { code: "223", country: "ml", len: 8 },
    { code: "227", country: "ne", len: 8 },
    { code: "224", country: "gn", len: 9 },
  ];

  for (const p of prefixes) {
    if (cleanDigits.startsWith(p.code)) {
      const local = cleanDigits.slice(p.code.length);
      if (local.length >= 8) {
        return { number: `+${p.code}${local}`, country: p.country };
      }
    }
  }

  // Default to Togo (+228) if 8 digits local number
  if (cleanDigits.length === 8) {
    return { number: `+228${cleanDigits}`, country: "tg" };
  }

  return null;
}

function extractFedaTransaction(json: FedaJson): FedaJson | null {
  if (!json || typeof json !== "object") return null;
  const tx =
    json["v1/transaction"] ||
    json.v1?.transaction ||
    json.transaction ||
    json.data ||
    (typeof json.id === "number" && json.status ? json : null);
  return tx && typeof tx === "object" ? tx : null;
}

function extractFedaTokenUrl(
  tokenJson: FedaJson,
  txObj?: FedaJson | null,
): string | null {
  if (tokenJson && typeof tokenJson === "object") {
    const url =
      tokenJson.url ||
      tokenJson["v1/token"]?.url ||
      tokenJson.v1?.token?.url ||
      tokenJson.token?.url ||
      tokenJson.data?.url;
    if (typeof url === "string" && url.startsWith("http")) {
      return url;
    }
  }
  if (txObj && typeof txObj.payment_url === "string" && txObj.payment_url.startsWith("http")) {
    return txObj.payment_url;
  }
  return null;
}

export const fedapayProvider: PaymentProvider = {
  name: "fedapay",

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const cfg = await getVendorFedaPayConfig(opts.vendorId);

    // FedaPay settles in XOF (or GNF). Convert non-XOF currencies cleanly to XOF.
    const rawCurrency = (opts.currency || "XOF").toUpperCase();
    const xofCents =
      rawCurrency === "XOF"
        ? opts.amountCents
        : convertCurrency(opts.amountCents, rawCurrency, "XOF");
    const amountXof = Math.max(100, providerMajorAmount(xofCents, { multipleOf: 5 }));

    if (hasRealFedaPaySecretKey(cfg.secretKey)) {
      try {
        const base = fedaApiBaseUrl(cfg.environment);
        const rawName = (opts.customerName || "Client Japora").trim();
        const [firstName, ...rest] = rawName.split(/\s+/);
        const lastName = rest.join(" ") || "Client";

        const safeRefSlug = opts.reference.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase() || "order";
        const customerEmail =
          opts.customerEmail && opts.customerEmail.includes("@")
            ? opts.customerEmail.trim()
            : `client.${safeRefSlug}@japora.com`;

        // Build callback_url so FedaPay redirects the buyer back to our verification route
        const callbackParams = new URLSearchParams({ ref: opts.reference });
        if (opts.returnUrl) {
          callbackParams.set("returnUrl", opts.returnUrl);
        }
        const callbackUrl = `${getAppBaseUrl()}/api/payments/fedapay/callback?${callbackParams.toString()}`;

        const parsedPhone = parseFedaPayPhone(opts.customerPhone);

        const buildPayload = (includePhone: boolean) => ({
          description: `Japora #${opts.orderId.slice(-6).toUpperCase()} (${opts.reference})`,
          amount: Math.round(amountXof),
          currency: { iso: "XOF" },
          callback_url: callbackUrl,
          custom_metadata: {
            reference: opts.reference,
            orderId: opts.orderId,
            vendorId: opts.vendorId,
            ...(opts.metadata || {}),
          },
          customer: {
            firstname: firstName || "Client",
            lastname: lastName || "Japora",
            email: customerEmail,
            ...(includePhone && parsedPhone ? { phone_number: parsedPhone } : {}),
          },
        });

        let createRes = await fetch(`${base}/transactions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${cfg.secretKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(buildPayload(true)),
        });

        let createJson = (await createRes.json().catch(() => ({}))) as FedaJson;

        // If FedaPay rejects the customer's phone_number (format or existing customer conflict),
        // retry immediately without phone_number so the payment never fails to initialize.
        if (!createRes.ok && parsedPhone) {
          logger.warn("payments.fedapay.retry_without_phone", {
            orderId: opts.orderId,
            status: createRes.status,
            firstAttemptError: createJson,
          });
          createRes = await fetch(`${base}/transactions`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfg.secretKey}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(buildPayload(false)),
          });
          createJson = (await createRes.json().catch(() => ({}))) as FedaJson;
        }

        const txObj = extractFedaTransaction(createJson);

        if (createRes.ok && txObj?.id) {
          // Generate hosted checkout token URL
          const tokenRes = await fetch(`${base}/transactions/${txObj.id}/token`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${cfg.secretKey}`,
              "Content-Type": "application/json",
              Accept: "application/json",
            },
          });
          const tokenJson = (await tokenRes.json().catch(() => ({}))) as FedaJson;
          const checkoutUrl = extractFedaTokenUrl(tokenJson, txObj);

          if (checkoutUrl) {
            logger.info("payments.fedapay.api_initiated", {
              orderId: opts.orderId,
              fedaTxId: txObj.id,
              fedaReference: txObj.reference,
              reference: opts.reference,
              environment: cfg.environment,
              checkoutUrl,
            });
            return {
              checkoutUrl,
              providerRef: String(txObj.id),
              status: "pending",
              raw: {
                mode: cfg.environment,
                transaction: txObj,
                token: tokenJson,
                reference: opts.reference,
              },
            };
          }
        }

        logger.error("payments.fedapay.api_create_failed", {
          orderId: opts.orderId,
          environment: cfg.environment,
          status: createRes.status,
          response: createJson,
        });
      } catch (err) {
        logger.error("payments.fedapay.api_error", {
          orderId: opts.orderId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // Fallback to interactive FedaPay Sandbox Checkout if no valid API key is present
    const sandboxUrl = `/pay/fedapay-sandbox/${encodeURIComponent(opts.reference)}`;
    return {
      checkoutUrl: sandboxUrl,
      providerRef: opts.reference,
      status: "pending",
      raw: {
        mode: "sandbox_local",
        environment: cfg.environment,
        amountXof,
        reference: opts.reference,
      },
    };
  },

  async verify(providerRef: string): Promise<VerifyResult> {
    const intent = await prisma.paymentIntent.findFirst({
      where: {
        provider: "fedapay",
        OR: [
          { providerRef },
          { metadata: { contains: providerRef } },
        ],
      },
    });

    const cfg = await getVendorFedaPayConfig(intent?.vendorId);

    // If providerRef is a numeric FedaPay transaction ID, query GET /v1/transactions/{id}
    if (hasRealFedaPaySecretKey(cfg.secretKey) && /^\d+$/.test(providerRef)) {
      try {
        const base = fedaApiBaseUrl(cfg.environment);
        const res = await fetch(`${base}/transactions/${providerRef}`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${cfg.secretKey}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });
        const json = (await res.json().catch(() => ({}))) as FedaJson;
        const tx = extractFedaTransaction(json);
        const st = String(tx?.status || "").toLowerCase();
        const mapped: VerifyResult["status"] =
          st === "approved" || st === "transferred"
            ? "succeeded"
            : st === "declined" || st === "canceled" || st === "cancelled" || st === "refunded"
              ? "failed"
              : "pending";
        return {
          status: mapped,
          amountCents: typeof tx?.amount === "number" ? majorToCents(tx.amount) : undefined,
          raw: json,
        };
      } catch (e) {
        logger.error("payments.fedapay.verify_error", {
          providerRef,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (intent?.status === "succeeded") {
      return { status: "succeeded", amountCents: intent.amountCents };
    }
    return {
      status: intent?.status === "failed" ? "failed" : "pending",
      amountCents: intent?.amountCents,
    };
  },

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const webhookSecret = (process.env.FEDAPAY_WEBHOOK_SECRET || "").trim();
    if (!webhookSecret) {
      // When no webhook secret is set, the webhook route still calls provider.verify(id)
      // against FedaPay's live API with FEDAPAY_SECRET_KEY before settling!
      return true;
    }

    const sigHeader =
      headers.get("x-fedapay-signature") || headers.get("X-FEDAPAY-SIGNATURE") || "";
    if (!sigHeader) return false;

    try {
      // FedaPay signature format: t=<timestamp>,s=<hmac_sha256>
      const parts = Object.fromEntries(
        sigHeader.split(",").map((part) => {
          const [k, v] = part.trim().split("=");
          return [k, v];
        }),
      );
      if (parts.t && parts.s) {
        const signedPayload = `${parts.t}.${rawBody}`;
        const expected = crypto
          .createHmac("sha256", webhookSecret)
          .update(signedPayload, "utf8")
          .digest("hex");
        return expected === parts.s;
      }
    } catch {
      return false;
    }
    return true;
  },
};

/** The built-in sandbox checkout (no real FedaPay key) is for development and demos only. */
export function devPaymentSimulatorEnabled(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.JAPORA_ENABLE_DEV_PAY_STUB === "1";
}

/**
 * The only trusted answer to "is this payment done?" is FedaPay's own API, never
 * the browser. The transaction created for this intent is preferred; a transaction
 * id sent by the browser is only used when none was stored, and must cover the
 * amount, so one small paid transaction cannot settle a bigger order.
 */
export async function verifyFedaPayIntentOutcome(
  intent: { id: string; vendorId: string; providerRef: string | null; amountCents: number; currency: string },
  claimedTxId?: string,
): Promise<{ outcome: "succeeded" | "failed" | "pending"; raw?: unknown }> {
  const cfg = await getVendorFedaPayConfig(intent.vendorId);
  if (!hasRealFedaPaySecretKey(cfg.secretKey)) return { outcome: "pending" };
  const numeric = (v?: string | null) => (v && /^\d+$/.test(v) ? v : "");
  const txId = numeric(intent.providerRef) || numeric(claimedTxId);
  if (!txId) return { outcome: "pending" };
  const res = await fedapayProvider.verify(txId);
  if (
    res.status === "succeeded" &&
    intent.currency.toUpperCase() === "XOF" &&
    typeof res.amountCents === "number" &&
    res.amountCents < intent.amountCents
  ) {
    logger.warn("payments.fedapay.amount_mismatch", { intentId: intent.id, txId });
    return { outcome: "pending", raw: res.raw };
  }
  return { outcome: res.status, raw: res.raw };
}

/**
 * Shared settlement helper for FedaPay transactions (used by GET callback, POST webhook,
 * and local sandbox completion). Idempotent: safe to call multiple times.
 */
export async function settleFedaPayPaymentIntent(opts: {
  intentId: string;
  outcome: "succeeded" | "failed" | "pending";
  fedaTxId?: string;
  wallet?: string;
  customerPhone?: string;
  customerName?: string;
  rawTransaction?: FedaJson | null;
}): Promise<{
  status: "succeeded" | "failed" | "pending";
  redirectUrl: string;
  orderId?: string | null;
  paymentLinkId?: string | null;
}> {
  const intent = await prisma.paymentIntent.findUnique({
    where: { id: opts.intentId },
  });

  if (!intent) {
    return { status: "failed", redirectUrl: "/dashboard/billing?canceled=1" };
  }

  let meta: FedaJson = {};
  try {
    meta = intent.metadata ? JSON.parse(intent.metadata) : {};
  } catch {
    meta = {};
  }

  const wasAlreadySucceeded = intent.status === "succeeded";
  const walletLabel =
    opts.wallet ||
    opts.rawTransaction?.mode ||
    meta.wallet ||
    meta.network ||
    "FedaPay";
  const customerPhone = opts.customerPhone || meta.customerPhone || "";
  const customerName = opts.customerName || meta.customerName || "";

  const updatedMeta = {
    ...meta,
    wallet: walletLabel,
    ...(customerPhone ? { customerPhone } : {}),
    ...(customerName ? { customerName } : {}),
    ...(opts.fedaTxId ? { fedaTxId: opts.fedaTxId } : {}),
    ...(opts.rawTransaction?.reference ? { fedaReference: opts.rawTransaction.reference } : {}),
    settledAt: new Date().toISOString(),
  };

  if (!wasAlreadySucceeded && opts.outcome !== "pending") {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: {
        status: opts.outcome,
        ...(opts.fedaTxId ? { providerRef: String(opts.fedaTxId) } : {}),
        completedAt: new Date(),
        metadata: JSON.stringify(updatedMeta),
      },
    });
  }

  let redirectUrl = meta.returnUrl || "/dashboard/billing";

  if (opts.outcome === "succeeded") {
    const vendor = await prisma.vendor.findUnique({
      where: { id: intent.vendorId },
      select: {
        id: true,
        shopName: true,
        shopSlug: true,
        currency: true,
        whatsappNumber: true,
      },
    });

    // A) Settle linked Order if present
    if (intent.orderId) {
      const order = await prisma.order.findUnique({
        where: { id: intent.orderId },
      });
      if (order) {
        if (order.status !== "PAID" && order.status !== "DELIVERED") {
          const newPaid = Math.max(order.totalCents, order.paidCents + intent.amountCents);
          await prisma.order.update({
            where: { id: order.id },
            data: {
              paidCents: newPaid,
              status: "PAID",
              ...(customerPhone && !order.customerPhone ? { customerPhone } : {}),
              ...(customerName && (!order.customerName || order.customerName === "Guest")
                ? { customerName }
                : {}),
            },
          });

          await prisma.receivable.updateMany({
            where: { orderId: order.id, status: { not: "PAID" } },
            data: { status: "PAID", paidAt: new Date() },
          });

          await evaluateAndGrant(order.vendorId).catch(() => {});
          if (vendor) {
            await recordConfirmedOrder({
              orderId: order.id,
              vendorId: order.vendorId,
              shopSlug: vendor.shopSlug,
              totalCents: order.totalCents,
              sessionId: order.sessionId,
            }).catch(() => {});
          }

          const amountText = formatMoney(intent.amountCents, intent.currency);
          const buyerPhone = customerPhone || order.customerPhone;
          if (buyerPhone && vendor) {
            await sendWhatsApp({
              vendorId: vendor.id,
              to: buyerPhone,
              orderId: order.id,
              body:
                `✅ *Paiement confirmé via FedaPay !*\n\n` +
                `Boutique : *${vendor.shopName}*\n` +
                `Commande : *#${order.id.slice(-6).toUpperCase()}*\n` +
                `Montant réglé : *${amountText}*\n` +
                `Réf FedaPay : \`${opts.fedaTxId || intent.providerRef}\`\n\n` +
                `Merci pour votre confiance ! Votre commande est en cours de préparation.`,
            }).catch(() => {});
          }

          if (vendor?.whatsappNumber) {
            await sendWhatsApp({
              vendorId: vendor.id,
              to: vendor.whatsappNumber,
              orderId: order.id,
              body:
                `💰 *Nouveau paiement FedaPay reçu !*\n\n` +
                `Commande : *#${order.id.slice(-6).toUpperCase()}*\n` +
                `Client : ${customerName || order.customerName} (${buyerPhone || "N/A"})\n` +
                `Montant : *${amountText}* via *${walletLabel}*`,
            }).catch(() => {});
          }
        }

        redirectUrl = meta.returnUrl || `/pay/${order.id}?paid=1`;
        try {
          revalidatePath(`/pay/${order.id}`);
          revalidatePath("/dashboard/orders");
        } catch {}
      }
    }

    // B) Settle linked PaymentLink if present
    if (meta.paymentLinkId) {
      const link = await prisma.paymentLink.findUnique({
        where: { id: String(meta.paymentLinkId) },
      });
      if (link) {
        if (!link.isPaid) {
          await prisma.paymentLink.update({
            where: { id: link.id },
            data: { isPaid: true, paidAt: new Date() },
          });

          const amountText = formatMoney(link.amountCents, link.currency);
          const buyerPhone = customerPhone || meta.customerPhone;
          if (buyerPhone && vendor) {
            await sendWhatsApp({
              vendorId: vendor.id,
              to: buyerPhone,
              body:
                `✅ *Paiement reçu via FedaPay*\n\n` +
                `Objet : *${link.description || "Lien de paiement"}*\n` +
                `Boutique : *${vendor.shopName}*\n` +
                `Montant : *${amountText}*\n` +
                `Réf : \`${opts.fedaTxId || intent.providerRef}\`\n\n` +
                `Merci pour votre règlement !`,
            }).catch(() => {});
          }
        }

        redirectUrl = meta.returnUrl || `/pay/link/${link.id}?paid=1`;
        try {
          revalidatePath(`/pay/link/${link.id}`);
          revalidatePath("/dashboard/payment-links");
        } catch {}
      }
    }

    // C) Activate Subscription if present
    if (meta.subscriptionVendorId) {
      await prisma.vendor.update({
        where: { id: String(meta.subscriptionVendorId) },
        data: { subscriptionStatus: "active" },
      });
      redirectUrl = "/dashboard/billing?ok=1";
    }

    if (!wasAlreadySucceeded) {
      await recordVendorActivity({
        vendorId: intent.vendorId,
        type: "payment.fedapay.succeeded",
        subjectType: intent.orderId ? "order" : "payment_intent",
        subjectId: intent.orderId || intent.id,
        data: {
          paymentIntentId: intent.id,
          providerRef: opts.fedaTxId || intent.providerRef,
          amountCents: intent.amountCents,
          currency: intent.currency,
          wallet: walletLabel,
        },
      }).catch(() => {});
    }
  } else if (opts.outcome === "failed") {
    if (intent.orderId) {
      redirectUrl = `/pay/${intent.orderId}?failed=1`;
    } else if (meta.paymentLinkId) {
      redirectUrl = `/pay/link/${meta.paymentLinkId}?failed=1`;
    } else {
      redirectUrl = "/dashboard/billing?canceled=1";
    }
  } else {
    // Still pending
    if (intent.orderId) {
      redirectUrl = `/pay/${intent.orderId}`;
    } else if (meta.paymentLinkId) {
      redirectUrl = `/pay/link/${meta.paymentLinkId}`;
    } else {
      redirectUrl = "/dashboard/billing";
    }
  }

  try {
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard");
  } catch {}

  return {
    status: opts.outcome,
    redirectUrl,
    orderId: intent.orderId,
    paymentLinkId: meta.paymentLinkId || null,
  };
}
