/**
 * USSD mobile-money — the Togo-first DEFAULT rail.
 *
 * In Togo (and most of francophone West Africa) the fastest, most universal way
 * to pay is the one every feature phone already has: the customer dials a short
 * code (T-Money `*145#`, Flooz `*155#`, …), chooses "send money", types the
 * vendor's mobile-money number, the amount, and confirms with their PIN. No
 * smartphone, no data, no card, no provider account — it works on any SIM.
 *
 * So USSD is the *quick/default* method we lead with. The hosted provider API
 * (CinetPay / PayGate push) is the smoother *fallback* we offer only where the
 * vendor has a rail configured (see `isProviderConfigured`).
 *
 * This rail is vendor-direct: money lands in the vendor's wallet, so there's no
 * checkout URL to redirect to and no webhook. Like cash-on-delivery, the vendor
 * confirms receipt and marks the order PAID. We still mint a PaymentIntent so
 * the audit trail stays uniform across rails.
 *
 * Dial codes below are the common operator codes; the exact menu wording varies
 * by operator and country, so the steps are written generically.
 */
import { logger } from "../logger";
import { majorUnits } from "../currency";
import { formatMoney } from "../utils";
import type {
  InitiateOptions,
  InitiateResult,
  PaymentProvider,
  VerifyResult,
} from "./index";

export type UssdNetworkId = "tmoney" | "flooz" | "orange" | "mtn";

export type UssdNetwork = {
  id: UssdNetworkId;
  /** Wallet name the customer recognises. */
  label: string;
  /** The mobile operator behind the wallet. */
  operator: string;
  /** The USSD entry code, e.g. "*145#". */
  dial: string;
  /** Currencies this wallet settles — used to offer only the relevant ones. */
  currencies: string[];
  /** UI badge color classes */
  badgeBg?: string;
  badgeText?: string;
  brandColor?: string;
  icon?: string;
};

/**
 * Wallet catalog. Togo's two wallets (T-Money, Flooz) lead; Orange Money and
 * MTN MoMo cover the rest of the XOF/regional mobile-money belt. Order here is
 * the display order.
 */
export const USSD_NETWORKS: UssdNetwork[] = [
  {
    id: "tmoney",
    label: "T-Money",
    operator: "Togocom",
    dial: "*145#",
    currencies: ["XOF"],
    badgeBg: "bg-amber-100 dark:bg-amber-900/30",
    badgeText: "text-amber-800 dark:text-amber-300",
    brandColor: "#F59E0B",
    icon: "🟡",
  },
  {
    id: "flooz",
    label: "Flooz",
    operator: "Moov Africa",
    dial: "*155#",
    currencies: ["XOF"],
    badgeBg: "bg-blue-100 dark:bg-blue-900/30",
    badgeText: "text-blue-800 dark:text-blue-300",
    brandColor: "#2563EB",
    icon: "🔵",
  },
  {
    id: "orange",
    label: "Orange Money",
    operator: "Orange",
    dial: "#144#",
    currencies: ["XOF", "XAF", "GNF"],
    badgeBg: "bg-orange-100 dark:bg-orange-900/30",
    badgeText: "text-orange-800 dark:text-orange-300",
    brandColor: "#EA580C",
    icon: "🟠",
  },
  {
    id: "mtn",
    label: "MTN MoMo",
    operator: "MTN",
    dial: "*165#",
    currencies: ["XOF", "XAF", "GHS", "UGX", "RWF"],
    badgeBg: "bg-yellow-100 dark:bg-yellow-900/30",
    badgeText: "text-yellow-800 dark:text-yellow-300",
    brandColor: "#CA8A04",
    icon: "🟡",
  },
];

/** Clean phone number for local Togo USSD dialing */
export function cleanTogoLocalNumber(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  // If 228XXXXXXXX (11 digits), strip 228 prefix
  if (digits.startsWith("228") && digits.length === 11) {
    return digits.slice(3);
  }
  return digits;
}

/** Direct USSD code format for Togo operators when amount and phone are known */
export function directUssdCode(
  networkId: UssdNetworkId,
  payeeNumber: string,
  amountMajor: number,
): string | null {
  const localNumber = cleanTogoLocalNumber(payeeNumber);
  if (!localNumber || amountMajor <= 0) return null;

  switch (networkId) {
    case "tmoney":
      // Togocom: *145*1*<montant>*<numéro>*1#
      return `*145*1*${amountMajor}*${localNumber}*1#`;
    case "flooz":
      // Moov Africa: *155*1*1*<numéro>*<montant>*1#
      return `*155*1*1*${localNumber}*${amountMajor}*1#`;
    default:
      return null;
  }
}

/** Does USSD mobile money make sense for this shop's currency? */
export function ussdSupportsCurrency(currency: string): boolean {
  const cur = (currency || "").toUpperCase();
  return USSD_NETWORKS.some((n) => n.currencies.includes(cur));
}

/** Wallets to show for a currency, in display order (Togo wallets first). */
export function ussdNetworksForCurrency(currency: string): UssdNetwork[] {
  const cur = (currency || "").toUpperCase();
  return USSD_NETWORKS.filter((n) => n.currencies.includes(cur));
}

