/**
 * "Quelle boutique ?" — routing on the shared Japora WhatsApp number.
 *
 * Every shop without its own Meta number is served by Japora's single number.
 * A message from a shop QR code carries a "(slug)" tag, so the webhook knows the
 * shop. A message without a tag (the customer typed the number by hand) gets a
 * list of shops to choose from instead of landing in a random shop.
 *
 * Pure helpers only (no database), so they run in unit tests and in the browser.
 */
import { isStoredWhatsAppNumberValid } from "./whatsapp-number";

/** Row id of a list reply: "japora-shop:<slug>", or "japora-shop:*" for "all shops". */
export const SHOP_PICK_PREFIX = "japora-shop:";
export const SHOP_PICK_ALL = `${SHOP_PICK_PREFIX}*`;

/** WhatsApp list limits: 10 rows in total, 24-character titles, 72-character descriptions. */
const MAX_ROWS = 10;
const TITLE_MAX = 24;
const DESCRIPTION_MAX = 72;

export type PickerShop = {
  id?: string;
  shopName: string;
  shopSlug: string;
  description?: string;
};

export type ShopPickerMessage = {
  body: string;
  footer: string;
  listButton: string;
  sections: { title: string; rows: { id: string; title: string; description?: string }[] }[];
  /** Plain-text version, sent when the list cannot be delivered. */
  textFallback: string;
};

function clip(s: string, max: number): string {
  const t = s.trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Lowercase, no accents, words separated by single spaces. */
export function normalizeForMatch(s: string): string {
  return ` ${(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

/**
 * The shared number is the Japora number of the server (`WHATSAPP_PHONE_NUMBER_ID`).
 * A vendor's own Meta number has a different phone_number_id.
 */
export function isSharedBotNumber(
  phoneNumberId: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const shared = (env.WHATSAPP_PHONE_NUMBER_ID || "").trim();
  return Boolean(shared && phoneNumberId && phoneNumberId.trim() === shared);
}

/** "japora-shop:kofi-electro" → "kofi-electro"; "japora-shop:*" → "*"; anything else → null. */
export function parseShopPick(text: string): string | null {
  const m = (text || "").trim().toLowerCase().match(/^japora-shop:([a-z0-9][a-z0-9-]{0,80}|\*)$/);
  return m ? m[1] : null;
}

const SWITCH_PHRASES = [
  "changer de boutique",
  "changer boutique",
  "autre boutique",
  "quelle boutique",
  "liste des boutiques",
  "toutes les boutiques",
  "change shop",
  "other shop",
  "switch shop",
];

/** The customer asks to talk to another shop (or to see the list). */
export function wantsShopSwitch(text: string): boolean {
  const t = normalizeForMatch(text);
  if (["boutique", "boutiques", "shop", "shops"].includes(t.trim())) return true;
  return SWITCH_PHRASES.some((p) => t.includes(` ${p} `));
}

/** Shops whose name (or slug) the customer wrote, e.g. "Bonjour Kofi Électro". */
export function matchShopsByName<T extends PickerShop>(text: string, shops: T[]): T[] {
  const t = normalizeForMatch(text);
  return shops.filter((s) => {
    const name = normalizeForMatch(s.shopName);
    const slug = normalizeForMatch(s.shopSlug);
    return (name.trim().length >= 3 && t.includes(name)) || (slug.trim().length >= 3 && t.includes(slug));
  });
}

/**
 * The "Avec quelle boutique voulez-vous parler ?" message: shops named in the
 * customer's text first, then the others, and a last row for the full directory.
 */
export function buildShopPicker(
  shops: PickerShop[],
  opts: { text?: string; origin: string },
): ShopPickerMessage {
  const origin = opts.origin.replace(/\/$/, "");
  const named = new Set(matchShopsByName(opts.text || "", shops).map((s) => s.shopSlug));
  const ranked = [
    ...shops.filter((s) => named.has(s.shopSlug)),
    ...shops.filter((s) => !named.has(s.shopSlug)),
  ].slice(0, MAX_ROWS - 1);

  const rows: ShopPickerMessage["sections"][number]["rows"] = ranked.map((s) => ({
    id: `${SHOP_PICK_PREFIX}${s.shopSlug}`,
    title: clip(s.shopName || s.shopSlug, TITLE_MAX),
    ...(s.description?.trim() ? { description: clip(s.description, DESCRIPTION_MAX) } : {}),
  }));
  rows.push({
    id: SHOP_PICK_ALL,
    title: "Toutes les boutiques",
    description: "La liste complète, avec un lien vers chaque catalogue",
  });

  const body =
    "Bonjour ! Vous êtes sur l'assistant WhatsApp de Japora, qui répond pour plusieurs boutiques.\n\n" +
    "*Avec quelle boutique voulez-vous parler ?*";
  const textFallback = [
    body,
    "",
    ...ranked.map((s) => `• ${s.shopName} : ${origin}/c/${s.shopSlug}`),
    "",
    `Toutes les boutiques : ${origin}/marketplace`,
    "Ouvrez une boutique, puis touchez son bouton WhatsApp.",
  ].join("\n");

  return {
    body,
    footer: "Écrivez « changer de boutique » à tout moment",
    listButton: "Choisir la boutique",
    sections: [{ title: "Boutiques", rows }],
    textFallback,
  };
}

/** Reply to the "Voir toutes les boutiques" row. */
export function allShopsReply(origin: string): string {
  const o = origin.replace(/\/$/, "");
  return (
    `Toutes les boutiques Japora sont ici : ${o}/marketplace\n\n` +
    "Ouvrez la boutique qui vous intéresse et touchez son bouton WhatsApp : " +
    "l'assistant vous répondra au nom de cette boutique."
  );
}

/** First line of the reply once a shop is chosen. */
export function shopChosenPreamble(shopName: string): string {
  return `Vous parlez maintenant avec *${shopName}*. Pour changer, écrivez « changer de boutique ».`;
}

/**
 * WhatsApp link a shop QR code opens. With the Japora bot number configured, the
 * link targets that number and the prefill carries the "(slug)" tag the webhook
 * reads; otherwise it targets the vendor's own number. Null when there is no number.
 */
export function shopWhatsAppLink(opts: {
  shopName: string;
  shopSlug: string;
  vendorNumber?: string;
  botNumber?: string;
  prefill?: string;
}): { url: string; viaJaporaNumber: boolean } | null {
  const bot = (opts.botNumber || "").replace(/\D/g, "");
  // A saved number without its country code would open a wrong (often foreign)
  // number on WhatsApp: no link until the vendor fixes it in Store Setup.
  const vendor = isStoredWhatsAppNumberValid(opts.vendorNumber)
    ? (opts.vendorNumber || "").replace(/\D/g, "")
    : "";
  const number = bot || vendor;
  if (!number) return null;
  const base =
    opts.prefill?.trim() ||
    `Bonjour ${opts.shopName} (${opts.shopSlug}) ! Je viens de scanner votre QR code sur Japora. Pouvez-vous me présenter vos produits disponibles ?`;
  // Always carry the "(slug)" tag, even in a custom message.
  const text = base.toLowerCase().includes(`(${opts.shopSlug.toLowerCase()})`)
    ? base
    : `${base} (${opts.shopSlug})`;
  return {
    url: `https://wa.me/${number}?text=${encodeURIComponent(text)}`,
    viaJaporaNumber: Boolean(bot),
  };
}
