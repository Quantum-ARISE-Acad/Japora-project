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
  sandboxPublicKey?: string;
  sandboxSecretKey?: string;
  livePublicKey?: string;
  liveSecretKey?: string;
  webhookSecret?: string;
  enabled: boolean;
};

export function fedapayConfigured(): boolean {
  // A simulator must not become the automatic fallback for real payments:
  // only a real key (sandbox or live) for the default environment counts.
  const env = getDefaultEnvMode();
  const key = pickKeyForEnv(
    [env === "live" ? process.env.FEDAPAY_LIVE_SECRET_KEY : process.env.FEDAPAY_SANDBOX_SECRET_KEY, process.env.FEDAPAY_SECRET_KEY],
    "sk",
    env,
  );
  return hasRealFedaPaySecretKey(key, env);
}

export function getAppBaseUrl(reqOrigin?: string | null): string {
  if (reqOrigin && /^https?:\/\//i.test(reqOrigin.trim())) {
    return reqOrigin.trim().replace(/\/$/, "");
  }
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.trim().replace(/\/$/, "")}`;
  }
  return "http://localhost:5174";
}

export function resolveRequestOrigin(headers: Headers, fallbackUrl?: string): string {
  const fwdHost = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = fwdHost || headers.get("host")?.split(",")[0]?.trim();
  if (host) {
    const fwdProto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    const proto = fwdProto || (host.includes("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  if (fallbackUrl) {
    try {
      return new URL(fallbackUrl).origin;
    } catch {
      // ignore
    }
  }
  return getAppBaseUrl();
}

function isDemoOrEmptyKey(key?: string | null): boolean {
  const k = (key || "").trim();
  if (!k) return true;
  if (k.includes("japora_demo") || k.includes("test_placeholder") || k.includes("••••")) {
    return true;
  }
  return false;
}

function keyMatchesEnv(key: string, kind: "sk" | "pk", env: "sandbox" | "live"): boolean {
  const k = (key || "").trim();
  if (isDemoOrEmptyKey(k)) return false;
  const expectedPrefix = `${kind}_${env}_`;
  return k.startsWith(expectedPrefix);
}

function pickKeyForEnv(
  candidates: Array<string | null | undefined>,
  kind: "sk" | "pk",
  env: "sandbox" | "live",
): string {
  for (const c of candidates) {
    const val = (c || "").trim();
    if (keyMatchesEnv(val, kind, env)) return val;
  }
  return "";
}

function getDefaultEnvMode(): "sandbox" | "live" {
  const env = (process.env.FEDAPAY_ENV || process.env.FEDAPAY_ENVIRONMENT || "sandbox")
    .toLowerCase()
    .trim();
  if (env === "sandbox" || env === "test") return "sandbox";
  if (env === "live" || env === "production") return "live";
  const secret = (process.env.FEDAPAY_SECRET_KEY || "").trim();
  return secret.startsWith("sk_live_") ? "live" : "sandbox";
}

export async function getVendorFedaPayConfig(
  vendorId?: string,
  forceEnvironment?: "sandbox" | "live",
): Promise<FedaPayConfig> {
  const envGenericSecret = (process.env.FEDAPAY_SECRET_KEY || "").trim();
  const envGenericPublic = (
    process.env.FEDAPAY_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_FEDAPAY_PUBLIC_KEY ||
    ""
  ).trim();
  const envSandboxSecret = pickKeyForEnv(
    [process.env.FEDAPAY_SANDBOX_SECRET_KEY, envGenericSecret],
    "sk",
    "sandbox",
  );
  const envSandboxPublic = pickKeyForEnv(
    [
      process.env.FEDAPAY_SANDBOX_PUBLIC_KEY,
      process.env.NEXT_PUBLIC_FEDAPAY_SANDBOX_PUBLIC_KEY,
      envGenericPublic,
    ],
    "pk",
    "sandbox",
  );
  const envLiveSecret = pickKeyForEnv(
    [process.env.FEDAPAY_LIVE_SECRET_KEY, envGenericSecret],
    "sk",
    "live",
  );
  const envLivePublic = pickKeyForEnv(
    [process.env.FEDAPAY_LIVE_PUBLIC_KEY, envGenericPublic],
    "pk",
    "live",
  );
  const envWebhookSecret = (process.env.FEDAPAY_WEBHOOK_SECRET || "").trim();

  let chosenEnv: "sandbox" | "live" = forceEnvironment || getDefaultEnvMode();
  let fc: FedaJson | null = null;

  if (vendorId) {
    try {
      const vendor = await prisma.vendor.findUnique({
        where: { id: vendorId },
        select: { uiPrefs: true },
      });
      if (vendor?.uiPrefs) {
        const prefs =
          typeof vendor.uiPrefs === "string"
            ? JSON.parse(vendor.uiPrefs)
            : (vendor.uiPrefs as FedaJson);
        if (prefs?.fedapayConfig && typeof prefs.fedapayConfig === "object") {
          fc = prefs.fedapayConfig;
          if (!forceEnvironment && (fc?.environment === "sandbox" || fc?.environment === "live")) {
            chosenEnv = fc.environment;
          }
        }
      }
    } catch {
      // ignore JSON/DB errors and use default
    }
  }

  const sandboxSecretKey = pickKeyForEnv(
    [fc?.sandboxSecretKey, fc?.secretKey, envSandboxSecret],
    "sk",
    "sandbox",
  );
  const sandboxPublicKey = pickKeyForEnv(
    [fc?.sandboxPublicKey, fc?.publicKey, envSandboxPublic],
    "pk",
    "sandbox",
  );
  const liveSecretKey = pickKeyForEnv(
    [fc?.liveSecretKey, fc?.secretKey, envLiveSecret],
    "sk",
    "live",
  );
  const livePublicKey = pickKeyForEnv(
    [fc?.livePublicKey, fc?.publicKey, envLivePublic],
    "pk",
    "live",
  );

  const activeSecretKey = chosenEnv === "live" ? liveSecretKey : sandboxSecretKey;
  const activePublicKey = chosenEnv === "live" ? livePublicKey : sandboxPublicKey;

  return {
    environment: chosenEnv,
    publicKey: activePublicKey,
    secretKey: activeSecretKey,
    sandboxPublicKey,
    sandboxSecretKey,
    livePublicKey,
    liveSecretKey,
    webhookSecret:
      (typeof fc?.webhookSecret === "string" && fc.webhookSecret.trim()) || envWebhookSecret,
    enabled: fc ? fc.enabled !== false : true,
  };
}

export function hasRealFedaPaySecretKey(
  secretKey: string,
  env?: "sandbox" | "live",
): boolean {
  const trimmed = (secretKey || "").trim();
  if (!trimmed || isDemoOrEmptyKey(trimmed) || trimmed.length < 18) {
    return false;
  }
  if (env === "sandbox") return trimmed.startsWith("sk_sandbox_");
  if (env === "live") return trimmed.startsWith("sk_live_");
  return trimmed.startsWith("sk_sandbox_") || trimmed.startsWith("sk_live_");
}

export function fedaApiBaseUrl(env: "sandbox" | "live"): string {
  return env === "live"
    ? "https://api.fedapay.com/v1"
    : "https://sandbox-api.fedapay.com/v1";
}

/**
 * Verifies connectivity against the FedaPay REST API v1 (`GET /v1/transactions?per_page=1`).
 */
export async function testFedaPayConnection(
  secretKey: string,
  env: "sandbox" | "live",
): Promise<{ ok: boolean; message: string }> {
  if (!hasRealFedaPaySecretKey(secretKey, env)) {
    return {
      ok: false,
      message:
        env === "sandbox"
          ? "Aucune clé secrète Sandbox (sk_sandbox_...) configurée. Le simulateur Sandbox intégré sera utilisé pour les tests."
          : "Clé secrète Live invalide ou manquante (doit commencer par sk_live_...).",
    };
  }
  try {
    const base = fedaApiBaseUrl(env);
    const res = await fetch(`${base}/transactions?per_page=1`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey.trim()}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
    if (res.ok) {
      return {
        ok: true,
        message:
          env === "sandbox"
            ? "✅ Connexion FedaPay Sandbox API v1 réussie (sandbox-api.fedapay.com) !"
            : "✅ Connexion FedaPay Live API v1 réussie (api.fedapay.com) !",
      };
    }
    const errJson = (await res.json().catch(() => ({}))) as FedaJson;
    const detail = errJson.message || errJson.error || `HTTP ${res.status}`;
    return {
      ok: false,
      message: `❌ FedaPay ${env.toUpperCase()} a rejeté la clé (${detail}).`,
    };
  } catch (err) {
    return {
      ok: false,
      message: `❌ Erreur réseau FedaPay : ${err instanceof Error ? err.message : String(err)}`,
    };
  }
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
    json.entity ||
    json.transaction ||
    json.data ||
    (typeof json.id === "number" && json.status ? json : null);
  return tx && typeof tx === "object" ? tx : null;
}

/**
 * Extracts the Transaction object from a FedaPay webhook event payload.
 * Official FedaPay Event shape: `{ class_name: "Event", name: "transaction.approved", entity: { id, status, amount, mode, custom_metadata, ... } }`.
 */
export function extractFedaWebhookEntity(payload: FedaJson): FedaJson {
  if (!payload || typeof payload !== "object") return {};
  const candidate =
    payload.entity ??
    payload.object ??
    payload.transaction ??
    payload.data ??
    payload;
  return candidate && typeof candidate === "object" ? (candidate as FedaJson) : {};
}

function formatFedaErrorMessage(json: FedaJson, status: number): string {
  const base =
    typeof json?.message === "string" && json.message.trim()
      ? json.message.trim()
      : typeof json?.error === "string" && json.error.trim()
        ? json.error.trim()
        : `HTTP ${status}`;
  if (json?.errors && typeof json.errors === "object") {
    const details = Object.entries(json.errors as Record<string, unknown>)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join(" | ");
    if (details) return `${base} (${details})`;
  }
  return base;
}

/**
 * Verifies FedaPay's `X-FEDAPAY-SIGNATURE` header (`t=<timestamp>,s=<hmac_sha256>`).
 * Uses constant-time comparison and supports multiple `s=` signatures (key rotation).
 */
export function verifyFedaPaySignatureWithSecret(
  rawBody: string,
  headers: Headers,
  secret: string,
): boolean {
  const trimmedSecret = (secret || "").trim();
  if (!trimmedSecret) return true;

  const sigHeader =
    headers.get("x-fedapay-signature") || headers.get("X-FEDAPAY-SIGNATURE") || "";
  if (!sigHeader) return false;

  try {
    let timestamp = "";
    const signatures: string[] = [];
    for (const part of sigHeader.split(",")) {
      const idx = part.indexOf("=");
      if (idx === -1) continue;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k === "t") timestamp = v;
      if (k === "s" && v) signatures.push(v);
    }
    if (!timestamp || signatures.length === 0) return false;

    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedHex = crypto
      .createHmac("sha256", trimmedSecret)
      .update(signedPayload, "utf8")
      .digest("hex");
    const expectedBuf = Buffer.from(expectedHex, "utf8");

    return signatures.some((sig) => {
      const sigBuf = Buffer.from(sig, "utf8");
      if (sigBuf.length !== expectedBuf.length) return false;
      return crypto.timingSafeEqual(sigBuf, expectedBuf);
    });
  } catch {
    return false;
  }
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

    if (hasRealFedaPaySecretKey(cfg.secretKey, cfg.environment)) {
      try {
        const base = fedaApiBaseUrl(cfg.environment);
        const rawName = (opts.customerName || "Client Japora").trim();
        const [firstName, ...rest] = rawName.split(/\s+/);
        const lastName = rest.join(" ") || "Client";

        const safeRefSlug = opts.reference.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toLowerCase() || "order";
        const primaryEmail =
          opts.customerEmail && opts.customerEmail.includes("@")
            ? opts.customerEmail.trim()
            : `client.${safeRefSlug}@japora.com`;
        const fallbackEmail = `order.${safeRefSlug}.${Date.now().toString(36)}@japora.com`;

        // Build callback_url so FedaPay redirects the buyer back to our verification route
        const callbackParams = new URLSearchParams({ ref: opts.reference });
        if (opts.returnUrl) {
          callbackParams.set("returnUrl", opts.returnUrl);
        }
        const callbackUrl = `${getAppBaseUrl(opts.appBaseUrl)}/api/payments/fedapay/callback?${callbackParams.toString()}`;

        const parsedPhone = parseFedaPayPhone(opts.customerPhone);

        const buildPayload = (includePhone: boolean, emailToUse: string) => ({
          description: `Japora #${opts.orderId.slice(-6).toUpperCase()} (${opts.reference})`,
          amount: Math.round(amountXof),
          currency: { iso: "XOF" },
          callback_url: callbackUrl,
          custom_metadata: {
            reference: opts.reference,
            orderId: opts.orderId,
            vendorId: opts.vendorId,
            environment: cfg.environment,
            ...(opts.metadata || {}),
          },
          customer: {
            firstname: firstName || "Client",
            lastname: lastName || "Japora",
            email: emailToUse,
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
          body: JSON.stringify(buildPayload(true, primaryEmail)),
        });

        let createJson = (await createRes.json().catch(() => ({}))) as FedaJson;

        // If FedaPay rejects the customer's phone_number or email (format or existing customer conflict),
        // retry cleanly without phone_number and with a unique fallback email.
        if (!createRes.ok) {
          logger.warn("payments.fedapay.retry_clean_customer", {
            orderId: opts.orderId,
            environment: cfg.environment,
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
            body: JSON.stringify(buildPayload(false, fallbackEmail)),
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
                environment: cfg.environment,
                transaction: txObj,
                token: tokenJson,
                reference: opts.reference,
              },
            };
          }
        }

        const apiErrMsg = formatFedaErrorMessage(createJson, createRes.status);

        logger.error("payments.fedapay.api_create_failed", {
          orderId: opts.orderId,
          environment: cfg.environment,
          status: createRes.status,
          response: createJson,
        });

        // Surface real FedaPay API error whenever a real Sandbox or Live key was configured
        // so misconfigured keys or payload issues are never silently hidden.
        throw new Error(`Erreur FedaPay ${cfg.environment.toUpperCase()} : ${apiErrMsg}`);
      } catch (err) {
        logger.error("payments.fedapay.api_error", {
          orderId: opts.orderId,
          environment: cfg.environment,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    } else if (cfg.environment === "live") {
      throw new Error(
        "Clé API FedaPay Live (sk_live_...) non configurée. Passez en mode Sandbox pour tester ou ajoutez vos clés Live dans le Dashboard → Encaissements.",
      );
    }

    // In Sandbox mode when no sk_sandbox_... API key is configured yet, route to the
    // interactive FedaPay Sandbox Checkout page — in development and demos only.
    // In production the buyer would land on a fake payment page that cannot complete.
    if (!devPaymentSimulatorEnabled()) {
      throw new Error(
        "Le paiement en ligne n'est pas encore configuré pour cette boutique. Choisissez le paiement à la livraison.",
      );
    }
    const sandboxUrl = `/pay/fedapay-sandbox/${encodeURIComponent(opts.reference)}`;
    return {
      checkoutUrl: sandboxUrl,
      providerRef: opts.reference,
      status: "pending",
      raw: {
        mode: "sandbox_local",
        environment: "sandbox",
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
      orderBy: { createdAt: "desc" },
    });

    let storedEnv: "sandbox" | "live" | undefined;
    try {
      const m = intent?.metadata ? JSON.parse(intent.metadata) : {};
      if (m?.environment === "sandbox" || m?.environment === "live") {
        storedEnv = m.environment;
      }
    } catch {
      // ignore
    }

    const cfg = await getVendorFedaPayConfig(intent?.vendorId, storedEnv);

    // If providerRef is a numeric FedaPay transaction ID, query GET /v1/transactions/{id}
    if (hasRealFedaPaySecretKey(cfg.secretKey, cfg.environment) && /^\d+$/.test(providerRef)) {
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
    if (intent?.status === "failed") {
      return { status: "failed", amountCents: intent.amountCents };
    }
    return { status: "pending", amountCents: intent?.amountCents };
  },

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const secrets = [
      process.env.FEDAPAY_WEBHOOK_SECRET,
      process.env.FEDAPAY_SANDBOX_WEBHOOK_SECRET,
      process.env.FEDAPAY_LIVE_WEBHOOK_SECRET,
    ]
      .map((s) => (s || "").trim())
      .filter(Boolean);

    if (secrets.length === 0) {
      // When no global webhook secret is set in env, vendor-level webhookSecret
      // is verified in the webhook route AND provider.verify(id) checks FedaPay's API.
      return true;
    }

    return secrets.some((sec) => verifyFedaPaySignatureWithSecret(rawBody, headers, sec));
  },
};

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
  intent: {
    id: string;
    vendorId: string;
    providerRef: string | null;
    amountCents: number;
    currency: string;
    metadata?: string | null;
  },
  claimedTxId?: string,
): Promise<{ outcome: "succeeded" | "failed" | "pending"; raw?: unknown }> {
  let storedEnv: "sandbox" | "live" | undefined;
  try {
    const m = intent.metadata ? JSON.parse(intent.metadata) : {};
    if (m?.environment === "sandbox" || m?.environment === "live") storedEnv = m.environment;
  } catch {
    // ignore malformed metadata
  }
  const cfg = await getVendorFedaPayConfig(intent.vendorId, storedEnv);
  if (!hasRealFedaPaySecretKey(cfg.secretKey, cfg.environment)) return { outcome: "pending" };
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