/**
 * A `tel:` href that pre-loads the dial code into the phone's dialer. `#` must
 * be percent-encoded (`%23`) or the dialer drops everything after it.
 */
export function telHref(dial: string): string {
  return `tel:${dial.replace(/#/g, "%23")}`;
}

export type UssdStepSet = {
  network: UssdNetwork;
  dial: string;
  telHref: string;
  directDial?: string;
  directTelHref?: string;
  steps: string[];
  frenchSteps: string[];
};

export type UssdInstructions = {
  payeeNumber: string;
  amountCents: number;
  amountMajor: number;
  amountLabel: string;
  currency: string;
  networks: UssdStepSet[];
};

/** The generic 5-step money-transfer flow, filled in per wallet. */
function stepsFor(network: UssdNetwork, payeeNumber: string, amountLabel: string): string[] {
  return [
    `Dial ${network.dial} on your ${network.label} line.`,
    `Choose “Send money” (Transfert d’argent).`,
    `Enter the merchant number: ${payeeNumber}.`,
    `Enter the amount: ${amountLabel}.`,
    `Confirm with your ${network.label} PIN — done.`,
  ];
}

/** French detailed step-by-step instructions for Francophone / Togolese users */
export function frenchStepsFor(network: UssdNetwork, payeeNumber: string, amountLabel: string): string[] {
  switch (network.id) {
    case "tmoney":
      return [
        `Composez le code USSD ${network.dial} sur votre ligne Togocel / T-Money.`,
        `Sélectionnez l'option 1 « Transfert d'argent ».`,
        `Entrez le numéro du vendeur : ${payeeNumber}.`,
        `Saisissez le montant exact : ${amountLabel}.`,
        `Entrez votre code secret T-Money pour valider le paiement.`,
      ];
    case "flooz":
      return [
        `Composez le code USSD ${network.dial} sur votre ligne Moov Africa / Flooz.`,
        `Sélectionnez l'option 1 « Transfert d'argent ».`,
        `Entrez le numéro Moov du vendeur : ${payeeNumber}.`,
        `Saisissez le montant exact : ${amountLabel}.`,
        `Confirmez la transaction avec votre code PIN secret Flooz.`,
      ];
    default:
      return [
        `Composez ${network.dial} sur votre ligne ${network.label}.`,
        `Choisissez « Envoyer de l'argent » ou « Transfert ».`,
        `Entrez le numéro du destinataire : ${payeeNumber}.`,
        `Entrez le montant : ${amountLabel}.`,
        `Confirmez avec votre code secret ${network.label}.`,
      ];
  }
}

/**
 * Build the dial-code instructions a buyer follows to pay a vendor directly.
 * `payeeNumber` is the vendor's mobile-money number (we default it to their
 * WhatsApp number, which in Togo is usually the same SIM).
 */
export function buildUssdInstructions(args: {
  currency: string;
  payeeNumber: string;
  amountCents: number;
}): UssdInstructions {
  const currency = (args.currency || "XOF").toUpperCase();
  const payeeNumber = (args.payeeNumber || "").trim();
  const amountLabel = formatMoney(args.amountCents, currency);
  const amountMajor = majorUnits(args.amountCents);

  const networks = ussdNetworksForCurrency(currency).map((network) => {
    const directCode = directUssdCode(network.id, payeeNumber, amountMajor);
    return {
      network,
      dial: network.dial,
      telHref: telHref(network.dial),
      directDial: directCode || undefined,
      directTelHref: directCode ? telHref(directCode) : undefined,
      steps: stepsFor(network, payeeNumber, amountLabel),
      frenchSteps: frenchStepsFor(network, payeeNumber, amountLabel),
    };
  });

  return {
    payeeNumber,
    amountCents: args.amountCents,
    amountMajor,
    amountLabel,
    currency,
    networks,
  };
}

/* --------------------------- Payment provider ----------------------------- */

function ussdRef(): string {
  const r = (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2))
    .replace(/-/g, "")
    .slice(0, 16);
  return `ussd_${r}`;
}

/**
 * Vendor-direct rail: no checkout URL, no webhook. The buyer dials and pays the
 * vendor's wallet; the vendor confirms and marks the order PAID (same shape as
 * cash-on-delivery). The intent exists purely for the audit trail.
 */
export const ussdProvider: PaymentProvider = {
  name: "ussd",
  async initiate(opts: InitiateOptions): Promise<InitiateResult> {
    const ref = ussdRef();
    logger.info("payments.ussd.initiate", {
      orderId: opts.orderId,
      vendorId: opts.vendorId,
      amountCents: opts.amountCents,
      providerRef: ref,
    });
    return { providerRef: ref, status: "pending" };
  },
  async verify(providerRef: string): Promise<VerifyResult> {
    // No machine confirmation for a direct wallet transfer — the vendor settles.
    logger.info("payments.ussd.verify", { providerRef });
    return { status: "pending" };
  },
  verifyWebhookSignature(): boolean {
    return true;
  },
};
