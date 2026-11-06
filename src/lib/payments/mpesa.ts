/**
 * M-Pesa (Safaricom Daraja). REAL fetch implementation — STK Push.
 *
 * Required env:
 *   MPESA_CONSUMER_KEY, MPESA_CONSUMER_SECRET
 *   MPESA_SHORTCODE, MPESA_PASSKEY, MPESA_CALLBACK_URL
 * Optional env:
 *   MPESA_ENV = "sandbox" | "production"  (default "sandbox")
 *
 * Daraja does not publish a formal HMAC scheme for the STK callback — the
 * documented hardening is whitelisting Safaricom's source IPs and verifying
 * the embedded CheckoutRequestID. We therefore pass-through here and recommend
 * production callers layer their own validation (e.g. a shared bearer in the
 * callback URL path).
 *
 * Docs: https://developer.safaricom.co.ke/Documentation
 */
import { logger } from "../logger";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

const ENVS = {
  sandbox: "https://sandbox.safaricom.co.ke",
  production: "https://api.safaricom.co.ke",
};

export function mpesaConfigured(): boolean {
  return Boolean(
    process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET &&
      process.env.MPESA_SHORTCODE &&
      process.env.MPESA_PASSKEY &&
      process.env.MPESA_CALLBACK_URL,
  );
}

function baseUrl(): string {
  const env = (process.env.MPESA_ENV || "sandbox").toLowerCase();
  return env === "production" ? ENVS.production : ENVS.sandbox;
}

function timestamp(): string {
  // YYYYMMDDHHmmss in UTC — Daraja accepts UTC and most callers use it.
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    p(d.getUTCHours()) +
    p(d.getUTCMinutes()) +
    p(d.getUTCSeconds())
  );
}

async function getToken(): Promise<string> {
  const key = process.env.MPESA_CONSUMER_KEY!;
  const secret = process.env.MPESA_CONSUMER_SECRET!;
  const basic = Buffer.from(`${key}:${secret}`).toString("base64");
  const res = await fetch(
    `${baseUrl()}/oauth/v1/generate?grant_type=client_credentials`,
    { method: "GET", headers: { Authorization: `Basic ${basic}` } },
  );
  if (!res.ok) {
    throw new Error(`M-Pesa token error ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("M-Pesa token missing access_token");
  return json.access_token;
}

function normalisePhone(phone?: string): string {
  if (!phone) return "";
  const digits = phone.replace(/\D+/g, "");
  // 07XX... -> 2547XX..., 7XX... -> 2547XX...
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.length === 9) return `254${digits}`;
  return digits;
}

type StkResp = {
  MerchantRequestID?: string;
  CheckoutRequestID?: string;
  ResponseCode?: string;
  ResponseDescription?: string;
  CustomerMessage?: string;
  errorCode?: string;
  errorMessage?: string;
};

type QueryResp = {
  ResponseCode?: string;
  ResultCode?: string; // "0" = success
  ResultDesc?: string;
  errorCode?: string;
};

export const mpesaProvider: PaymentProvider = {
  name: "mpesa",

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    if (!mpesaConfigured()) {
      logger.warn("payments.mpesa.unconfigured", { orderId: opts.orderId });
      return {
        providerRef: opts.reference,
        status: "pending",
        checkoutUrl: `/dev/pay-stub/mpesa/${opts.reference}`,
      };
    }
    const shortcode = process.env.MPESA_SHORTCODE!;
    const passkey = process.env.MPESA_PASSKEY!;
    const callbackUrl = process.env.MPESA_CALLBACK_URL!;
    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");
    const phone = normalisePhone(opts.customerPhone);
    if (!phone) {
      return { providerRef: opts.reference, status: "failed", raw: { error: "customerPhone required" } };
    }

    let token: string;
    try {
      token = await getToken();
    } catch (e) {
      logger.error("payments.mpesa.token_failed", { error: String(e) });
      return { providerRef: opts.reference, status: "failed", raw: { error: String(e) } };
    }

    const body = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: ts,
      TransactionType: "CustomerPayBillOnline",
      Amount: Math.ceil(opts.amountCents / 100),
      PartyA: phone,
      PartyB: shortcode,
      PhoneNumber: phone,
      CallBackURL: callbackUrl,
      AccountReference: opts.reference.slice(0, 12),
      TransactionDesc: `Japora order ${opts.orderId}`.slice(0, 13),
    };

    const res = await fetch(`${baseUrl()}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as StkResp;
    if (!res.ok || json.ResponseCode !== "0" || !json.CheckoutRequestID) {
      logger.error("payments.mpesa.stk_failed", {
        orderId: opts.orderId,
        status: res.status,
        message: json.errorMessage ?? json.ResponseDescription,
      });
      return { providerRef: opts.reference, status: "failed", raw: json };
    }
    return {
      // STK Push is a phone prompt, not a redirect — no checkoutUrl.
      providerRef: json.CheckoutRequestID,
      status: "pending",
      raw: json,
    };
  },

  async verify(providerRef: string): Promise<VerifyResult> {
    if (!mpesaConfigured()) return { status: "pending" };
    const shortcode = process.env.MPESA_SHORTCODE!;
    const passkey = process.env.MPESA_PASSKEY!;
    const ts = timestamp();
    const password = Buffer.from(`${shortcode}${passkey}${ts}`).toString("base64");

    let token: string;
    try {
      token = await getToken();
    } catch (e) {
      return { status: "pending", raw: { error: String(e) } };
    }
    const res = await fetch(`${baseUrl()}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: ts,
        CheckoutRequestID: providerRef,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as QueryResp;
    if (!res.ok) return { status: "pending", raw: json };
    const code = json.ResultCode;
    const mapped: VerifyResult["status"] =
      code === "0" ? "succeeded" : code === "1032" || code === "1037" || (code && code !== "1") ? "failed" : "pending";
    return { status: mapped, raw: json };
  },

  /**
   * Daraja STK callback does not include a formal HMAC. Production setups
   * should restrict the callback URL by IP and/or embed a shared secret in
   * the URL path. We accept the payload here and rely on app-level checks
   * (matching CheckoutRequestID to an open PaymentIntent).
   */
  verifyWebhookSignature(_rawBody: string, _headers: Headers): boolean {
    return true;
  },
};
