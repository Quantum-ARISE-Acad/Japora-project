/**
 * Japora WhatsApp bot — inbound intent parser + Gemini AI responder + order, deal & tracking engine.
 *
 * Keyword-based first, multilingual (English / Pidgin / Swahili / French),
 * with a Levenshtein-tolerant product matcher that handles typos like
 * "ankra" → "Ankara Maxi Gown" and attribute searches like "the blue one"
 * by also scoring against the product description.
 *
 * Open-ended questions and product searches are answered by Google Gemini,
 * grounded in the vendor's live catalog, delivery zones, and custom instructions,
 * with direct interactive WhatsApp action buttons attached (Order, Propose Deal, Track, Menu).
 */

import { prisma } from "./db";
import { logger } from "./logger";
import { formatMoney, digitsOnly } from "./utils";
import { isOpenNow, parseHours } from "./hours";
import { stripRef, attributeOrder } from "./campaigns";
import { upsertFromOrder } from "./customers";
import { createForUnpaidOrder } from "./receivables";
import {
  isLlmConfigured,
  generateBotReplyWithDiagnostics,
  reserveLlmCall,
  type CatalogItem,
} from "./llm";
import { parseWhatsAppAssistantConfig, explainWhatsAppOrAiError } from "./whatsapp-config";
import { recordVendorDiagnostic } from "./whatsapp";

/** A tappable button the bot can attach to a reply (max 3, titles ≤ 20 chars). */
export type BotButton = { id: string; title: string };
export type BotReply = { reply: string; intent: BotIntent; buttons?: BotButton[] };

function clampTitle(s: string): string {
  return s.length <= 20 ? s : s.slice(0, 19) + "…";
}

export type BotIntent =
  | "greeting"
  | "price_check"
  | "order"
  | "propose_deal"
  | "menu"
  | "unpaid"
  | "track_order"
  | "unknown";

export type ParsedIntent = {
  intent: BotIntent;
  productMatches: string[];
  quantity?: number;
  orderRef?: string;
  proposedPrice?: number;
};

/* ------------------------------- Vocabulary ------------------------------- */

const GREETINGS = [
  // English
  "hi", "hello", "hey", "yo", "hola", "good morning", "good afternoon",
  "good evening", "gm", "ga", "ge",
  // Pidgin / West African
  "abeg", "how far", "how body", "wetin dey", "wetin dey happen", "bawo", "sannu",
  // Swahili
  "habari", "mambo", "jambo", "salamu", "hujambo", "shikamoo",
  // French
  "bonjour", "salut", "bonsoir", "coucou",
];

const MENU_WORDS = [
  // English
  "menu", "catalog", "catalogue", "list", "products", "shop", "store", "show me",
  // Pidgin
  "wetin you get", "wetin dey for shop", "make i see", "show me wetin",
  // Swahili
  "menyu", "orodha", "vitu", "uniza", "bidhaa",
  // French
  "vos produits", "vos articles", "le catalogue", "articles disponibles", "produits disponibles",
  "voir les produits", "voir le catalogue", "catalogue des produits",
];

const UNPAID_WORDS = [
  // English
  "balance", "owe", "owing", "debt", "unpaid", "receivable", "iou", "my tab",
  // Pidgin
  "i dey owe", "owe you", "balance wey i dey owe",
  // Swahili
  "deni", "ninakudai", "balansi", "deni langu",
  // French
  "solde", "je dois", "ma dette", "credit",
];

const TRACK_WORDS = [
  // French
  "suivre", "suivi", "ma commande", "mes commandes", "ou est ma commande",
  "où est ma commande", "statut commande", "statut de ma commande", "etat de ma commande",
  "état de ma commande", "mon colis", "livraison de ma commande", "mon deal", "suivre mon deal",
  // English
  "track", "my order", "my orders", "order status", "where is my order",
  "track order", "tracking",
  // Pidgin / Swahili
  "where my order", "mzigo wangu", "agizo langu",
];

const DEAL_WORDS = [
  // French
  "deal", "je propose", "proposer un deal", "propose un deal", "mon offre",
  "offre a", "offre à", "negocier", "négocier", "marchander", "tu me laisses",
  "laisse moi", "laisser a", "laisser à", "reduction sur", "réduction sur", "remise sur",
  // English / Pidgin
  "bargain", "make a deal", "my offer", "i offer", "last price", "reduce price",
];

const PRICE_WORDS = [
  // English
  "price", "cost", "how much", "available", "in stock", "stock", "got",
  "do you have", "you have", "search", "find me", "looking for",
  // Pidgin
  "wetin be di price", "na how much", "price be", "you get",
  // Swahili
  "bei gani", "ngapi", "shilingi ngapi", "iko", "una", "upo",
  // French
  "c'est combien", "combien", "quel prix", "le prix", "disponible", "vous avez",
  "cherche", "chercher", "trouve", "trouver", "en stock", "recherche",
];

const ORDER_WORDS = [
  // English
  "order", "buy", "want", "take", "purchase", "i need", "send me", "give me",
  "i'll take",
  // Pidgin
  "i wan buy", "i wan order", "send am", "give me",
  // Swahili
  "nataka", "ninataka", "nipe", "leta", "agiza",
  // French
  "je veux", "je voudrais", "je commande", "commander", "acheter", "j'achète",
  "j achete", "envoyer", "envoyez", "prendre", "je prends",
];

// Used for "the blue one" style attribute searches — fallback to description matching.
const COLOR_WORDS = [
  "red", "blue", "green", "yellow", "orange", "pink", "purple", "black", "white",
  "brown", "navy", "beige", "gold", "silver", "cream", "wine", "maroon",
  // French
  "rouge", "bleu", "vert", "jaune", "noir", "blanc",
  // Swahili
  "nyekundu", "bluu", "kijani", "manjano", "nyeusi", "nyeupe",
];

const STRIP_INTENT_RE = new RegExp(
  "\\b(" +
    [...ORDER_WORDS, ...PRICE_WORDS, ...MENU_WORDS, ...TRACK_WORDS, ...DEAL_WORDS]
      .map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join("|") +
    ")\\b",
  "g",
);

/* --------------------------------- Parser --------------------------------- */

function tokenize(text: string): string {
  return (text || "").trim().toLowerCase();
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((n) => text.includes(n));
}

function extractQuantity(text: string): { qty: number; cleaned: string } {
  const m = text.match(/(?:^|\s)(\d{1,3})\s*(?:x|×|\b)/i);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n >= 1 && n <= 100) {
      return {
        qty: n,
        cleaned: text.replace(m[0], " ").replace(/\s+/g, " ").trim(),
      };
    }
  }
  return { qty: 1, cleaned: text };
}

