/**
 * Cash on Delivery — STUB. No checkout URL: the vendor confirms the payment
 * out-of-band (cash at handover) and then marks the order PAID in the
 * dashboard. We still mint an intent so the audit trail is uniform.
 */
import { logger } from "../logger";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

function codRef(): string {
  const r = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/-/g, "")
    .slice(0, 12);
  return `cod_${r}`;
}

export const cashProvider: PaymentProvider = {
  name: "cash",
  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const ref = opts.reference ? `cod_${opts.reference.replace(/^japora_/, "")}` : codRef();
    logger.info("payments.cash.initiate", {
      orderId: opts.orderId,
      vendorId: opts.vendorId,
      amountCents: opts.amountCents,
      providerRef: ref,
    });
    return {
      providerRef: ref,
      status: "pending",
      raw: { mode: "cash_on_delivery" },
    };
  },
  async verify(providerRef: string): Promise<VerifyResult> {
    logger.info("payments.cash.stub_verify", { providerRef });
    return { status: "pending" };
  },
  verifyWebhookSignature(): boolean {
    return true;
  },
};
