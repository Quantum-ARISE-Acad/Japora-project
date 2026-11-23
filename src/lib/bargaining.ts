/**
 * Automatic bargaining — the market haggle, without the vendor present.
 *
 * The vendor sets two prices per product: the price shown to customers and a
 * secret minimum. The assistant accepts any offer at or above the minimum and
 * answers lower offers with counter-offers that move towards the minimum in
 * three rounds, never below it and never back up.
 *
 * Pure functions only (no database), so the rules are unit-tested.
 */
import { isZeroDecimal } from "./currency";

export type BargainDecision =
  | { kind: "accept"; unitCents: number }
  | { kind: "counter"; unitCents: number; round: number; final: boolean };

/** Share of the gap (shown price − minimum) given away at each round. */
const ROUND_SHARE = [0.4, 0.7, 1];

/** Counter-offers are rounded to 50 units in XOF-like currencies, 1 unit otherwise. */
export function priceStepCents(currency: string): number {
  return isZeroDecimal(currency) ? 5000 : 100;
}

function roundUpTo(cents: number, step: number): number {
  return Math.ceil(cents / step) * step;
}

/**
 * Decide what to answer to a unit offer.
 * - offer ≥ shown price → accept at the shown price (never charge more);
 * - offer ≥ minimum     → accept the offer;
 * - otherwise           → counter-offer for the next round.
 */
export function decideOffer(opts: {
  priceCents: number;
  floorCents: number;
  offerCents: number;
  /** Rounds already played in this negotiation (0 for the first offer). */
  round: number;
  /** Last counter-offer sent, 0 if none: a new counter never goes above it. */
  lastCounterCents: number;
  currency: string;
}): BargainDecision {
  const price = Math.max(0, opts.priceCents);
  const floor = Math.min(price, Math.max(0, opts.floorCents));
  const offer = Math.max(0, opts.offerCents);

  if (offer >= price) return { kind: "accept", unitCents: price };
  if (offer >= floor) return { kind: "accept", unitCents: offer };

  const round = Math.max(0, opts.round) + 1;
  const share = ROUND_SHARE[Math.min(round, ROUND_SHARE.length) - 1];
  const gap = price - floor;
  let counter = roundUpTo(price - gap * share, priceStepCents(opts.currency));
  counter = Math.min(price, Math.max(floor, counter));
  if (opts.lastCounterCents > 0) counter = Math.min(counter, Math.max(floor, opts.lastCounterCents));
  if (round >= ROUND_SHARE.length) counter = floor;
  return { kind: "counter", unitCents: counter, round, final: counter <= floor };
}

/** "8 500", "ok 8500 f", "je te donne 8000" → 8500 / 8000 (major units). Null when no price. */
export function extractOfferAmount(text: string): number | null {
  // Thousands groups ("8 500", "12.000") or a plain number of 3+ digits.
  const m = (text || "").match(/(\d{1,3}(?:[ .  ]\d{3})+|\d{3,})/);
  if (!m) return null;
  const value = parseInt(m[1].replace(/[\s.\u00a0\u202f]/g, ""), 10);
  return Number.isFinite(value) && value >= 100 ? value : null;
}

/** A short message that is only an amount, maybe with a few words: "8000", "ok pour 8500 f". */
export function looksLikeBareOffer(text: string): boolean {
  const t = (text || "").trim().toLowerCase();
  if (!t || t.length > 60) return false;
  if (extractOfferAmount(t) === null) return false;
  const words = t.replace(/[\d\s.,!?]+/g, " ").trim().split(/\s+/).filter(Boolean);
  return words.length <= 5;
}

/** "ok", "d'accord", "ça marche", "je prends" — the customer accepts the last counter-offer. */
export function isAcceptance(text: string): boolean {
  const t = (text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  // "ok 8500" is a new offer, not a yes.
  if (/\d/.test(t) || t.split(/\s+/).length > 5) return false;
  // "ok mais c'est trop cher", "non", "je vais réfléchir" are not a yes.
  if (/\b(non|pas|trop|cher|reflechi\w*|attend\w*|plus tard|bas|moins)\b/.test(t)) return false;
  return /^(ok|okay|oui|d'?accord|dac|ca marche|ca va|marche conclu|deal|je prends|vas-?y|go|yes|accord)\b/.test(t);
}

/** Customer-facing line for a counter-offer, warmer at each round. */
export function counterMessage(opts: {
  productName: string;
  offerLabel: string;
  counterLabel: string;
  round: number;
  final: boolean;
}): string {
  if (opts.final) {
    return (
      `${opts.counterLabel} pour ${opts.productName}, c'est mon dernier prix. ` +
      `Je ne peux vraiment pas descendre plus bas.`
    );
  }
  if (opts.round <= 1) {
    return (
      `Ah, ${opts.offerLabel} c'est trop bas pour ${opts.productName}. ` +
      `Pour vous, je peux faire ${opts.counterLabel}.`
    );
  }
  return `On se rapproche ! ${opts.counterLabel} pour ${opts.productName}, c'est un très bon prix.`;
}