/**
 * Extract a proposed price (e.g. "Deal Robe Ankara à 8000 FCFA" or "Je propose 12500 pour Sac").
 * Picks numbers ≥ 100 (or any number preceded by "à" / "a" / "at" / "for" / "pour").
 */
function extractProposedPrice(text: string): { price?: number; cleaned: string } {
  // Look for an explicit price pattern like "à 8000", "a 8 000", "at 5000", or a number >= 100
  const explicit = text.match(/(?:à|a|at|pour|for|de|offre|propose|deal)\s*(\d[\d\s.,]{1,9})\s*(?:fcfa|cfa|xof|ngn|eur|usd|\$|€|f\b)?/i);
  if (explicit) {
    const numStr = explicit[1].replace(/[\s.,]/g, "");
    const val = parseInt(numStr, 10);
    if (Number.isFinite(val) && val > 0) {
      return {
        price: val,
        cleaned: text.replace(explicit[0], " ").replace(/\s+/g, " ").trim(),
      };
    }
  }
  // Fallback: any standalone number >= 100 in the text
  const anyBigNum = text.match(/\b(\d{3,8})\s*(?:fcfa|cfa|xof|ngn|f\b)?/i);
  if (anyBigNum) {
    const val = parseInt(anyBigNum[1], 10);
    if (Number.isFinite(val) && val >= 100) {
      return {
        price: val,
        cleaned: text.replace(anyBigNum[0], " ").replace(/\s+/g, " ").trim(),
      };
    }
  }
  return { cleaned: text };
}

function extractOrderRef(text: string): string | undefined {
  // Matches #AB12CD or CMD-AB12CD or ref AB12CD (6-12 alphanumeric chars)
  const hashMatch = text.match(/#([a-z0-9]{4,25})\b/i);
  if (hashMatch) return hashMatch[1];
  const refMatch = text.match(/\b(?:ref|cmd|commande|order)\s*[:#-]?\s*([a-z0-9]{5,25})\b/i);
  if (refMatch && /\d/.test(refMatch[1])) return refMatch[1];
  return undefined;
}

/**
 * Pure parser. Doesn't touch the database — productMatches is the residual
 * phrase after stripping intent keywords; the caller fuzzy-matches it
 * against the catalog.
 */
export function parseIntent(text: string): ParsedIntent {
  const t = tokenize(text);
  if (!t) return { intent: "unknown", productMatches: [] };

  const orderRef = extractOrderRef(t);
  if (containsAny(t, TRACK_WORDS) || (orderRef && !containsAny(t, ORDER_WORDS))) {
    return { intent: "track_order", productMatches: [], orderRef };
  }

  // Deal / price negotiation intent
  if (containsAny(t, DEAL_WORDS)) {
    const { price, cleaned: withoutPrice } = extractProposedPrice(t);
    const strippedDeal = withoutPrice.replace(STRIP_INTENT_RE, " ").replace(/\s+/g, " ").trim();
    const { qty, cleaned } = extractQuantity(strippedDeal);
    const productMatches = cleaned ? [cleaned] : strippedDeal ? [strippedDeal] : [];
    return {
      intent: "propose_deal",
      productMatches,
      quantity: qty,
      proposedPrice: price,
    };
  }

  const strippedRaw = t.replace(STRIP_INTENT_RE, " ").replace(/\s+/g, " ").trim();
  const { qty, cleaned } = extractQuantity(strippedRaw);
  const productMatches = cleaned ? [cleaned] : strippedRaw ? [strippedRaw] : [];

  if (containsAny(t, UNPAID_WORDS)) return { intent: "unpaid", productMatches };
  if (containsAny(t, ORDER_WORDS)) return { intent: "order", productMatches, quantity: qty };
  if (containsAny(t, MENU_WORDS)) return { intent: "menu", productMatches };
  if (containsAny(t, PRICE_WORDS)) return { intent: "price_check", productMatches };

  // Bare greeting only if it's a short hello with nothing else interesting.
  if (containsAny(t, GREETINGS) && t.split(/\s+/).length <= 4) {
    return { intent: "greeting", productMatches: [] };
  }

  // Bare product-name guess: short phrase, no keyword → treat as a price check.
  if (productMatches.length > 0) return { intent: "price_check", productMatches };

  return { intent: "unknown", productMatches: [] };
}

/* ----------------------------- Fuzzy matching ----------------------------- */

/** Levenshtein distance — iterative two-row DP. O(n·m) time, O(min(n,m)) space. */
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  if (a.length < b.length) [a, b] = [b, a];

  let prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    const curr = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = curr;
  }
  return prev[b.length];
}

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Tokens ≥2 chars, excluding generic stop words that drown out signal.
const STOP_WORDS = new Set([
  "the", "this", "that", "these", "those", "one", "ones", "a", "an", "and",
  "of", "for", "with", "without", "to", "from", "in", "on", "is", "are", "was",
  "were", "be", "your", "my", "our", "their", "or", "any", "some", "do", "you",
  "have", "has", "had", "que", "le", "la", "les", "un", "une", "des", "du",
  "de", "au", "aux", "je", "tu", "il", "nous", "vous", "ils", "pour", "sur",
  "dans", "avec", "est", "sont", "avez", "moi", "me", "disponible", "disponibles",
  "boutique", "produit", "produits", "article", "articles", "fcfa", "cfa", "xof",
]);

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
}

/**
 * Token-level fuzzy score. Every query token must find a tolerant match in the
 * candidate. Returns a per-token average distance, or Infinity if any token is
 * unmatched. Substring containment scores 0 (so "ankara" matches "ankara maxi").
 */
function scoreTokens(qTokens: string[], cTokens: string[]): number {
  if (qTokens.length === 0 || cTokens.length === 0) return Infinity;
  let total = 0;
  for (const qt of qTokens) {
    let best = Infinity;
    for (const ct of cTokens) {
      if (ct === qt || ct.includes(qt) || qt.includes(ct)) {
        best = 0;
        break;
      }
      const tolerance = Math.max(1, Math.floor(Math.min(qt.length, ct.length) / 4));
      const d = levenshtein(qt, ct);
      if (d <= tolerance && d < best) best = d;
    }
    if (best === Infinity) return Infinity;
    total += best;
  }
  return total / qTokens.length;
}

