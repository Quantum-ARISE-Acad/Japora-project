/**
 * Orange Money — STUB. Logs and returns pending so the UI can be exercised
 * end-to-end in Francophone West Africa demos without live credentials.
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

export const orangeProvider: PaymentProvider = {
  name: "orange",
  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const ref = stubRef();
    logger.info("payments.orange.stub_initiate", {
      orderId: opts.orderId,
      vendorId: opts.vendorId,
      amountCents: opts.amountCents,
      providerRef: ref,
    });
    return {
      providerRef: ref,
      status: "pending",
      checkoutUrl: `/dev/pay-stub/orange/${ref}`,
    };
  },
  async verify(providerRef: string): Promise<VerifyResult> {
    logger.info("payments.orange.stub_verify", { providerRef });
    return { status: "pending" };
  },
  verifyWebhookSignature(): boolean {
    return true;
  },
};
