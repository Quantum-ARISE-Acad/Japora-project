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

function stubRef(): string {
  const r = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/-/g, "")
    .slice(0, 16);
  return `stub_${r}`;
}

export const cashProvider: PaymentProvider = {
  name: "cash",
  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const ref = stubRef();
    logger.info("payments.cash.stub_initiate", {
      orderId: opts.orderId,
      vendorId: opts.vendorId,
      amountCents: opts.amountCents,
      providerRef: ref,
    });
    return {
      providerRef: ref,
      status: "pending",
      // No checkoutUrl on purpose — caller renders "pay on delivery" copy.
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
