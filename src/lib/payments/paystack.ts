/**
 * Paystack (Nigeria flagship). REAL fetch implementation.
 *
 * Required env: PAYSTACK_SECRET_KEY
 *
 * Docs:
 *   - Initialize: https://paystack.com/docs/api/transaction/#initialize
 *   - Verify:     https://paystack.com/docs/api/transaction/#verify
 *   - Webhook:    x-paystack-signature = HMAC-SHA512(rawBody, secret_key)
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { logger } from "../logger";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

const BASE = "https://api.paystack.co";

export function paystackConfigured(): boolean {
  return Boolean(process.env.PAYSTACK_SECRET_KEY);
}

function secret(): string {
  const k = process.env.PAYSTACK_SECRET_KEY;
  if (!k) throw new Error("PAYSTACK_SECRET_KEY missing");
  return k;
}

type InitResp = {
  status: boolean;
  message?: string;
  data?: { authorization_url?: string; reference?: string; access_code?: string };
};

type VerifyResp = {
  status: boolean;
  data?: {
    status?: string; // success | failed | abandoned | pending
    reference?: string;
    amount?: number; // in subunit (kobo for NGN)
    currency?: string;
  };
};

export const paystackProvider: PaymentProvider = {
  name: "paystack",

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    if (!paystackConfigured()) {
      // Fallback: stub-like behaviour so the route still functions in dev.
      logger.warn("payments.paystack.unconfigured", { orderId: opts.orderId });
      return {
        providerRef: opts.reference,
        status: "pending",
        checkoutUrl: `/dev/pay-stub/paystack/${opts.reference}`,
      };
    }
    const body = {
      // Paystack expects amount in the smallest unit. Our amountCents already
      // is in kobo for NGN — pass through.
      amount: opts.amountCents,
      email: opts.customerEmail || "customer@japora.local",
      currency: opts.currency || "NGN",
      reference: opts.reference,
      callback_url: opts.returnUrl,
      metadata: {
        vendorId: opts.vendorId,
        orderId: opts.orderId,
        ...(opts.metadata ?? {}),
      },
    };
    const res = await fetch(`${BASE}/transaction/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const json = (await res.json().catch(() => ({}))) as InitResp;
    if (!res.ok || !json.status || !json.data?.authorization_url) {
      logger.error("payments.paystack.init_failed", {
        orderId: opts.orderId,
        status: res.status,
        message: json.message,
      });
      return { providerRef: opts.reference, status: "failed", raw: json };
    }
    return {
      checkoutUrl: json.data.authorization_url,
      providerRef: json.data.reference ?? opts.reference,
      status: "pending",
      raw: json,
    };
  },

  async verify(providerRef: string): Promise<VerifyResult> {
    if (!paystackConfigured()) return { status: "pending" };
    const res = await fetch(
      `${BASE}/transaction/verify/${encodeURIComponent(providerRef)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${secret()}` },
      },
    );
    const json = (await res.json().catch(() => ({}))) as VerifyResp;
    if (!res.ok || !json.status || !json.data) {
      return { status: "pending", raw: json };
    }
    const s = json.data.status;
    const mapped: VerifyResult["status"] =
      s === "success" ? "succeeded" : s === "failed" || s === "abandoned" ? "failed" : "pending";
    return { status: mapped, amountCents: json.data.amount, raw: json };
  },

  verifyWebhookSignature(rawBody: string, headers: Headers): boolean {
    const sig = headers.get("x-paystack-signature");
    if (!sig) return false;
    if (!paystackConfigured()) return false;
    try {
      const computed = createHmac("sha512", secret()).update(rawBody).digest("hex");
      const a = Buffer.from(computed, "hex");
      const b = Buffer.from(sig, "hex");
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  },
};