type ScoredProduct = {
  product: {
    id: string;
    name: string;
    description: string;
    priceCents: number;
    imageUrl: string;
    sizes: string;
    stock: number;
    preOrderAllowed: boolean;
    depositPercent: number;
  };
  score: number;
};

/**
 * Score every active product by name (and description, used as a fallback for
 * attribute searches like "the blue one"). Returns the top match if its score
 * is under a sensible threshold.
 */
async function findBestProductMatch(
  vendorId: string,
  phrase: string,
): Promise<ScoredProduct["product"] | null> {
  const trimmed = phrase.trim();
  if (!trimmed) return null;
  const qTokens = tokens(trimmed);
  if (qTokens.length === 0) return null;

  const products = await prisma.product.findMany({
    where: { vendorId, isActive: true },
    take: 200,
  });
  if (products.length === 0) return null;

  const hasAttribute = qTokens.some((t) => COLOR_WORDS.includes(t));

  let best: ScoredProduct | null = null;
  for (const p of products) {
    const nameScore = scoreTokens(qTokens, tokens(p.name));
    const descScore = hasAttribute ? scoreTokens(qTokens, tokens(p.description)) : Infinity;
    // Also check single-token partial match if multi-token query had extra conversational words
    const partialNameMatches = qTokens.filter((qt) =>
      tokens(p.name).some((ct) => ct === qt || ct.includes(qt) || qt.includes(ct)),
    ).length;
    const partialScore =
      partialNameMatches > 0 ? 1.2 - (partialNameMatches / qTokens.length) * 0.8 : Infinity;
    const score = Math.min(nameScore, descScore + 0.5, partialScore);
    if (score < (best?.score ?? Infinity)) best = { product: p, score };
  }

  if (!best || best.score > 1.5) return null;
  return best.product;
}

async function topActiveProducts(vendorId: string, take = 6) {
  return prisma.product.findMany({
    where: { vendorId, isActive: true },
    orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
    take,
  });
}

/**
 * Retrieve the catalog items most relevant to a free-text question, for the LLM
 * answer layer.
 */
async function retrieveForLlm(
  vendorId: string,
  query: string,
  currency: string,
  take = 12,
): Promise<CatalogItem[]> {
  const products = await prisma.product.findMany({
    where: { vendorId, isActive: true },
    take: 200,
  });
  if (products.length === 0) return [];

  const qTokens = tokens(query);
  const ranked = products
    .map((p) => {
      const nameScore = qTokens.length ? scoreTokens(qTokens, tokens(p.name)) : Infinity;
      const descScore = qTokens.length ? scoreTokens(qTokens, tokens(p.description)) : Infinity;
      const overlapCount = qTokens.filter((qt) =>
        tokens(p.name + " " + p.description).some((ct) => ct.includes(qt) || qt.includes(ct)),
      ).length;
      const effectiveScore = Math.min(
        nameScore,
        descScore + 0.5,
        overlapCount > 0 ? 2 - overlapCount * 0.3 : Infinity,
      );
      return { p, score: effectiveScore };
    })
    .sort((a, b) => a.score - b.score || b.p.stock - a.p.stock)
    .slice(0, take)
    .map(({ p }) => ({
      id: p.id,
      name: p.name,
      priceLabel: formatMoney(p.priceCents, currency),
      stock: p.stock,
      sizes: p.sizes || undefined,
      description: p.description || undefined,
    }));
  return ranked;
}

async function tryLlmAnswer(opts: {
  vendorId: string;
  shopName: string;
  currency: string;
  question: string;
  assistantName?: string;
  deliveryInfo?: string;
  customInstructions?: string;
  vendorGeminiKey?: string;
  aiEnabled?: boolean;
}): Promise<{ reply: string | null; topProducts: CatalogItem[]; llmError?: string }> {
  if (opts.aiEnabled === false) return { reply: null, topProducts: [] };
  if (!isLlmConfigured(opts.vendorGeminiKey) || opts.question.trim().length < 2) {
    return { reply: null, topProducts: [] };
  }
  if (!(await reserveLlmCall(opts.vendorId))) {
    return { reply: null, topProducts: [], llmError: "Limite quotidienne d'appels IA atteinte." };
  }
  try {
    const catalog = await retrieveForLlm(opts.vendorId, opts.question, opts.currency, 12);
    const res = await generateBotReplyWithDiagnostics({
      shopName: opts.shopName,
      question: opts.question,
      catalog,
      assistantName: opts.assistantName,
      deliveryInfo: opts.deliveryInfo,
      customInstructions: opts.customInstructions,
      vendorGeminiKey: opts.vendorGeminiKey,
    });
    if (!res.reply && res.error) {
      const explained = explainWhatsAppOrAiError(res.error, "gemini_ai");
      await recordVendorDiagnostic(opts.vendorId, {
        stage: "gemini_ai",
        severity: "warning",
        title: explained.title,
        message: explained.message,
        details: res.error,
        fixHint: explained.fixHint,
      });
    }
    return { reply: res.reply, topProducts: catalog.slice(0, 3), llmError: res.error };
  } catch (e) {
    const errStr = e instanceof Error ? e.message : String(e);
    logger.warn("bot.llm_failed", { vendorId: opts.vendorId, error: errStr });
    const explained = explainWhatsAppOrAiError(errStr, "gemini_ai");
    await recordVendorDiagnostic(opts.vendorId, {
      stage: "gemini_ai",
      severity: "warning",
      title: explained.title,
      message: explained.message,
      details: errStr,
      fixHint: explained.fixHint,
    });
    return { reply: null, topProducts: [], llmError: errStr };
  }
}

/* ----------------------------- Order, Deal & Tracking --------------------------- */

const STATUS_LABELS_FR: Record<string, string> = {
  NEW: "🕒 Nouvelle (en attente de confirmation par le vendeur)",
  CONFIRMED: "✅ Confirmée (commande validée par le vendeur, en préparation)",
  PAID: "💳 Payée (en cours de préparation / livraison)",
  DELIVERED: "🎉 Livrée (commande terminée)",
  CANCELLED: "❌ Annulée / Refusée",
};

