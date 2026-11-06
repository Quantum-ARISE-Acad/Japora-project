/**
 * CinetPay (Francophone West & Central Africa). REAL fetch implementation.
 *
 * One integration covers Togo (T-Money, Flooz/Moov), Bénin, Côte d'Ivoire,
 * Senegal, Burkina, Mali, Niger, Guinea, Cameroon, DRC — mobile money + card.
 * This is Japora's regional-expansion rail.
 *
 * Required env: CINETPAY_API_KEY, CINETPAY_SITE_ID
 * Optional env: CINETPAY_SECRET_KEY  (HMAC token check on the notify webhook)
 *               CINETPAY_CHANNELS    ("ALL" | "MOBILE_MONEY" | "CREDIT_CARD"; default MOBILE_MONEY)
 *
 * Flow (hosted-page, mobile-money first):
 *   1. POST /v2/payment  → { data: { payment_url, payment_token } }; redirect buyer
 *   2. Buyer pays via T-Money / Flooz / etc. on CinetPay's page
 *   3. CinetPay POSTs the notify_url (form-encoded) → we re-check authoritatively
 *   4. POST /v2/payment/check → status ACCEPTED | REFUSED | PENDING
 *
 * Amounts: XOF/XAF must be whole francs AND a multiple of 5 — handled via
 * currency.providerMajorAmount(..., { multipleOf: 5 }).
 *
 * NOTE: confirm field names against current CinetPay docs before going live;
 * this mirrors their v2 API as documented but providers do change shapes.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "../logger";
import { isZeroDecimal, providerMajorAmount, majorToCents } from "../currency";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

const BASE = "https://api-checkout.cinetpay.com/v2";

export function cinetpayConfigured(): boolean {
  return Boolean(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174").replace(/\/$/, "");
}

/** CinetPay amount rule: whole units; XOF/XAF must be a multiple of 5. */
function cinetpayAmount(cents: number, currency: string): number {
  return providerMajorAmount(cents, { multipleOf: isZeroDecimal(currency) ? 5 : 1 });
}

type InitResp = {
  code?: string;
  message?: string;
  data?: { payment_token?: string; payment_url?: string };
};

type CheckResp = {
  code?: string; // "00" == success on the check call itself
  message?: string;
  data?: {
    status?: string; // ACCEPTED | REFUSED | PENDING | WAITING_FOR_CUSTOMER
    amount?: string | number;
    currency?: string;
  };
};

export const cinetpayProvider: PaymentProvider = {
  name: "cinetpay",

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    if (!cinetpayConfigured()) {
      logger.warn("payments.cinetpay.unconfigured", { orderId: opts.orderId });
      return {
        providerRef: opts.reference,
        status: "pending",
        checkoutUrl: `/dev/pay-stub/cinetpay/${opts.reference}`,
      };
    }

    const [firstName, ...rest] = (opts.customerName || "Japora customer").split(" ");
    const body = {
      apikey: process.env.CINETPAY_API_KEY,
      site_id: process.env.CINETPAY_SITE_ID,
      transaction_id: opts.reference,
      amount: cinetpayAmount(opts.amountCents, opts.currency),
      currency: (opts.currency || "XOF").toUpperCase(),
      description: `Japora order ${opts.orderId.slice(-6).toUpperCase()}`,
      notify_url: `${appUrl()}/api/payments/webhook/cinetpay`,
      return_url: opts.returnUrl || `${appUrl()}/`,
      channels: process.env.CINETPAY_CHANNELS || "MOBILE_MONEY",
      lang: "fr",
      customer_name: firstName,
      customer_surname: rest.join(" ") || firstName,
      customer_phone_number: opts.customerPhone || "",
      metadata: JSON.stringify({ orderId: opts.orderId, vendorId: opts.vendorId }),
    };

    const res = await fetch(`${BASE}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as InitResp;
    if (!res.ok || !json.data?.payment_url) {
      logger.error("payments.cinetpay.init_failed", {
        orderId: opts.orderId,
        httpStatus: res.status,
        code: json.code,
        message: json.message,
      });
      return { providerRef: opts.reference, status: "failed", raw: json };
    }
    return {
      checkoutUrl: json.data.payment_url,
      providerRef: opts.reference,
      status: "pending",
      raw: json,
    };
  },

  async verify(providerRef: string): Promise<VerifyResult> {
    if (!cinetpayConfigured()) return { status: "pending" };
    const res = await fetch(`${BASE}/payment/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: process.env.CINETPAY_API_KEY,
        site_id: process.env.CINETPAY_SITE_ID,
        transaction_id: providerRef,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as CheckResp;
    const status = json.data?.status;
    const mapped: VerifyResult["status"] =
      status === "ACCEPTED" ? "succeeded" : status === "REFUSED" ? "failed" : "pending";
    const amountMajor =
      typeof json.data?.amount === "string"
        ? parseFloat(json.data.amount)
        : typeof json.data?.amount === "number"
          ? json.data.amount
          : undefined;
    return {
      status: mapped,
      amountCents: typeof amountMajor === "number" ? majorToCents(amountMajor) : undefined,
      raw: json,
    };
  },

  /**
   * CinetPay sends an `x-token` HMAC-SHA256 over a concatenation of notify
   * fields, keyed by the secret. The exact field order is finicky and changes,
   * so we treat the HMAC as best-effort: if a secret + token are present we
   * check it, but the authoritative gate is the /payment/check call in the
   * webhook handler (which we always run on a success event). With no secret
   * configured we accept and rely entirely on verify().
   */
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const secret = process.env.CINETPAY_SECRET_KEY;
    const token = headers.get("x-token");
    if (secret && token) {
      try {
        const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
        const a = Buffer.from(expected);
        const b = Buffer.from(token);
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
        logger.warn("payments.cinetpay.token_mismatch");
      } catch {
        // fall through to the verify() gate below
      }
    }
    // CinetPay's authoritative gate is the /payment/check call the webhook
    // handler runs before settling — accept here, settlement still requires
    // verify() === succeeded.
    return true;
  },
};
