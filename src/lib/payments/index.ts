/**
 * Japora payment provider abstraction. Each rail implements a uniform
 * PaymentProvider so callers (checkout API, webhook) stay rail-agnostic.
 *
 * Market priority: West African mobile money first, starting from Togo.
 *   - cinetpay : Francophone W&C Africa (Togo T-Money/Flooz, Bénin, CI, …) — regional expansion
 *   - paygate  : Togo-native (T-Money + Flooz) — the Togo-first rail
 *   - flutterwave : pan-African incl. XOF — fallback/breadth
 *   - paystack / mpesa : Anglophone East/West — kept, lower priority
 *   - momo/orange/wave/chipper/cash : stubs for demoability
 *
 * Selection rule: getPaymentProvider(name) returns the real implementation iff
 * the rail's credentials are present — otherwise the impl itself falls back to
 * the /dev/pay-stub flow (see each provider), so every rail is demoable.
 */
import { paystackProvider, paystackConfigured } from "./paystack";
import { flutterwaveProvider, flutterwaveConfigured } from "./flutterwave";
import { mpesaProvider, mpesaConfigured } from "./mpesa";
import { cinetpayProvider, cinetpayConfigured } from "./cinetpay";
import { paygateProvider, paygateConfigured } from "./paygate";
import { fedapayProvider, fedapayConfigured } from "./fedapay";
import { momoProvider } from "./momo";
import { orangeProvider } from "./orange";
import { waveProvider } from "./wave";
import { chipperProvider } from "./chipper";
import { cashProvider } from "./cash";
import { ussdProvider } from "./ussd";

export type PaymentProviderName =
  | "fedapay"
  | "ussd"
  | "cinetpay"
  | "paygate"
  | "paystack"
  | "flutterwave"
  | "mpesa"
  | "momo"
  | "orange"
  | "wave"
  | "chipper"
  | "cash";

export type PaymentStatus = "pending" | "succeeded" | "failed";

export type InitiateOptions = {
  orderId: string;
  vendorId: string;
  amountCents: number;
  currency: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  returnUrl?: string;
  appBaseUrl?: string;
  reference: string; // unique provider reference we generate (e.g. "japora_xxx")
  /** Optional wallet hint, e.g. "T-Money" / "Flooz" / "Orange Money". */
  network?: string;
  metadata?: Record<string, unknown>;
};

export type InitiateResult = {
  checkoutUrl?: string;
  providerRef: string;
  status: PaymentStatus;
  raw?: unknown;
};

export type VerifyResult = {
  status: PaymentStatus;
  amountCents?: number;
  raw?: unknown;
};

export interface PaymentProvider {
  name: PaymentProviderName;
  initiate(opts: InitiateOptions): Promise<InitiateResult>;
  verify(providerRef: string): Promise<VerifyResult>;
  /**
   * Validate the inbound webhook payload's signature/HMAC against the raw
   * request body. Stubs return true; real rails use their own scheme.
   */
  verifyWebhookSignature(rawBody: string, headers: Headers): boolean;
}

const ALL: Record<PaymentProviderName, PaymentProvider> = {
  fedapay: fedapayProvider,
  ussd: ussdProvider,
  cinetpay: cinetpayProvider,
  paygate: paygateProvider,
  paystack: paystackProvider,
  flutterwave: flutterwaveProvider,
  mpesa: mpesaProvider,
  momo: momoProvider,
  orange: orangeProvider,
  wave: waveProvider,
  chipper: chipperProvider,
  cash: cashProvider,
};

const VALID = new Set<string>(Object.keys(ALL));

/** Human label + the wallets/methods each rail surfaces (for checkout UI). */
export const PROVIDER_META: Record<
  PaymentProviderName,
  { label: string; wallets: string[] }
> = {
  fedapay: { label: "FedaPay (T-Money, Flooz, Mobile Money & Carte)", wallets: ["T-Money", "Flooz Moov", "MTN MoMo", "Celtiis", "Visa / Mastercard"] },
  ussd: { label: "Mobile Money — dial code", wallets: ["T-Money", "Flooz", "Orange Money", "MTN MoMo"] },
  cinetpay: { label: "Mobile Money (CinetPay)", wallets: ["T-Money", "Flooz", "Orange Money", "MTN MoMo", "Moov", "Wave", "Card"] },
  paygate: { label: "T-Money / Flooz (PayGate)", wallets: ["T-Money", "Flooz"] },
  paystack: { label: "Card / Bank (Paystack)", wallets: ["Card", "Bank transfer", "USSD"] },
  flutterwave: { label: "Flutterwave", wallets: ["Mobile Money", "Card", "Bank transfer"] },
  mpesa: { label: "M-Pesa", wallets: ["M-Pesa"] },
  momo: { label: "MTN MoMo", wallets: ["MTN MoMo"] },
  orange: { label: "Orange Money", wallets: ["Orange Money"] },
  wave: { label: "Wave", wallets: ["Wave"] },
  chipper: { label: "Chipper Cash", wallets: ["Chipper"] },
  cash: { label: "Cash on delivery", wallets: ["Cash"] },
};