export function parseDealNote(note: string | null | undefined): {
  isDeal: boolean;
  dealState: "PENDING" | "ACCEPTED" | "REJECTED";
  originalCents?: number;
  proposedCents?: number;
  cleanNote: string;
} {
  const raw = note || "";
  const m = raw.match(/^\[DEAL_(PENDING|ACCEPTED|REJECTED)(?:\|orig:(\d+)\|prop:(\d+))?\]\s*/);
  if (!m) {
    return { isDeal: false, dealState: "PENDING", cleanNote: raw };
  }
  return {
    isDeal: true,
    dealState: m[1] as "PENDING" | "ACCEPTED" | "REJECTED",
    originalCents: m[2] ? parseInt(m[2], 10) : undefined,
    proposedCents: m[3] ? parseInt(m[3], 10) : undefined,
    cleanNote: raw.slice(m[0].length).trim(),
  };
}

function formatOrderTimeline(status: string, isDeal: boolean): string {
  if (status === "CANCELLED") {
    return isDeal
      ? `❌ Deal refusé / Commande annulée`
      : `❌ Commande annulée`;
  }
  const s1 = "✅ 1. Reçue";
  const s2 =
    status === "NEW"
      ? isDeal
        ? "⏳ 2. Validation du deal par le vendeur (En cours...)"
        : "⏳ 2. Confirmation vendeur (En cours...)"
      : isDeal
      ? "🎉 2. Deal validé & Confirmé par le vendeur"
      : "✅ 2. Confirmée par le vendeur";
  const s3 =
    status === "PAID" || status === "DELIVERED"
      ? "✅ 3. Payée"
      : status === "CONFIRMED"
      ? "⏳ 3. Paiement (En attente)"
      : "⚪ 3. Paiement";
  const s4 =
    status === "DELIVERED"
      ? "🎉 4. Livrée !"
      : status === "PAID"
      ? "🚚 4. En cours de préparation / livraison"
      : "⚪ 4. Livraison";
  return `${s1}\n${s2}\n${s3}\n${s4}`;
}

async function trackCustomerOrders(
  vendorId: string,
  fromPhone: string,
  shopName: string,
  currency: string,
  orderRef?: string,
): Promise<BotReply> {
  const cleanPhone = digitsOnly(fromPhone);
  const appUrl = (
    process.env.NEXT_PUBLIC_PUBLIC_TUNNEL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:5174"
  ).replace(/\/$/, "");

  const phoneTail = cleanPhone.length >= 8 ? cleanPhone.slice(-8) : cleanPhone;

  // Fetch recent orders and match by orderRef or customerPhone
  const allRecent = await prisma.order.findMany({
    where: { deletedAt: null },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 150,
  });

  const cleanNeedle = (orderRef || "").replace(/^#/, "").trim().toLowerCase();

  let orders = allRecent.filter((o) => {
    const idLower = o.id.toLowerCase();
    if (cleanNeedle) {
      return (
        idLower === cleanNeedle ||
        idLower.endsWith(cleanNeedle) ||
        idLower.startsWith(cleanNeedle) ||
        idLower.slice(-6) === cleanNeedle ||
        idLower.slice(0, 8) === cleanNeedle
      );
    }
    if (phoneTail) {
      const oDigits = digitsOnly(o.customerPhone || "");
      return (
        oDigits === cleanPhone ||
        (phoneTail.length >= 8 && oDigits.endsWith(phoneTail))
      );
    }
    return o.vendorId === vendorId;
  });

  // Ensure any matched WhatsApp order from this customer is synced to the active vendor's dashboard
  for (const ord of orders) {
    if (
      ord.vendorId !== vendorId &&
      (ord.source === "whatsapp" || ord.source === "whatsapp_deal")
    ) {
      await prisma.order
        .update({ where: { id: ord.id }, data: { vendorId } })
        .catch(() => {});
      ord.vendorId = vendorId;
    }
  }

  orders = orders.slice(0, 5);

  if (orders.length === 0) {
    return {
      reply:
        `📦 Aucune commande ou proposition de deal active trouvée pour votre numéro (${cleanPhone || fromPhone}) chez ${shopName}.\n\n` +
        `Astuce : Envoyez la référence de votre commande (ex: #LTW4GX), appuyez sur "See menu" pour commander, ou "🤝 Proposer deal" pour négocier un prix.`,
      intent: "track_order",
      buttons: [
        { id: "MENU", title: "See menu" },
        { id: "DEAL", title: "🤝 Proposer deal" },
        { id: "BALANCE", title: "My balance" },
      ],
    };
  }

  const latest = orders[0];
  const refShort = latest.id.slice(-6).toUpperCase();
  const dealInfo = parseDealNote(latest.note);
  const isDeal = dealInfo.isDeal || latest.source === "whatsapp_deal";
  let statusDesc = STATUS_LABELS_FR[latest.status] || latest.status;
  if (isDeal) {
    if (latest.status === "NEW") {
      statusDesc = "🤝 Deal proposé — En attente de validation par le vendeur";
    } else if (latest.status === "CONFIRMED") {
      statusDesc = "🎉 Deal ACCEPTÉ par le vendeur — Confirmé";
    } else if (latest.status === "CANCELLED") {
      statusDesc = "❌ Deal refusé / annulé";
    }
  }

  const itemsText = latest.items
    .map((it) => `• ${it.quantity}× ${it.productName}${it.size ? ` (${it.size})` : ""}`)
    .join("\n");
  const payUrl = `${appUrl}/pay/${latest.id}`;
  const timeline = formatOrderTimeline(latest.status, isDeal);
  const dateStr = new Date(latest.createdAt).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  const dealLine =
    isDeal && dealInfo.originalCents
      ? `\n💰 Prix Deal : ${formatMoney(latest.totalCents, currency)} (au lieu de ${formatMoney(dealInfo.originalCents, currency)})`
      : `\n💰 Total : ${formatMoney(latest.totalCents, currency)}`;

  const otherOrdersNote =
    orders.length > 1
      ? `\n\n📋 Vos autres commandes / deals récents (${orders.length - 1}) :\n` +
        orders
          .slice(1, 4)
          .map((o) => {
            const r = o.id.slice(-6).toUpperCase();
            const d = parseDealNote(o.note).isDeal || o.source === "whatsapp_deal";
            const st =
              o.status === "NEW"
                ? d
                  ? "⏳ Deal en attente"
                  : "🕒 Nouvelle"
                : o.status === "CONFIRMED"
                ? d
                  ? "🎉 Deal accepté"
                  : "✅ Confirmée"
                : o.status === "PAID"
                ? "💳 Payée"
                : o.status === "DELIVERED"
                ? "🎉 Livrée"
                : "❌ Annulée";
            const itName = o.items[0]?.productName || "Commande";
            return `• #${r} — ${itName} (${formatMoney(o.totalCents, currency)}) : ${st}`;
          })
          .join("\n")
      : "";

  const buttons: BotButton[] = [
    { id: `TRACK:${latest.id}`, title: "🔄 Actualiser suivi" },
    { id: "MENU", title: "See menu" },
  ];
  if (latest.status === "NEW") {
    buttons.push({ id: `CANCEL:${latest.id}`, title: "❌ Annuler" });
  }

  return {
    reply:
      `📦 SUIVI EN DIRECT — Commande #${refShort} (${dateStr})\n` +
      `Boutique : ${shopName}\n\n` +
      `📊 Progression :\n${timeline}\n\n` +
      `📌 Statut actuel : ${statusDesc}\n` +
      `🛍️ Articles :\n${itemsText || "• Commande directe"}` +
      dealLine +
      `\n🔗 Lien suivi & paiement : ${payUrl}` +
      otherOrdersNote,
    intent: "track_order",
    buttons: buttons.slice(0, 3),
  };
}

/** Create a WhatsApp order for a known product, decrement stock, and sync CRM/Receivables. */
async function placeOrder(
  vendorId: string,
  fromPhone: string,
  product: { id: string; name: string; priceCents: number; stock: number; preOrderAllowed: boolean },
  currency: string,
  shopName: string,
  intent: BotIntent,
  quantity = 1,
): Promise<BotReply> {
  const qty = Math.max(1, Math.min(product.stock > 0 ? product.stock : 1, quantity));
  if (product.stock <= 0 && !product.preOrderAllowed) {
    return {
      reply: `Sorry, ${product.name} is out of stock right now.`,
      intent,
      buttons: [{ id: "MENU", title: "See menu" }],
    };
  }

  const totalCents = product.priceCents * qty;
  const cleanPhone = digitsOnly(fromPhone) || fromPhone;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        vendorId,
        customerName: cleanPhone ? `Client WhatsApp (${cleanPhone})` : "Client WhatsApp",
        customerPhone: cleanPhone,
        status: "NEW",
        totalCents,
        source: "whatsapp",
        note: "Commande passée directement via l'Assistant WhatsApp IA",
        items: {
          create: [
            {
              productId: product.id,
              productName: product.name,
              quantity: qty,
              unitPriceCents: product.priceCents,
            },
          ],
        },
      },
    });

    if (product.stock >= qty) {
      await tx.product.update({
        where: { id: product.id },
        data: { stock: { decrement: qty } },
      });
    }

    if (cleanPhone) {
      try {
        const customerId = await upsertFromOrder(tx, vendorId, {
          customerName: `Client WhatsApp (${cleanPhone})`,
          customerPhone: cleanPhone,
          customerEmail: "",
          totalCents,
        });
        if (customerId) {
          await tx.order.update({
            where: { id: created.id },
            data: { customerId },
          });
        }
      } catch (e) {
        logger.warn("bot.crm_upsert_failed", { error: String(e) });
      }
    }

    return created;
  });

  try {
    await createForUnpaidOrder(prisma, vendorId, order.id, {
      amountCents: totalCents,
      note: "Auto-created from WhatsApp order",
    });
  } catch (e) {
    logger.warn("bot.receivable_failed", { orderId: order.id, error: String(e) });
  }

  logger.info("bot.order_created", {
    vendorId,
    orderId: order.id,
    productId: product.id,
    qty,
    from: fromPhone,
  });

  try {
    await attributeOrder({ orderId: order.id, vendorId, phone: fromPhone, revenueCents: totalCents });
  } catch (e) {
    logger.warn("bot.attribute_failed", { orderId: order.id, error: String(e) });
  }

  const appUrl = (
    process.env.NEXT_PUBLIC_PUBLIC_TUNNEL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:5174"
  ).replace(/\/$/, "");
  const payUrl = `${appUrl}/pay/${order.id}`;
  const refCode = order.id.slice(-6).toUpperCase();
  const qtyPrefix = qty > 1 ? `${qty}× ` : "";

  return {
    reply:
      `✅ Commande enregistrée chez ${shopName} : ${qtyPrefix}${product.name} — ${formatMoney(totalCents, currency)}.\n\n` +
      `📌 Référence : #${refCode}\n` +
      `🔗 Suivi & Paiement en direct : ${payUrl}\n\n` +
      `Votre commande est visible dans le Dashboard du vendeur et sera confirmée sous peu !`,
    intent,
    buttons: [
      { id: `TRACK:${order.id}`, title: "📦 Suivre commande" },
      { id: "MENU", title: "Keep shopping" },
      { id: "BALANCE", title: "My balance" },
    ],
  };
}

