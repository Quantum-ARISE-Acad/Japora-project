/**
 * Chipper Cash — STUB. Real Chipper Business is invite-only; this keeps the
 * checkout dropdown populated for cross-border demos.
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

export const chipperProvider: PaymentProvider = {
  name: "chipper",
  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const ref = stubRef();
    logger.info("payments.chipper.stub_initiate", {
      orderId: opts.orderId,
      vendorId: opts.vendorId,
      amountCents: opts.amountCents,
      providerRef: ref,
    });
    return {
      providerRef: ref,
      status: "pending",
      checkoutUrl: `/dev/pay-stub/chipper/${ref}`,
    };
  },
  async verify(providerRef: string): Promise<VerifyResult> {
    logger.info("payments.chipper.stub_verify", { providerRef });
    return { status: "pending" };
  },
  verifyWebhookSignature(): boolean {
    return true;
  },
};