/**
 * Which currencies each rail can settle. "*" = any (cash). Used to offer
 * buyers only the rails that fit their shop's currency.
 */
const PROVIDER_CURRENCIES: Record<PaymentProviderName, string[]> = {
  fedapay: ["*"],
  ussd: ["XOF", "XAF", "GNF", "GHS", "UGX", "RWF"],
  cinetpay: ["XOF", "XAF", "GNF", "CDF", "USD"],
  paygate: ["XOF"],
  flutterwave: ["XOF", "XAF", "NGN", "GHS", "KES", "UGX", "TZS", "ZAR", "RWF", "USD"],
  paystack: ["NGN", "GHS", "ZAR", "KES", "USD"],
  mpesa: ["KES", "TZS"],
  momo: ["XOF", "GHS", "UGX"],
  orange: ["XOF", "XAF"],
  wave: ["XOF"],
  chipper: ["NGN", "GHS", "KES", "UGX", "USD"],
  cash: ["*"],
};

export function getPaymentProvider(name: PaymentProviderName): PaymentProvider {
  return ALL[name];
}

export function isProviderConfigured(name: PaymentProviderName): boolean {
  switch (name) {
    case "fedapay": return fedapayConfigured();
    case "cinetpay": return cinetpayConfigured();
    case "paygate": return paygateConfigured();
    case "paystack": return paystackConfigured();
    case "flutterwave": return flutterwaveConfigured();
    case "mpesa": return mpesaConfigured();
    default: return false; // stubs
  }
}

/**
 * Ordered list of rails to offer for a shop's currency. West-African mobile
 * money leads (Togo-first); cash always closes the list. Configured (live)
 * rails sort ahead of unconfigured (stub) ones.
 */
export function providersForCurrency(currency: string): PaymentProviderName[] {
  const cur = (currency || "").toUpperCase();
  const PRIORITY: PaymentProviderName[] = [
    "fedapay", "ussd", "paygate", "cinetpay", "flutterwave", "orange", "wave", "momo",
    "paystack", "mpesa", "chipper", "cash",
  ];
  const fits = (p: PaymentProviderName) =>
    PROVIDER_CURRENCIES[p].includes("*") || PROVIDER_CURRENCIES[p].includes(cur);
  return PRIORITY.filter(fits).sort((a, b) => {
    if (a === "ussd") return -1;
    if (b === "ussd") return 1;
    if (a === "cash") return 1;
    if (b === "cash") return -1;
    return Number(isProviderConfigured(b)) - Number(isProviderConfigured(a));
  });
}

/**
 * The first hosted-API rail that's actually configured for this currency, or
 * null. This is the "pay automatically" fallback we offer alongside USSD — only
 * surfaced where a provider's credentials are present.
 */
export function apiFallbackForCurrency(currency: string): PaymentProviderName | null {
  const cur = (currency || "").toUpperCase();
  const fits = (p: PaymentProviderName) =>
    PROVIDER_CURRENCIES[p].includes("*") || PROVIDER_CURRENCIES[p].includes(cur);
  const apiRails: PaymentProviderName[] = ["fedapay", "paygate", "cinetpay", "flutterwave", "paystack", "mpesa"];
  return apiRails.find((p) => fits(p) && isProviderConfigured(p)) ?? null;
}

/** Providers whose required envs are currently configured (real, not stub). */
export function listConfiguredProviders(): PaymentProviderName[] {
  const real: PaymentProviderName[] = ["fedapay", "cinetpay", "paygate", "paystack", "flutterwave", "mpesa"];
  const out: PaymentProviderName[] = ["ussd", ...real.filter(isProviderConfigured)];
  out.push("momo", "orange", "wave", "chipper", "cash");
  return out;
}

export function isValidProviderName(name: string): name is PaymentProviderName {
  return VALID.has(name);
}

/** Generate a Japora reference. Provider-agnostic; safe across rails. */
export function newReference(): string {
  const id = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/-/g, "")
    .slice(0, 16);
  return `japora_${id}`;
}