/**
 * Create a Deal Proposal Order (price negotiation) that goes directly to the
 * vendor's dashboard for validation (Accept / Reject).
 */
export async function placeDealOrder(opts: {
  vendorId: string;
  fromPhone: string;
  customerName?: string;
  product: { id: string; name: string; priceCents: number; stock: number; preOrderAllowed: boolean };
  proposedTotalCents: number;
  currency: string;
  shopName: string;
  quantity?: number;
  customNote?: string;
}): Promise<{ orderId: string; refCode: string; botReply: BotReply }> {
  const qty = Math.max(1, opts.quantity || 1);
  const originalTotalCents = opts.product.priceCents * qty;
  const proposedTotalCents = Math.max(100, Math.round(opts.proposedTotalCents));
  const unitProposedCents = Math.max(100, Math.round(proposedTotalCents / qty));
  const cleanPhone = digitsOnly(opts.fromPhone) || opts.fromPhone;
  const discountPct =
    originalTotalCents > 0
      ? Math.round(((originalTotalCents - proposedTotalCents) / originalTotalCents) * 100)
      : 0;

  const dealNote =
    `[DEAL_PENDING|orig:${originalTotalCents}|prop:${proposedTotalCents}] ` +
    `🤝 Proposition de deal : ${formatMoney(proposedTotalCents, opts.currency)} au lieu de ${formatMoney(originalTotalCents, opts.currency)}` +
    (discountPct > 0 ? ` (-${discountPct}%)` : "") +
    (opts.customNote ? ` — ${opts.customNote}` : "");

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        vendorId: opts.vendorId,
        customerName:
          opts.customerName?.trim() ||
          (cleanPhone ? `Client Deal (${cleanPhone})` : "Client Deal WhatsApp"),
        customerPhone: cleanPhone,
        status: "NEW",
        totalCents: proposedTotalCents,
        source: "whatsapp_deal",
        note: dealNote,
        items: {
          create: [
            {
              productId: opts.product.id,
              productName: opts.product.name,
              quantity: qty,
              unitPriceCents: unitProposedCents,
            },
          ],
        },
      },
    });

    if (cleanPhone) {
      try {
        const customerId = await upsertFromOrder(tx, opts.vendorId, {
          customerName:
            opts.customerName?.trim() || `Client Deal (${cleanPhone})`,
          customerPhone: cleanPhone,
          customerEmail: "",
          totalCents: proposedTotalCents,
        });
        if (customerId) {
          await tx.order.update({
            where: { id: created.id },
            data: { customerId },
          });
        }
      } catch (e) {
        logger.warn("bot.deal_crm_failed", { error: String(e) });
      }
    }

    return created;
  });

  const refCode = order.id.slice(-6).toUpperCase();
  const appUrl = (
    process.env.NEXT_PUBLIC_PUBLIC_TUNNEL_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:5174"
  ).replace(/\/$/, "");
  const payUrl = `${appUrl}/pay/${order.id}`;

  const botReply: BotReply = {
    reply:
      `🤝 Proposition de deal enregistrée et transmise à ${opts.shopName} !\n\n` +
      `• Article : ${qty}× ${opts.product.name}\n` +
      `• Prix catalogue : ${formatMoney(originalTotalCents, opts.currency)}\n` +
      `• Votre offre : ${formatMoney(proposedTotalCents, opts.currency)}${discountPct > 0 ? ` (-${discountPct}%)` : ""}\n` +
      `• Réf du deal : #${refCode}\n` +
      `• Suivi : ${payUrl}\n\n` +
      `⏳ Le vendeur va valider votre offre depuis son Dashboard et vous recevrez une notification ici dès qu'elle est acceptée !`,
    intent: "propose_deal",
    buttons: [
      { id: `TRACK:${order.id}`, title: "📦 Suivre mon deal" },
      { id: "MENU", title: "See menu" },
    ],
  };

  return { orderId: order.id, refCode, botReply };
}

