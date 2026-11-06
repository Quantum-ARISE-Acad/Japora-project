/**
 * Wave (Senegal / CI / Mali). STUB. Real API uses bearer tokens + signed
 * webhooks; we ship logger-only fallback.
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

export const waveProvider: PaymentProvider = {
  name: "wave",
  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const ref = stubRef();
    logger.info("payments.wave.stub_initiate", {
      orderId: opts.orderId,
      vendorId: opts.vendorId,
      amountCents: opts.amountCents,
      providerRef: ref,
    });
    return {
      providerRef: ref,
      status: "pending",
      checkoutUrl: `/dev/pay-stub/wave/${ref}`,
    };
  },
  async verify(providerRef: string): Promise<VerifyResult> {
    logger.info("payments.wave.stub_verify", { providerRef });
    return { status: "pending" };
  },
  verifyWebhookSignature(): boolean {
    return true;
  },
};
