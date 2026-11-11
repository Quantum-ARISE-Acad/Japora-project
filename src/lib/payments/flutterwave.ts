/**
 * Flutterwave (pan-African). REAL fetch implementation.
 *
 * Required env: FLUTTERWAVE_SECRET_KEY
 * Optional env: FLUTTERWAVE_WEBHOOK_HASH (string the dashboard lets you set;
 *   FW sends it back verbatim in `verif-hash` — a "secret-equality" scheme,
 *   not HMAC. We do a timing-safe equality check.)
 *
 * Docs:
 *   - Init:    POST https://api.flutterwave.com/v3/payments
 *   - Verify:  GET  /v3/transactions/verify_by_reference?tx_ref=
 *   - Webhook: header `verif-hash` === FLUTTERWAVE_WEBHOOK_HASH
 */
import { timingSafeEqual } from "node:crypto";
import { logger } from "../logger";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

const BASE = "https://api.flutterwave.com";

export function flutterwaveConfigured(): boolean {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY);
}

function secret(): string {
  const k = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!k) throw new Error("FLUTTERWAVE_SECRET_KEY missing");
  return k;
}

type InitResp = {
  status?: string;
  message?: string;
  data?: { link?: string };
};

type VerifyResp = {
  status?: string;
  data?: {
    status?: string; // successful | failed | pending
    tx_ref?: string;
    amount?: number; // major unit (e.g. NGN)
    currency?: string;
  };
};

export const flutterwaveProvider: PaymentProvider = {
  name: "flutterwave",

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    if (!flutterwaveConfigured()) {
      logger.warn("payments.flutterwave.unconfigured", { orderId: opts.orderId });
      return {
        providerRef: opts.reference,
        status: "pending",
        checkoutUrl: `/dev/pay-stub/flutterwave/${opts.reference}`,
      };
    }
    const amountMajor = Math.ceil(opts.amountCents / 100);
    const body = {
      tx_ref: opts.reference,
      amount: amountMajor,
      currency: opts.currency || "NGN",
      redirect_url: opts.returnUrl,
      customer: {
        email: opts.customerEmail || "customer@japora.local",
        name: opts.customerName || "Japora customer",
        phonenumber: opts.customerPhone,
      },
      meta: {
        vendorId: opts.vendorId,
        orderId: opts.orderId,
        ...(opts.metadata ?? {}),
      },
    };
    const res = await fetch(`${BASE}/v3/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as InitResp;
    if (!res.ok || json.status !== "success" || !json.data?.link) {
      logger.error("payments.flutterwave.init_failed", {
        orderId: opts.orderId,
        status: res.status,
        message: json.message,
      });
      return { providerRef: opts.reference, status: "failed", raw: json };
    }
    return {
      checkoutUrl: json.data.link,
      providerRef: opts.reference,
      status: "pending",
      raw: json,
    };
  },

  async verify(providerRef: string): Promise<VerifyResult> {
    if (!flutterwaveConfigured()) return { status: "pending" };
    const url = `${BASE}/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(providerRef)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${secret()}` },
    });
    const json = (await res.json().catch(() => ({}))) as VerifyResp;
    if (!res.ok || !json.data) return { status: "pending", raw: json };
    const s = json.data.status;
    const mapped: VerifyResult["status"] =
      s === "successful" ? "succeeded" : s === "failed" ? "failed" : "pending";
    const amountCents = typeof json.data.amount === "number"
      ? Math.round(json.data.amount * 100)
      : undefined;
    return { status: mapped, amountCents, raw: json };
  },

  verifyWebhookSignature(_rawBody: string, headers: Headers): boolean {
    const sig = headers.get("verif-hash");
    const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;
    if (!sig || !expected) return false;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },
};