/**
 * Build the bot's reply. Returns optional interactive buttons; the webhook
 * sends them as tappable WhatsApp buttons (falling back to text). Button taps
 * arrive back as their `id` (MENU / BALANCE / TRACK / DEAL / ORDER:<productId>), which we
 * fast-path here. Outside business hours the away message is prepended.
 */
export async function respondTo(
  vendorId: string,
  fromPhone: string,
  text: string,
): Promise<BotReply> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: {
      shopName: true,
      shopSlug: true,
      currency: true,
      awayMessage: true,
      businessHours: true,
      tzOffsetMinutes: true,
      deliveryEnabled: true,
      deliveryFeeCents: true,
      deliveryZones: true,
      uiPrefs: true,
    },
  });
  const currency = vendor?.currency || "NGN";
  const shopName = vendor?.shopName || "our shop";
  const waConfig = parseWhatsAppAssistantConfig(vendor?.uiPrefs);

  const deliveryInfo = vendor?.deliveryEnabled
    ? `Livraison disponible (Frais: ${formatMoney(vendor.deliveryFeeCents, currency)}; Zones: ${vendor.deliveryZones || "Standard"}).`
    : "Retrait en boutique ou accord par WhatsApp.";

  // Away-hours gate: if closed and an away message is set, lead with it.
  const open = isOpenNow(parseHours(vendor?.businessHours), vendor?.tzOffsetMinutes ?? 0);
  const away = !open && vendor?.awayMessage ? `${vendor.awayMessage}\n\n` : "";
  const withAway = (r: BotReply): BotReply => ({ ...r, reply: away + r.reply });

  // Strip any CTWA ref tag (e.g. "(ref: AB12CD)")
  const raw = stripRef((text || "").trim());

  // Helper to resolve a product by button ID (preferring active vendor's catalog, or matching by name if button came from an earlier chat)
  async function findProductForButton(id: string) {
    let p = await prisma.product.findFirst({
      where: { id, vendorId, isActive: true },
    });
    if (!p) {
      const anyP = await prisma.product.findUnique({ where: { id } });
      if (anyP) {
        const sameNameInVendor = await prisma.product.findFirst({
          where: { vendorId, isActive: true, name: anyP.name },
        });
        p = sameNameInVendor || anyP;
      }
    }
    return p;
  }

  // Button fast-path: ORDER:<productId>[:<qty>]
  if (/^ORDER:/i.test(raw)) {
    const parts = raw.split(":");
    const id = (parts[1] || "").trim();
    const qty = Math.max(1, parseInt(parts[2] || "1", 10) || 1);
    const product = await findProductForButton(id);
    if (product) {
      return withAway(await placeOrder(vendorId, fromPhone, product, currency, shopName, "order", qty));
    }
  }

  // Button fast-path: DEAL_CREATE:<productId>:<proposedPriceCents>[:<qty>]
  if (/^DEAL_CREATE:/i.test(raw)) {
    const parts = raw.split(":");
    const id = (parts[1] || "").trim();
    const proposedCents = parseInt(parts[2] || "0", 10);
    const qty = Math.max(1, parseInt(parts[3] || "1", 10) || 1);
    const product = await findProductForButton(id);
    if (product && proposedCents > 0) {
      const { botReply } = await placeDealOrder({
        vendorId,
        fromPhone,
        product,
        proposedTotalCents: proposedCents,
        currency,
        shopName,
        quantity: qty,
      });
      return withAway(botReply);
    }
  }

  // Button fast-path: DEAL_PROMPT:<productId>
  if (/^DEAL_PROMPT:/i.test(raw)) {
    const id = raw.slice(raw.indexOf(":") + 1).trim();
    const product = await findProductForButton(id);
    if (product) {
      const offer10 = Math.round((product.priceCents * 0.9) / 100) * 100;
      const offer15 = Math.round((product.priceCents * 0.85) / 100) * 100;
      return withAway({
        reply:
          `🤝 Proposer un deal sur "${product.name}" (Prix actuel : ${formatMoney(product.priceCents, currency)}) :\n\n` +
          `• Choisissez une offre rapide ci-dessous\n` +
          `• Ou écrivez directement votre prix, par exemple :\n` +
          `"Deal ${product.name} à ${Math.round((product.priceCents * 0.8) / 100)}"`,
        intent: "propose_deal",
        buttons: [
          {
            id: `DEAL_CREATE:${product.id}:${offer10}:1`,
            title: clampTitle(`🤝 -10% (${formatMoney(offer10, currency)})`),
          },
          {
            id: `DEAL_CREATE:${product.id}:${offer15}:1`,
            title: clampTitle(`🤝 -15% (${formatMoney(offer15, currency)})`),
          },
          {
            id: `ORDER:${product.id}`,
            title: "🛒 Prix normal",
          },
        ],
      });
    }
  }

  // Button fast-path: DEAL (list products to propose a deal on)
  if (/^DEAL$/i.test(raw)) {
    const products = await topActiveProducts(vendorId, 5);
    if (products.length === 0) {
      return withAway({
        reply: `Aucun produit actif pour proposer un deal pour le moment.`,
        intent: "propose_deal",
      });
    }
    const lines = products.map(
      (p, i) => `${i + 1}. ${p.name} — ${formatMoney(p.priceCents, currency)}`,
    );
    return withAway({
      reply:
        `🤝 Sur quel article de ${shopName} souhaitez-vous proposer un deal ?\n\n` +
        `${lines.join("\n")}\n\n` +
        `Appuyez sur un article ci-dessous ou écrivez :\n"Deal [Nom du produit] à [Votre prix]"`,
      intent: "propose_deal",
      buttons: products.slice(0, 3).map((p) => ({
        id: `DEAL_PROMPT:${p.id}`,
        title: clampTitle(`🤝 ${p.name}`),
      })),
    });
  }

  // Button fast-path: TRACK or TRACK:<orderId>
  if (/^TRACK(?::|$)/i.test(raw)) {
    const orderId = raw.includes(":") ? raw.slice(raw.indexOf(":") + 1).trim() : undefined;
    return withAway(await trackCustomerOrders(vendorId, fromPhone, shopName, currency, orderId));
  }

  // Button fast-path: CANCEL:<orderId>
  if (/^CANCEL:/i.test(raw)) {
    const orderId = raw.slice(raw.indexOf(":") + 1).trim();
    const order = await prisma.order.findFirst({
      where: { id: orderId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      return withAway({
        reply: `Commande introuvable.`,
        intent: "track_order",
        buttons: [{ id: "MENU", title: "See menu" }],
      });
    }
    if (order.status !== "NEW") {
      return withAway({
        reply: `La commande #${order.id.slice(-6).toUpperCase()} est déjà au statut ${order.status} et ne peut plus être annulée automatiquement. Contactez ${shopName}.`,
        intent: "track_order",
        buttons: [{ id: `TRACK:${order.id}`, title: "📦 Suivre commande" }],
      });
    }
    await prisma.$transaction(async (tx) => {
      await tx.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      for (const it of order.items) {
        if (it.productId && order.source !== "whatsapp_deal") {
          await tx.product.update({
            where: { id: it.productId },
            data: { stock: { increment: it.quantity } },
          });
        }
      }
    });
    return withAway({
      reply: `❌ Votre commande #${order.id.slice(-6).toUpperCase()} chez ${shopName} a bien été annulée.`,
      intent: "track_order",
      buttons: [{ id: "MENU", title: "See menu" }],
    });
  }

  const parsed = parseIntent(raw);

  switch (parsed.intent) {
    case "greeting": {
      const customWelcome = waConfig.welcomeMessage
        ? `${waConfig.welcomeMessage}\n\n`
        : "";
      return withAway({
        reply:
          customWelcome ||
          `Bonjour ! Bienvenue chez ${shopName} sur Japora 👋\n\n` +
            `Je suis votre assistant IA. Vous pouvez :\n` +
            `• Voir le catalogue ou me demander de chercher un produit disponible\n` +
            `• Commander un article en 1 clic\n` +
            `• Proposer un deal / négocier un prix\n` +
            `• Suivre l'état de votre commande`,
        intent: parsed.intent,
        buttons: [
          { id: "MENU", title: "See menu" },
          { id: "DEAL", title: "🤝 Proposer deal" },
          { id: "TRACK", title: "📦 Suivre commande" },
        ],
      });
    }

    case "menu": {
      const products = await topActiveProducts(vendorId, 8);
      if (products.length === 0) {
        return withAway({
          reply: `${shopName} hasn't listed any products yet. Check back soon.`,
          intent: parsed.intent,
        });
      }
      const lines = products.map(
        (p, i) =>
          `${i + 1}. ${p.name} — ${formatMoney(p.priceCents, currency)}${
            p.stock > 0 ? ` (${p.stock} dispo)` : " (Épuisé)"
          }`,
      );
      return withAway({
        reply:
          `🛍️ Catalogue ${shopName} — Produits disponibles :\n\n${lines.join("\n")}\n\n` +
          `Appuyez sur un produit pour le commander, ou écrivez "Deal [Produit] à [Prix]" pour proposer un deal :`,
        intent: parsed.intent,
        // Top 3 as one-tap order buttons (WhatsApp caps button rows at 3).
        buttons: products.slice(0, 3).map((p) => ({
          id: `ORDER:${p.id}`,
          title: clampTitle(p.name),
        })),
      });
    }

    case "propose_deal": {
      const phrase = parsed.productMatches[0] || "";
      const product =
        (phrase ? await findBestProductMatch(vendorId, phrase) : null) ||
        (await topActiveProducts(vendorId, 1))[0] ||
        null;

      if (!product) {
        return withAway({
          reply: `Aucun produit disponible dans ${shopName} pour proposer un deal.`,
          intent: "propose_deal",
          buttons: [{ id: "MENU", title: "See menu" }],
        });
      }

      if (parsed.proposedPrice && parsed.proposedPrice > 0) {
        // User supplied a price in major currency units (e.g. 8000 FCFA -> 800000 cents)
        const proposedTotalCents = Math.round(parsed.proposedPrice * 100);
        const { botReply } = await placeDealOrder({
          vendorId,
          fromPhone,
          product,
          proposedTotalCents,
          currency,
          shopName,
          quantity: parsed.quantity ?? 1,
        });
        return withAway(botReply);
      }

      // No price specified yet -> offer quick deal buttons on the matched product
      const offer10 = Math.round((product.priceCents * 0.9) / 100) * 100;
      const offer15 = Math.round((product.priceCents * 0.85) / 100) * 100;
      return withAway({
        reply:
          `🤝 Vous souhaitez proposer un deal sur "${product.name}" (Prix catalogue : ${formatMoney(product.priceCents, currency)}) !\n\n` +
          `Choisissez une offre ci-dessous ou envoyez directement :\n` +
          `"Deal ${product.name} à ${Math.round((product.priceCents * 0.8) / 100)}"`,
        intent: "propose_deal",
        buttons: [
          {
            id: `DEAL_CREATE:${product.id}:${offer10}:1`,
            title: clampTitle(`🤝 -10% (${formatMoney(offer10, currency)})`),
          },
          {
            id: `DEAL_CREATE:${product.id}:${offer15}:1`,
            title: clampTitle(`🤝 -15% (${formatMoney(offer15, currency)})`),
          },
          { id: "DEAL", title: "Autres produits" },
        ],
      });
    }

    case "track_order": {
      return withAway(
        await trackCustomerOrders(vendorId, fromPhone, shopName, currency, parsed.orderRef),
      );
    }

    case "price_check": {
      const phrase = parsed.productMatches[0] || "";
      const isBroadSearch =
        /cherche|trouve|disponible|en stock|moins de|max|budget|recommand|quel|quoi/i.test(raw);
      const product = !isBroadSearch ? await findBestProductMatch(vendorId, phrase) : null;

      if (!product) {
        const { reply: ai, topProducts } = await tryLlmAnswer({
          vendorId,
          shopName,
          currency,
          question: raw,
          assistantName: waConfig.assistantName,
          deliveryInfo,
          customInstructions: waConfig.customInstructions,
          vendorGeminiKey: waConfig.geminiApiKey,
          aiEnabled: waConfig.aiEnabled,
        });
        const actionButtons: BotButton[] = [];
        const firstInStock = topProducts.find((tp) => tp.id && tp.stock > 0);
        if (firstInStock?.id) {
          actionButtons.push({
            id: `ORDER:${firstInStock.id}`,
            title: clampTitle(`🛒 ${firstInStock.name}`),
          });
          actionButtons.push({
            id: `DEAL_PROMPT:${firstInStock.id}`,
            title: clampTitle(`🤝 Deal ${firstInStock.name}`),
          });
        }
        actionButtons.push({ id: "MENU", title: "See menu" });
        return withAway({
          reply: ai || `Sorry, we couldn't find "${phrase}" in ${shopName}.`,
          intent: parsed.intent,
          buttons: actionButtons.slice(0, 3),
        });
      }
      const stockLine = product.stock > 0 ? `${product.stock} in stock` : `out of stock`;
      const sizesLine = product.sizes ? ` | Tailles: ${product.sizes}` : "";
      return withAway({
        reply: `${product.name} — ${formatMoney(product.priceCents, currency)}. ${stockLine}${sizesLine}.`,
        intent: parsed.intent,
        buttons: [
          { id: `ORDER:${product.id}`, title: "Order this" },
          { id: `DEAL_PROMPT:${product.id}`, title: "🤝 Proposer deal" },
          { id: "MENU", title: "See menu" },
        ],
      });
    }

    case "order": {
      const phrase = parsed.productMatches[0] || "";
      const product = await findBestProductMatch(vendorId, phrase);
      if (!product) {
        const products = await topActiveProducts(vendorId, 3);
        return withAway({
          reply:
            products.length > 0
              ? `We couldn't find "${phrase}" to order. Tap a product below to order directly:`
              : `We couldn't find "${phrase}" to order.`,
          intent: parsed.intent,
          buttons:
            products.length > 0
              ? products.slice(0, 3).map((p) => ({
                  id: `ORDER:${p.id}`,
                  title: clampTitle(p.name),
                }))
              : [{ id: "MENU", title: "See menu" }],
        });
      }
      return withAway(
        await placeOrder(
          vendorId,
          fromPhone,
          product,
          currency,
          shopName,
          "order",
          parsed.quantity ?? 1,
        ),
      );
    }

    case "unpaid": {
      const receivables = await prisma.receivable.findMany({
        where: {
          vendorId,
          status: { in: ["OPEN", "PARTIAL"] },
          OR: [
            { customer: { phone: fromPhone } },
            { order: { customerPhone: fromPhone } },
          ],
        },
        include: { order: true, customer: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      if (receivables.length === 0) {
        return withAway({
          reply: `You have no open balances with ${shopName}. Thanks.`,
          intent: parsed.intent,
          buttons: [
            { id: "MENU", title: "See menu" },
            { id: "TRACK", title: "📦 Suivre commande" },
          ],
        });
      }
      const total = receivables.reduce((s, r) => s + r.amountCents, 0);
      const lines = receivables.map(
        (r) =>
          `• ${formatMoney(r.amountCents, currency)} — ${
            r.note || r.order?.id.slice(-6).toUpperCase() || "balance"
          }`,
      );
      return withAway({
        reply: `Open balance with ${shopName}: ${formatMoney(total, currency)}\n\n${lines.join("\n")}`,
        intent: parsed.intent,
        buttons: [
          { id: "TRACK", title: "📦 Suivre commande" },
          { id: "MENU", title: "See menu" },
        ],
      });
    }

    default: {
      const { reply: ai, topProducts } = await tryLlmAnswer({
        vendorId,
        shopName,
        currency,
        question: raw,
        assistantName: waConfig.assistantName,
        deliveryInfo,
        customInstructions: waConfig.customInstructions,
        vendorGeminiKey: waConfig.geminiApiKey,
        aiEnabled: waConfig.aiEnabled,
      });
      const actionButtons: BotButton[] = [];
      const firstInStock = topProducts.find((tp) => tp.id && tp.stock > 0);
      if (firstInStock?.id) {
        actionButtons.push({
          id: `ORDER:${firstInStock.id}`,
          title: clampTitle(`🛒 ${firstInStock.name}`),
        });
        actionButtons.push({
          id: `DEAL_PROMPT:${firstInStock.id}`,
          title: clampTitle(`🤝 Deal ${firstInStock.name}`),
        });
      }
      actionButtons.push({ id: "MENU", title: "See menu" });
      if (actionButtons.length < 3) {
        actionButtons.push({ id: "TRACK", title: "📦 Suivre commande" });
      }
      return withAway({
        reply: ai || `Sorry, I didn't catch that.`,
        intent: parsed.intent,
        buttons: actionButtons.slice(0, 3),
      });
    }
  }
}

export async function logBotEvent(
  vendorId: string | null,
  from: string,
  intent: BotIntent,
  raw: string,
  responded: boolean,
) {
  try {
    await prisma.botEvent.create({
      data: {
        vendorId: vendorId ?? null,
        from,
        intent,
        raw: raw.slice(0, 2000),
        responded,
      },
    });
  } catch (e) {
    logger.error("bot.log_event_failed", { error: String(e) });
  }
}

/* ----------------------------- Test helpers ------------------------------- */
export const __testing = { levenshtein, tokens, scoreTokens, normalize };
