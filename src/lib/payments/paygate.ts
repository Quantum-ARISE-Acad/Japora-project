/**
 * PayGate Global (Togo). REAL fetch implementation.
 *
 * A Togolese aggregator with native T-Money (Togocom) and Flooz (Moov)
 * support — the right rail to *start from Togo*. XOF only.
 *
 * Required env: PAYGATE_AUTH_TOKEN
 *
 * Two flows exist; we use the hosted redirect page (simplest, no USSD push
 * handling needed):
 *   - Redirect:  GET https://paygateglobal.com/v1/page?token=..&amount=..&description=..&identifier=..&url=..&phone=..&network=..
 *   - Status:    POST https://paygateglobal.com/api/v1/status { auth_token, identifier }
 *                 → { status: 0=paid, 2=in progress, 4=expired, 6=cancelled, tx_reference, payment_reference, amount }
 *
 * `network` ∈ "TMONEY" | "FLOOZ" lets us preselect the wallet; omit to let the
 * buyer choose on the page.
 *
 * NOTE: confirm parameter names + status codes against current PayGate docs
 * before going live; this follows their documented v1 API.
 */
import { logger } from "../logger";
import { isZeroDecimal, providerMajorAmount, majorToCents } from "../currency";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

const PAGE = "https://paygateglobal.com/v1/page";
const STATUS = "https://paygateglobal.com/api/v1/status";

export function paygateConfigured(): boolean {
  return Boolean(process.env.PAYGATE_AUTH_TOKEN);
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5174").replace(/\/$/, "");
}

/** Map our generic network/wallet hint onto PayGate's codes. */
function paygateNetwork(hint?: string): string | undefined {
  const h = (hint || "").toLowerCase();
  if (h.includes("flooz") || h.includes("moov")) return "FLOOZ";
  if (h.includes("tmoney") || h.includes("t-money") || h.includes("togocom")) return "TMONEY";
  return undefined;
}

type StatusResp = {
  status?: number; // 0 paid · 2 in progress · 4 expired · 6 cancelled
  tx_reference?: string;
  payment_reference?: string;
  amount?: number; // XOF whole units
};

export const paygateProvider: PaymentProvider = {
  name: "paygate",

  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    if (!paygateConfigured()) {
      logger.warn("payments.paygate.unconfigured", { orderId: opts.orderId });
      return {
        providerRef: opts.reference,
        status: "pending",
        checkoutUrl: `/dev/pay-stub/paygate/${opts.reference}`,
      };
    }

    // PayGate is XOF-only; amounts are whole francs.
    const amount = providerMajorAmount(opts.amountCents, {
      multipleOf: isZeroDecimal(opts.currency) ? 1 : 1,
    });
    const params = new URLSearchParams({
      token: process.env.PAYGATE_AUTH_TOKEN as string,
      amount: String(amount),
      description: `Japora order ${opts.orderId.slice(-6).toUpperCase()}`,
      identifier: opts.reference,
      url: opts.returnUrl || `${appUrl()}/`,
    });
    if (opts.customerPhone) params.set("phone", opts.customerPhone);
    const network = paygateNetwork(opts.network);
    if (network) params.set("network", network);

    // The hosted page is a GET redirect; we just hand the buyer the URL.
    return {
      checkoutUrl: `${PAGE}?${params.toString()}`,
      providerRef: opts.reference,
      status: "pending",
    };
  },

  async verify(providerRef: string): Promise<VerifyResult> {
    if (!paygateConfigured()) return { status: "pending" };
    const res = await fetch(STATUS, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_token: process.env.PAYGATE_AUTH_TOKEN,
        identifier: providerRef,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as StatusResp;
    const code = json.status;
    const mapped: VerifyResult["status"] =
      code === 0 ? "succeeded" : code === 4 || code === 6 ? "failed" : "pending";
    return {
      status: mapped,
      amountCents: typeof json.amount === "number" ? majorToCents(json.amount) : undefined,
      raw: json,
    };
  },

  /**
   * PayGate posts a simple callback (identifier + tx_reference). There is no
   * documented HMAC; the secure gate is the /status call the webhook handler
   * runs before settling. Accept and defer to verify().
   */
  verifyWebhookSignature(): boolean {
    return true;
  },
};
