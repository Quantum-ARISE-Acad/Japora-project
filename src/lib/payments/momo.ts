/**
 * MTN Mobile Money (MoMo) — STUB. Real Open API requires per-country
 * subscriptions; we ship a logger-only fallback so the flow is demoable.
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

export const momoProvider: PaymentProvider = {
  name: "momo",
  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const ref = stubRef();
    logger.info("payments.momo.stub_initiate", {
      orderId: opts.orderId,
      vendorId: opts.vendorId,
      amountCents: opts.amountCents,
      providerRef: ref,
    });
    return {
      providerRef: ref,
      status: "pending",
      checkoutUrl: `/dev/pay-stub/momo/${ref}`,
    };
  },
  async verify(providerRef: string): Promise<VerifyResult> {
    logger.info("payments.momo.stub_verify", { providerRef });
    return { status: "pending" };
  },
  verifyWebhookSignature(): boolean {
    return true;
  },
};
