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
  isMediaAiConfigured,
  generateBotReply,
  matchProductsFromImage,
  reserveLlmCall,
  transcribeAudio,
  type CatalogItem,
  type ChatTurn,
} from "./llm";
import { parseWhatsAppAssistantConfig } from "./whatsapp-config";
import {
  counterMessage,
  decideOffer,
  extractOfferAmount,
  isAcceptance,
  looksLikeBareOffer,
} from "./bargaining";
import {
  HANDOFF_BUTTON_ID,
  activeHandoff,
  noteHandoffMessage,
  resolveHandoff,
  startHandoff,
  wantsAssistantBack,
  wantsHumanSeller,
} from "./handoff";

/** "Voir le catalogue" and "Parler au vendeur" buttons, used in most fallbacks. */
const MENU_BUTTON: BotButton = { id: "MENU", title: "Voir le catalogue" };
const HANDOFF_BUTTON: BotButton = { id: HANDOFF_BUTTON_ID, title: "Parler au vendeur" };

/** A negotiation older than this is forgotten: a bare number is no longer an offer. */
const NEGOTIATION_TTL_MS = 30 * 60 * 1000;

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
  | "handoff"
  | "photo_search"
  | "help"
  | "unknown";

export type ParsedIntent = {
  intent: BotIntent;
  productMatches: string[];
  quantity?: number;
  orderRef?: string;
  proposedPrice?: number;
};

/* ------------------------------- Vocabulary ------------------------------- */

const HELP_QUESTION_WORDS = [
  // French: usage questions must never be treated as purchase commands.
  "comment", "pourquoi", "explique", "expliquer", "aide", "besoin d'aide", "comment faire",
  "comment lancer", "comment passer", "comment utiliser", "comment fonctionne", "c'est quoi",
  "qu'est-ce", "quelle est la procedure", "quelle est la procédure", "est-ce que", "est ce que",
  "puis-je", "peux-je", "je voudrais savoir", "je veux savoir", "je veux connaitre", "je veux connaître",
  // English and common West African phrasing
  "how do i", "how can i", "how to", "how does", "how does it work", "what is",
  "why", "explain", "help me", "i need help", "can i", "could i", "should i",
  "i want to know", "i'd like to know", "i would like to know", "i need to know", "can you tell me",
  "abeg how", "how i go", "how i fit", "wetin i fit",
  "tu reponds", "tu réponds", "vous repondez", "vous répondez", "tout genre de question",
  "toute question", "que peux tu faire", "que peux-tu faire", "quelles questions",
  "what can you do", "what can i ask", "what do you help", "anything you can help",
  // Swahili
  "jinsi", "nawezaje", "kwa nini",
];

const PRODUCT_INFO_WORDS = [
  "size", "sizes", "taille", "tailles", "pointure", "pointures", "dimension", "dimensions",
  "color", "colors", "colour", "colours", "couleur", "couleurs", "matiere", "matieres", "material", "materials",
  "description", "details", "detail", "specification", "specifications", "stock", "available",
  "availability", "disponible", "disponibilite", "en stock", "in stock", "quantite", "quantité",
];

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
  // Market haggling (French)
  "je te donne", "je vous donne", "dernier prix", "fais moi", "faites moi",
  "trop cher", "c'est cher", "diminue", "diminuez", "baisse le prix", "baissez",
];

const PRICE_WORDS = [
  // English
  "price", "cost", "how much", "available", "in stock", "stock",
  "do you have", "you have", "search", "find me", "looking for",
  // Pidgin
  "wetin be di price", "na how much", "price be", "you get",
  // Swahili
  "bei gani", "ngapi", "shilingi ngapi", "iko", "una", "upo",
  // French
  "c'est combien", "combien", "prix", "quel prix", "le prix", "disponible", "vous avez",
  "cherche", "chercher", "trouve", "trouver", "en stock", "recherche",
  ...PRODUCT_INFO_WORDS,
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
  "je veux", "je voudrais", "je commande", "commande", "commander", "acheter", "j'achète",
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

const QUERY_FILLER_WORDS = [
  "comment", "pourquoi", "how do i", "how can i", "how to", "what is", "what are", "what color is",
  "je veux savoir", "je voudrais savoir", "i want to know", "i'd like to know", "i would like to know",
  "i need to know", "connaitre", "connaître", "savoir", "know", "tell me", "can you tell me",
  "please", "est-ce que", "est ce que", "does the", "does it", "do you", "is it", "is there",
  "come in", "what sizes", "what colors", "the", "about",
  "tu connais", "connais", "do you know", "know the size of", "what is the size of",
  "what size is", "what sizes does",
];

const STRIP_INTENT_RE = new RegExp(
  "\\b(" +
    [...ORDER_WORDS, ...PRICE_WORDS, ...PRODUCT_INFO_WORDS, ...MENU_WORDS, ...TRACK_WORDS, ...DEAL_WORDS, ...QUERY_FILLER_WORDS]
      .map((w) => normalizeIntentText(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .sort((a, b) => b.length - a.length)
      .join("|") +
    ")\\b",
  "g",
);

/* --------------------------------- Parser --------------------------------- */

function normalizeIntentText(text: string): string {
  return (text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string {
  return normalizeIntentText(text);
}

function containsAny(text: string, needles: string[]): boolean {
  const normalizedText = normalizeIntentText(text);
  return needles.some((needle) => normalizedText.includes(normalizeIntentText(needle)));
}

function containsAnyWord(text: string, words: string[]): boolean {
  const messageWords = new Set(normalizeIntentText(text).split(/[^a-z0-9]+/).filter(Boolean));
  return words.some((word) => messageWords.has(normalizeIntentText(word)));
}

function isFrenchMessage(text: string): boolean {
  const normalized = normalizeIntentText(text);
  return /[àâçéèêëîïôùûüÿœ]/i.test(text) ||
    /\b(je|tu|vous|juste|concernant|question|questions|reponds|repondez|comment|pourquoi|commander|commande|acheter|taille|prix|catalogue|stock|aide|suivre|proposer|bonjour|tout|toute)\b/.test(normalized);
}

function productInfoLines(
  question: string,
  product: { name: string; sizes: string; description: string },
  french: boolean,
): string[] {
  const asksSize = containsAny(question, [
    "size", "sizes", "taille", "tailles", "pointure", "pointures", "dimension", "dimensions",
  ]);
  const asksOtherDetails = containsAny(question, [
    "color", "colors", "colour", "couleur", "matiere", "material", "description",
    "details", "composition", "fabric", "tissu",
  ]) || containsAnyWord(question, COLOR_WORDS);
  const lines: string[] = [];

  if (asksSize) {
    if (product.sizes.trim()) {
      lines.push(french
        ? `Tailles indiquées pour ${product.name} : ${product.sizes}.`
        : `Sizes listed for ${product.name}: ${product.sizes}.`);
    } else {
      lines.push(french
        ? `La taille de ${product.name} n'est pas précisée dans sa fiche produit. Contactez le vendeur dans cette conversation pour la confirmer avant de commander.`
        : `The size of ${product.name} isn't specified in its product listing. Please contact the seller in this chat to confirm it before ordering.`);
    }
  }

  if (asksOtherDetails) {
    lines.push(product.description.trim()
      ? `${french ? "Détails" : "Details"} : ${product.description.slice(0, 220)}`
      : french
        ? "Ces détails ne sont pas renseignés dans la fiche produit. Demandez confirmation au vendeur dans cette conversation."
        : "Those details aren't listed for this product. Please ask the seller in this chat to confirm them.");
  }
  return lines;
}

function asksOrderProcedure(text: string): boolean {
  return /\b(?:order|ordering|purchase|buy|command|commande|commander|acheter|place (?:an? )?order|make an order|make a purchase|passer commande|lancer une commande|faire une commande|faire un achat)\b/i
    .test(normalizeIntentText(text));
}

/**
 * Whole-word match: short greetings like "ge" or "yo" must not fire inside
 * "rouge" or "moyen".
 */
function containsWord(text: string, needles: string[]): boolean {
  return needles.some((n) => {
    const escaped = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(text);
  });
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

  // Do not treat generic questions as product searches merely because they
  // contain a vague term. A product lookup needs a product signal, or a bare
  // short product-name phrase handled below.
  const asksPriceOrProductInfo =
    containsAny(t, [...PRICE_WORDS, ...PRODUCT_INFO_WORDS]) || containsAnyWord(t, COLOR_WORDS);
  const hasPurchaseOrDealLanguage = containsAny(t, [...ORDER_WORDS, ...DEAL_WORDS]);
  if (asksPriceOrProductInfo && containsAny(t, ORDER_WORDS)) {
    const productQuery = t
      .replace(STRIP_INTENT_RE, " ")
      .replace(/\b(?:mais|dabord|d'abord)\b/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
    const { qty, cleaned } = extractQuantity(productQuery);
    return { intent: "price_check", productMatches: cleaned ? [cleaned] : productQuery ? [productQuery] : [], quantity: qty };
  }

  const negatesPurchaseOrDeal =
    /\b(?:je ne veux pas|je ne souhaite pas|ne veux pas|n'achete pas|n'achète pas|i don't want|i do not want|don't|do not|not|never|no)\b.{0,50}\b(?:order|buy|purchase|commander|commande|acheter|deal|proposer|bargain)\b/i.test(t);
  if (negatesPurchaseOrDeal) return { intent: "help", productMatches: [] };

  const hasQuestionMark = /[?？]/.test(text);
  const shortGreeting = t.replace(/[?!.。]+$/g, "").trim();
  if (GREETINGS.some((greeting) => normalizeIntentText(greeting) === shortGreeting)) {
    return { intent: "greeting", productMatches: [] };
  }
  const asksGeneralQuestion = hasQuestionMark || containsAny(t, HELP_QUESTION_WORDS);
  if (
    asksGeneralQuestion &&
    hasPurchaseOrDealLanguage
  ) {
    return { intent: "help", productMatches: [] };
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
  const asksHowTo = asksGeneralQuestion;
  if (asksHowTo && !asksPriceOrProductInfo) return { intent: "help", productMatches: [] };
  if (containsAny(t, ORDER_WORDS)) return { intent: "order", productMatches, quantity: qty };
  if (containsAny(t, MENU_WORDS)) return { intent: "menu", productMatches };
  if (asksPriceOrProductInfo) return { intent: "price_check", productMatches };
  if (asksHowTo) return { intent: "help", productMatches: [] };

  // Bare greeting only if it's a short hello with nothing else interesting.
  if (containsWord(t, GREETINGS) && t.split(/\s+/).length <= 4) {
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
  "have", "has", "had", "does", "did", "what", "which", "how", "quelle", "quelles", "quel", "quels",
  "connaitre", "connais", "connait", "savoir", "know", "tell", "please", "about", "there", "it", "can", "could", "would",
  "want", "need", "que", "le", "la", "les", "un", "une", "des", "du",
  "de", "au", "aux", "je", "tu", "il", "nous", "vous", "ils", "pour", "sur",
  "dans", "avec", "est", "sont", "avez", "moi", "me", "disponible", "disponibles",
  "boutique", "produit", "produits", "article", "articles", "fcfa", "cfa", "xof",
  // Short French words that matched product names by accident ("et en rouge ?" → "Sac en cuir").
  "et", "en", "ou", "mais", "aussi", "ce", "cet", "cette", "ces", "ca", "si", "plus",
  "elle", "lui", "leur", "par", "ne", "pas", "qui", "quoi", "comment",
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

/**
 * The last messages of this WhatsApp conversation, oldest first, so Gemini
 * understands follow-ups like "et en rouge ?". The current message is dropped.
 */
async function conversationHistory(
  vendorId: string,
  fromPhone: string,
  current: string,
): Promise<ChatTurn[]> {
  const clean = digitsOnly(fromPhone);
  if (!clean) return [];
  const rows = await prisma.whatsAppMessage.findMany({
    where: { vendorId, contact: { in: [...new Set([clean, fromPhone])] } },
    orderBy: { createdAt: "desc" },
    take: 13,
    select: { direction: true, body: true },
  });
  const turns: ChatTurn[] = rows
    .reverse()
    .map((r) => ({
      role: r.direction === "IN" ? ("customer" as const) : ("assistant" as const),
      text: r.body.replace(/^\[interactive\]\s*/, "").slice(0, 600),
    }))
    .filter((t) => t.text.trim());
  const last = turns[turns.length - 1];
  if (last && last.role === "customer" && last.text.trim() === current.trim()) turns.pop();
  return turns.slice(-12);
}

async function tryLlmAnswer(opts: {
  vendorId: string;
  fromPhone?: string;
  shopName: string;
  currency: string;
  question: string;
  assistantName?: string;
  tagline?: string;
  category?: string;
  region?: string;
  bio?: string;
  deliveryInfo?: string;
  customInstructions?: string;
  vendorGeminiKey?: string;
  aiEnabled?: boolean;
}): Promise<{ reply: string | null; topProducts: CatalogItem[] }> {
  if (opts.aiEnabled === false) return { reply: null, topProducts: [] };
  if (!isLlmConfigured(opts.vendorGeminiKey) || opts.question.trim().length < 2) {
    return { reply: null, topProducts: [] };
  }
  if (!(await reserveLlmCall(opts.vendorId))) {
    return { reply: null, topProducts: [] };
  }
  try {
    const catalog = await retrieveForLlm(opts.vendorId, opts.question, opts.currency, 12);
    const history = opts.fromPhone
      ? await conversationHistory(opts.vendorId, opts.fromPhone, opts.question)
      : [];
    const reply = await generateBotReply({
      history,
      shopName: opts.shopName,
      question: opts.question,
      catalog,
      assistantName: opts.assistantName,
      tagline: opts.tagline,
      category: opts.category,
      region: opts.region,
      bio: opts.bio,
      deliveryInfo: opts.deliveryInfo,
      customInstructions: opts.customInstructions,
      vendorGeminiKey: opts.vendorGeminiKey,
    });
    return { reply, topProducts: catalog.slice(0, 3) };
  } catch (e) {
    logger.warn("bot.llm_failed", { vendorId: opts.vendorId, error: String(e) });
    return { reply: null, topProducts: [] };
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

export async function findTrackedOrdersForVendor(
  vendorId: string,
  opts: {
    orderRef?: string;
    phone?: string;
    limit?: number;
    /** WhatsApp bot: the sender's number is verified, so only their own orders are returned. */
    requirePhoneMatch?: boolean;
  },
) {
  if (!vendorId || typeof vendorId !== "string") {
    return [];
  }

  const cleanNeedle = (opts.orderRef || "").replace(/^#/, "").trim().toLowerCase();
  const cleanDigits = digitsOnly(opts.phone || "");
  // A reference is shown to customers as 6 characters (#AB12CD): shorter pieces
  // would let anyone guess other customers' orders.
  const hasValidRef = cleanNeedle.length >= 6;
  const hasValidPhone = cleanDigits.length >= 6;

  // An empty tracking query must never return arbitrary recent orders.
  if (!hasValidRef && !hasValidPhone) {
    return [];
  }
  if (opts.requirePhoneMatch && !hasValidPhone) {
    return [];
  }

  // Strictly enforce tenant ownership boundary: only orders belonging to `vendorId`
  const recentOrders = await prisma.order.findMany({
    where: {
      vendorId,
      deletedAt: null,
    },
    include: { items: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const phoneTail = cleanDigits.length >= 8 ? cleanDigits.slice(-8) : cleanDigits;

  const samePhone = (customerPhone: string | null): boolean => {
    if (!hasValidPhone || !customerPhone) return false;
    const orderDigits = digitsOnly(customerPhone);
    if (orderDigits.length < 6) return false;
    return (
      orderDigits === cleanDigits ||
      (phoneTail.length >= 8 && orderDigits.endsWith(phoneTail)) ||
      (orderDigits.length >= 8 && cleanDigits.endsWith(orderDigits.slice(-8)))
    );
  };

  const sameRef = (id: string): boolean => {
    const idLower = id.toLowerCase();
    return idLower === cleanNeedle || idLower.endsWith(cleanNeedle) || idLower.startsWith(cleanNeedle);
  };

  const matches = recentOrders.filter((o) => {
    if (o.vendorId !== vendorId) return false;
    if (opts.requirePhoneMatch) {
      if (!samePhone(o.customerPhone)) return false;
      return hasValidRef ? sameRef(o.id) : true;
    }
    // Someone may type their phone number in the reference field.
    if (hasValidRef) return sameRef(o.id) || (opts.orderRef === opts.phone && samePhone(o.customerPhone));
    return samePhone(o.customerPhone);
  });

  return matches.slice(0, opts.limit ?? 5);
}

export async function trackCustomerOrders(
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

  // Customer order history is private: on WhatsApp the sender's number is
  // verified, so a reference only filters the sender's own orders.
  const orders = await findTrackedOrdersForVendor(vendorId, {
    orderRef,
    phone: cleanPhone,
    limit: 5,
    requirePhoneMatch: true,
  });

  if (orders.length === 0) {
    return {
      reply:
        `📦 Aucune commande ou proposition de deal active trouvée pour votre numéro (${cleanPhone || fromPhone}) chez ${shopName}.\n\n` +
        `Astuce : Envoyez la référence de votre commande (ex: #LTW4GX), appuyez sur « Voir le catalogue » pour commander, ou "🤝 Proposer deal" pour négocier un prix.`,
      intent: "track_order",
      buttons: [
        MENU_BUTTON,
        { id: "DEAL", title: "🤝 Proposer deal" },
        { id: "BALANCE", title: "Mon solde" },
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
    MENU_BUTTON,
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
      reply: `Désolé, ${product.name} est épuisé pour le moment.`,
      intent,
      buttons: [MENU_BUTTON],
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
      { id: "MENU", title: "Continuer mes achats" },
      { id: "BALANCE", title: "Mon solde" },
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
  /**
   * The assistant already accepted the price (at or above the vendor's secret
   * minimum): the order is confirmed at once, stock and receivable included.
   */
  accepted?: boolean;
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

  const accepted = opts.accepted === true;
  const dealNote =
    `[${accepted ? "DEAL_ACCEPTED" : "DEAL_PENDING"}|orig:${originalTotalCents}|prop:${proposedTotalCents}] ` +
    (accepted
      ? `Marchandage conclu par l'assistant : ${formatMoney(proposedTotalCents, opts.currency)} au lieu de ${formatMoney(originalTotalCents, opts.currency)}`
      : `🤝 Proposition de deal : ${formatMoney(proposedTotalCents, opts.currency)} au lieu de ${formatMoney(originalTotalCents, opts.currency)}`) +
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
        status: accepted ? "CONFIRMED" : "NEW",
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

    if (accepted && opts.product.stock >= qty) {
      await tx.product.update({
        where: { id: opts.product.id },
        data: { stock: { decrement: qty } },
      });
    }

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

  if (accepted) {
    try {
      await createForUnpaidOrder(prisma, opts.vendorId, order.id, {
        amountCents: proposedTotalCents,
        note: "Marchandage conclu par l'assistant WhatsApp",
      });
    } catch (e) {
      logger.warn("bot.receivable_failed", { orderId: order.id, error: String(e) });
    }
    logger.info("bot.deal_auto_accepted", { vendorId: opts.vendorId, orderId: order.id });
    return {
      orderId: order.id,
      refCode,
      botReply: {
        reply:
          `Marché conclu ! ${qty > 1 ? `${qty}× ` : ""}${opts.product.name} pour ${formatMoney(proposedTotalCents, opts.currency)}` +
          `${proposedTotalCents < originalTotalCents ? ` au lieu de ${formatMoney(originalTotalCents, opts.currency)}` : ""}.\n\n` +
          `Référence : #${refCode}\n` +
          `Payer et suivre votre commande : ${payUrl}\n\n` +
          `${opts.shopName} a reçu votre commande dans son tableau de bord.`,
        intent: "propose_deal",
        buttons: [
          { id: `TRACK:${order.id}`, title: "Suivre ma commande" },
          MENU_BUTTON,
        ],
      },
    };
  }

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
      MENU_BUTTON,
    ],
  };

  return { orderId: order.id, refCode, botReply };
}

/* ----------------------------- Automatic bargaining ----------------------------- */

type DealProduct = {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
  preOrderAllowed: boolean;
};

/** The vendor's secret minimum price for a product, or null when not set. */
async function priceFloorOf(productId: string): Promise<number | null> {
  const f = await prisma.productPriceFloor.findUnique({
    where: { productId },
    select: { minPriceCents: true },
  });
  return f?.minPriceCents ?? null;
}

/** The customer's open negotiation in this shop (last 30 minutes), if any. */
async function openNegotiation(vendorId: string, fromPhone: string) {
  const contact = digitsOnly(fromPhone) || fromPhone;
  return prisma.negotiation.findFirst({
    where: { vendorId, contact, updatedAt: { gt: new Date(Date.now() - NEGOTIATION_TTL_MS) } },
    orderBy: { updatedAt: "desc" },
  });
}

type DealContext = {
  vendorId: string;
  fromPhone: string;
  product: DealProduct;
  quantity: number;
  currency: string;
  shopName: string;
};

/**
 * Answer a price offer (total for `quantity` items). With a secret minimum
 * price the assistant decides alone: it accepts at or above the minimum and
 * counter-offers below it. Without one, the offer goes to the vendor.
 */
async function negotiate(ctx: DealContext, offerTotalCents: number): Promise<BotReply> {
  const qty = Math.max(1, ctx.quantity);
  const { vendorId, fromPhone, product, currency, shopName } = ctx;
  const floor = await priceFloorOf(product.id);
  if (floor === null) {
    const { botReply } = await placeDealOrder({
      vendorId,
      fromPhone,
      product,
      proposedTotalCents: offerTotalCents,
      currency,
      shopName,
      quantity: qty,
    });
    return botReply;
  }
  if (product.stock < qty && !product.preOrderAllowed) {
    return {
      reply:
        product.stock > 0
          ? `Il ne reste que ${product.stock} ${product.name} pour le moment.`
          : `Désolé, ${product.name} est épuisé pour le moment.`,
      intent: "propose_deal",
      buttons: [MENU_BUTTON, HANDOFF_BUTTON],
    };
  }

  const contact = digitsOnly(fromPhone) || fromPhone;
  const key = { vendorId, contact, productId: product.id };
  const existing = await prisma.negotiation.findUnique({ where: { vendorId_contact_productId: key } });
  const fresh =
    existing && existing.quantity === qty && existing.updatedAt.getTime() > Date.now() - NEGOTIATION_TTL_MS;
  const decision = decideOffer({
    priceCents: product.priceCents,
    floorCents: floor,
    offerCents: Math.round(offerTotalCents / qty),
    round: fresh ? existing.round : 0,
    lastCounterCents: fresh ? existing.lastCounterCents : 0,
    currency,
  });

  if (decision.kind === "accept") {
    await prisma.negotiation.deleteMany({ where: key });
    const { botReply } = await placeDealOrder({
      vendorId,
      fromPhone,
      product,
      proposedTotalCents: decision.unitCents * qty,
      currency,
      shopName,
      quantity: qty,
      accepted: true,
    });
    return botReply;
  }

  await prisma.negotiation.upsert({
    where: { vendorId_contact_productId: key },
    create: { ...key, quantity: qty, round: decision.round, lastCounterCents: decision.unitCents },
    update: { quantity: qty, round: decision.round, lastCounterCents: decision.unitCents },
  });
  const counterTotal = decision.unitCents * qty;
  return {
    reply: counterMessage({
      productName: qty > 1 ? `${qty} ${product.name}` : product.name,
      offerLabel: formatMoney(offerTotalCents, currency),
      counterLabel: formatMoney(counterTotal, currency),
      round: decision.round,
      final: decision.final,
    }),
    intent: "propose_deal",
    buttons: [
      {
        id: `DEAL_ACCEPT:${product.id}:${decision.unitCents}:${qty}`,
        title: clampTitle(`OK pour ${formatMoney(counterTotal, currency)}`),
      },
      { id: `ORDER:${product.id}:${qty}`, title: "Prix affiché" },
      HANDOFF_BUTTON,
    ],
  };
}

/**
 * The customer accepts a unit price (button or "ok"). Checked again against
 * the minimum: a forged or stale button can never sell below it.
 */
async function acceptPrice(ctx: DealContext, unitCents: number): Promise<BotReply> {
  const qty = Math.max(1, ctx.quantity);
  const floor = await priceFloorOf(ctx.product.id);
  if (floor === null || unitCents < floor) return negotiate(ctx, unitCents * qty);
  return negotiate(ctx, Math.min(unitCents, ctx.product.priceCents) * qty);
}

/* ------------------------------- Hand-off ------------------------------- */

/**
 * Hand-off gate shared by text and photos: while the vendor answers this
 * customer the assistant stays silent (empty reply); "assistant" brings it
 * back; "je veux parler au vendeur" opens a hand-off. Null = carry on.
 */
async function handoffGate(
  vendorId: string,
  fromPhone: string,
  raw: string,
  shopName: string,
): Promise<BotReply | null> {
  const handoff = await activeHandoff(vendorId, fromPhone);
  if (handoff) {
    if (wantsAssistantBack(raw)) {
      await resolveHandoff(vendorId, fromPhone);
      return {
        reply: `L'assistant de ${shopName} est de retour. Que puis-je faire pour vous ?`,
        intent: "greeting",
        buttons: [MENU_BUTTON, { id: "DEAL", title: "Proposer un prix" }, { id: "TRACK", title: "Suivre commande" }],
      };
    }
    await noteHandoffMessage(handoff.id, raw);
    return { reply: "", intent: "handoff" };
  }
  if (wantsHumanSeller(raw)) {
    const pressedButton = raw.trim().toUpperCase() === HANDOFF_BUTTON_ID;
    await startHandoff({
      vendorId,
      contact: fromPhone,
      reason: pressedButton ? "bouton Parler au vendeur" : "demande du client",
      lastMessage: pressedButton ? "(a touché « Parler au vendeur »)" : raw,
    });
    return {
      reply:
        `D'accord, j'ai prévenu ${shopName}. Le vendeur va vous répondre ici dès que possible.\n\n` +
        `Pour revenir à l'assistant, écrivez « assistant ».`,
      intent: "handoff",
    };
  }
  return null;
}

/* ------------------------------- Voice notes ------------------------------- */

/**
 * Turn a customer's voice note into text with Gemini (the shop's key or the
 * server's), within the shop's daily AI quota. Null when it cannot be heard.
 */
export async function transcribeVoiceNote(
  vendorId: string,
  media: { data: Buffer; mimeType: string } | null,
): Promise<string | null> {
  if (!media) return null;
  const vendor = await prisma.vendor.findUnique({ where: { id: vendorId }, select: { uiPrefs: true } });
  const waConfig = parseWhatsAppAssistantConfig(vendor?.uiPrefs);
  if (waConfig.aiEnabled === false || !isMediaAiConfigured(waConfig.geminiApiKey)) return null;
  if (!(await reserveLlmCall(vendorId))) return null;
  try {
    return await transcribeAudio({ data: media.data, mimeType: media.mimeType, vendorGeminiKey: waConfig.geminiApiKey });
  } catch (e) {
    logger.warn("bot.voice_transcription_failed", { vendorId, error: String(e) });
    return null;
  }
}

/** Reply when a voice note cannot be transcribed. */
export function voiceNotHeardReply(): BotReply {
  return {
    reply:
      "Je n'arrive pas à écouter votre message vocal pour le moment. " +
      "Pouvez-vous l'écrire, ou demander directement au vendeur ?",
    intent: "unknown",
    buttons: [MENU_BUTTON, HANDOFF_BUTTON],
  };
}

/* ------------------------------- Photo search ------------------------------- */

/**
 * The customer sent a photo: find similar products in this shop's catalog
 * with Gemini vision. `media` is null when the photo could not be downloaded.
 */
export async function respondToPhoto(
  vendorId: string,
  fromPhone: string,
  media: { data: Buffer; mimeType: string } | null,
  caption = "",
): Promise<BotReply> {
  const vendor = await prisma.vendor.findUnique({
    where: { id: vendorId },
    select: { shopName: true, currency: true, uiPrefs: true },
  });
  const shopName = vendor?.shopName || "la boutique";
  const currency = vendor?.currency || "XOF";
  const waConfig = parseWhatsAppAssistantConfig(vendor?.uiPrefs);

  const gate = await handoffGate(vendorId, fromPhone, caption || "(photo)", shopName);
  if (gate) return gate;

  const cannotSee: BotReply = {
    reply:
      `Merci pour la photo ! Je ne peux pas l'analyser pour le moment. ` +
      `Décrivez-moi l'article (type, couleur, taille), ou demandez directement au vendeur.`,
    intent: "photo_search",
    buttons: [MENU_BUTTON, HANDOFF_BUTTON],
  };
  if (!media || waConfig.aiEnabled === false || !isMediaAiConfigured(waConfig.geminiApiKey)) return cannotSee;
  if (!(await reserveLlmCall(vendorId))) return cannotSee;

  const products = await prisma.product.findMany({
    where: { vendorId, isActive: true },
    orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
    take: 150,
    select: { id: true, name: true, description: true, priceCents: true, stock: true },
  });
  const match = await matchProductsFromImage({
    data: media.data,
    mimeType: media.mimeType,
    caption,
    catalog: products,
    vendorGeminiKey: waConfig.geminiApiKey,
  });
  if (!match) return cannotSee;

  const found = match.productIds
    .map((id) => products.find((p) => p.id === id))
    .filter((p): p is (typeof products)[number] => Boolean(p));
  const seen = match.description ? ` (${match.description})` : "";
  if (found.length === 0) {
    return {
      reply:
        `Je n'ai pas cet article${seen} chez ${shopName}. ` +
        `Vous pouvez voir le catalogue, ou demander au vendeur s'il peut en trouver.`,
      intent: "photo_search",
      buttons: [MENU_BUTTON, HANDOFF_BUTTON],
    };
  }
  const lines = found.map(
    (p, i) =>
      `${i + 1}. ${p.name} — ${formatMoney(p.priceCents, currency)}${p.stock > 0 ? ` (${p.stock} disponibles)` : " (épuisé)"}`,
  );
  const top = found[0];
  return {
    reply: `Voici ce qui ressemble à votre photo${seen} :\n\n${lines.join("\n")}`,
    intent: "photo_search",
    buttons: [
      { id: `ORDER:${top.id}`, title: clampTitle(`Commander ${top.name}`) },
      { id: `DEAL_PROMPT:${top.id}`, title: "Proposer un prix" },
      HANDOFF_BUTTON,
    ],
  };
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
      tagline: true,
      category: true,
      region: true,
      bio: true,
      awayMessage: true,
      businessHours: true,
      tzOffsetMinutes: true,
      deliveryEnabled: true,
      deliveryFeeCents: true,
      deliveryZones: true,
      uiPrefs: true,
    },
  });
  const currency = vendor?.currency || "XOF";
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
    const p = await prisma.product.findFirst({
      where: { id, vendorId, isActive: true },
    });
    return p;
  }

  const gate = await handoffGate(vendorId, fromPhone, raw, shopName);
  if (gate) return gate.reply ? withAway(gate) : gate;

  // Button fast-path: DEAL_ACCEPT:<productId>:<unitPriceCents>:<qty> (counter-offer accepted)
  if (/^DEAL_ACCEPT:/i.test(raw)) {
    const parts = raw.split(":");
    const product = await findProductForButton((parts[1] || "").trim());
    const unitCents = parseInt(parts[2] || "0", 10);
    const qty = Math.max(1, parseInt(parts[3] || "1", 10) || 1);
    if (product && unitCents > 0) {
      return withAway(
        await acceptPrice({ vendorId, fromPhone, product, quantity: qty, currency, shopName }, unitCents),
      );
    }
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
      return withAway(
        await negotiate({ vendorId, fromPhone, product, quantity: qty, currency, shopName }, proposedCents),
      );
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
      where: { id: orderId, vendorId, deletedAt: null },
      include: { items: true },
    });
    if (!order) {
      return withAway({
        reply: `Commande introuvable.`,
        intent: "track_order",
        buttons: [MENU_BUTTON],
      });
    }
    const orderPhone = digitsOnly(order.customerPhone || "");
    const senderPhone = digitsOnly(fromPhone);
    if (!orderPhone || !senderPhone || orderPhone !== senderPhone) {
      return withAway({
        reply: `Pour protéger votre commande, envoyez votre demande depuis le numéro utilisé lors de l'achat.`,
        intent: "track_order",
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
      buttons: [MENU_BUTTON],
    });
  }

  // Bargaining follow-up: a bare amount is a new offer, "ok" accepts the last counter-offer.
  const nego = await openNegotiation(vendorId, fromPhone);
  if (nego) {
    const product = await prisma.product.findFirst({
      where: { id: nego.productId, vendorId, isActive: true },
    });
    if (product) {
      const ctx = { vendorId, fromPhone, product, quantity: nego.quantity, currency, shopName };
      if (looksLikeBareOffer(raw)) {
        const amount = extractOfferAmount(raw);
        if (amount) return withAway(await negotiate(ctx, Math.round(amount * 100)));
      }
      if (isAcceptance(raw) && nego.lastCounterCents > 0) {
        return withAway(await acceptPrice(ctx, nego.lastCounterCents));
      }
    }
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
          MENU_BUTTON,
          { id: "DEAL", title: "🤝 Proposer deal" },
          { id: "TRACK", title: "📦 Suivre commande" },
        ],
      });
    }

    case "menu": {
      const products = await topActiveProducts(vendorId, 8);
      if (products.length === 0) {
        return withAway({
          reply: isFrenchMessage(raw)
            ? `${shopName} n'a pas encore ajouté de produits à son catalogue. Contactez le vendeur pour connaître les articles disponibles.`
            : `${shopName} hasn't added products to its catalog yet. Contact the seller to ask what is available.`,
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
          `🛍️ ${isFrenchMessage(raw) ? `Catalogue de ${shopName} — articles disponibles` : `${shopName} catalog — available items`} :\n\n${lines.join("\n")}\n\n` +
          (isFrenchMessage(raw)
            ? `Appuyez sur un article pour le commander, ou choisissez « Proposer deal » pour faire une offre.`
            : `Tap an item to order, or choose “Propose deal” to make an offer.`),
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
          buttons: [MENU_BUTTON],
        });
      }

      if (parsed.proposedPrice && parsed.proposedPrice > 0) {
        // User supplied a price in major currency units (e.g. 8000 FCFA -> 800000 cents)
        const proposedTotalCents = Math.round(parsed.proposedPrice * 100);
        return withAway(
          await negotiate(
            { vendorId, fromPhone, product, quantity: parsed.quantity ?? 1, currency, shopName },
            proposedTotalCents,
          ),
        );
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
        /moins de|max|budget|recommand|under|below|cheapest|best|recommend/i.test(normalizeIntentText(raw));
      const product = !isBroadSearch ? await findBestProductMatch(vendorId, phrase) : null;

      if (!product) {
        const { reply: ai, topProducts } = await tryLlmAnswer({
          vendorId,
          fromPhone,
          shopName,
          currency,
          question: raw,
          assistantName: waConfig.assistantName,
          tagline: vendor?.tagline,
          category: vendor?.category,
          region: vendor?.region,
          bio: vendor?.bio,
          deliveryInfo,
          customInstructions: waConfig.customInstructions,
          vendorGeminiKey: waConfig.geminiApiKey,
          aiEnabled: waConfig.aiEnabled,
        });
        const frenchMessage = isFrenchMessage(raw);
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
        actionButtons.push(topProducts.length > 0 ? MENU_BUTTON : HANDOFF_BUTTON);
        if (topProducts.length === 0) actionButtons.unshift(MENU_BUTTON);
        return withAway({
          reply:
            ai ||
            (frenchMessage
              ? `Je n'ai pas trouvé « ${phrase} » chez ${shopName}. Envoyez le nom exact du produit, regardez le catalogue, ou demandez directement au vendeur.`
              : `I couldn't find "${phrase}" at ${shopName}. Send the exact product name, look at the catalog, or ask the seller directly.`),
          intent: parsed.intent,
          buttons: [{ id: "MENU", title: frenchMessage ? "Voir catalogue" : "See menu" }],
        });
      }
      const frenchMessage = isFrenchMessage(raw);
      const asksSize = containsAny(raw, [
        "size", "sizes", "taille", "tailles", "pointure", "pointures", "dimension", "dimensions",
      ]);
      const stockLine = frenchMessage
        ? product.stock > 0
          ? `${product.stock} en stock`
          : "indisponible"
        : product.stock > 0
          ? `${product.stock} in stock`
          : "out of stock";
      const sizesLine = product.sizes && !asksSize
        ? ` | ${frenchMessage ? "Tailles" : "Sizes"}: ${product.sizes}`
        : "";
      const detailsLines = productInfoLines(raw, product, frenchMessage);
      return withAway({
        reply: `${product.name} — ${formatMoney(product.priceCents, currency)}. ${stockLine}${sizesLine}.${detailsLines.length ? ` ${detailsLines.join(" ")}` : ""}`,
        intent: parsed.intent,
        buttons: asksSize && !product.sizes.trim()
          ? [{ id: "MENU", title: frenchMessage ? "Voir catalogue" : "See menu" }]
          : [
              { id: `ORDER:${product.id}`, title: frenchMessage ? "Commander" : "Order this" },
              { id: `DEAL_PROMPT:${product.id}`, title: frenchMessage ? "🤝 Proposer deal" : "🤝 Propose deal" },
              { id: "MENU", title: frenchMessage ? "Voir catalogue" : "See menu" },
            ],
      });
    }

    case "order": {
      const phrase = parsed.productMatches[0] || "";
      const product = await findBestProductMatch(vendorId, phrase);
      if (!product) {
        const frenchMessage = isFrenchMessage(raw);
        const products = await topActiveProducts(vendorId, 3);
        return withAway({
          reply: frenchMessage
            ? `Je n'ai pas reconnu l'article « ${phrase} ». Aucune commande n'a été créée.` +
              (products.length > 0 ? ` Touchez un produit ci-dessous pour le commander :` : ` Demandez le catalogue ou envoyez le nom exact d'un produit disponible.`)
            : `I couldn't identify "${phrase}". No order was created.` +
              (products.length > 0 ? ` Tap a product below to order it:` : ` Ask for the catalog or send the exact name of an available product.`),
          intent: parsed.intent,
          buttons:
            products.length > 0
              ? products.slice(0, 3).map((p) => ({
                  id: `ORDER:${p.id}`,
                  title: clampTitle(p.name),
                }))
              : [{ id: "MENU", title: frenchMessage ? "Voir catalogue" : "See menu" }],
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

    case "help": {
      const asksAssistantScope = /\b(?:tu reponds|vous repondez|toute? question|tout genre de question|quelles questions|que peux.?tu faire|what can you do|what can i ask|do you answer everything|any question)\b/i.test(normalizeIntentText(raw));
      const { reply: ai } = await tryLlmAnswer({
        vendorId,
        shopName,
        currency,
        question: raw,
        assistantName: waConfig.assistantName,
        tagline: vendor?.tagline,
        category: vendor?.category,
        region: vendor?.region,
        bio: vendor?.bio,
        deliveryInfo,
        customInstructions: waConfig.customInstructions,
        vendorGeminiKey: waConfig.geminiApiKey,
        aiEnabled: waConfig.aiEnabled,
      });
      const frenchQuestion = isFrenchMessage(raw);
      const asksOrderHelp = asksOrderProcedure(raw);
      const asksDealHelp = /\b(deal|negocier|négocier|remise|reduction|réduction)\b/i.test(raw);
      const negatesAction = /\b(?:je ne veux pas|je ne souhaite pas|ne veux pas|n'achete pas|n'achète pas|i don't want|i do not want|don't|do not|not|never|no)\b.{0,50}\b(?:order|buy|purchase|commander|commande|acheter|deal|proposer|bargain)\b/i.test(raw);
      let fallback: string;
      if (asksAssistantScope) {
        fallback = frenchQuestion
          ? `Je suis spécialisé dans l'aide sur Japora et votre boutique : consulter le catalogue, vérifier les informations enregistrées sur les produits, demander une commande, proposer un deal et suivre une commande depuis le numéro utilisé. Je peux aussi répondre aux questions générales liées au commerce. Pour un sujet sans rapport ou une information privée que je ne peux pas vérifier, je vous le dirai clairement.`
          : `I'm focused on Japora and your shop: browsing the catalog, checking product information on file, requesting an order, proposing a deal, and tracking an order from the number used to place it. I can also help with general commerce questions. If a topic is unrelated or private information cannot be verified, I'll say so clearly.`;
      } else if (negatesAction) {
        fallback = frenchQuestion
          ? `Compris : je n'ai créé ni commande ni deal. Vous pouvez consulter le catalogue ou me poser une question sur un article.`
          : `Understood: I haven't created an order or deal. You can browse the catalog or ask me about a product.`;
      } else if (asksOrderHelp) {
        fallback = frenchQuestion
          ? `Pour passer commande : 1) appuyez sur « Voir catalogue » ; 2) choisissez un article ou demandez son prix ; 3) appuyez sur « Commander » sous l'article. La commande sera enregistrée et transmise au vendeur pour confirmation. Vous recevrez sa référence et un lien de suivi et de paiement.`
          : `To place an order: 1) tap “See menu”; 2) choose a product or ask for its price; 3) tap “Order this” below that product. The order is recorded and sent to the seller for confirmation. You'll receive an order reference and a tracking and payment link.`;
      } else if (asksDealHelp) {
        fallback = frenchQuestion
          ? `Pour proposer un deal, choisissez un article du catalogue, appuyez sur « Proposer un deal », puis sélectionnez une offre ou indiquez votre prix. Le vendeur doit accepter le deal avant qu'il soit confirmé.`
          : `To propose a deal, choose a catalog item, tap “Propose a deal,” then select an offer or enter your price. The seller must accept the offer before it is confirmed.`;
      } else {
        fallback = frenchQuestion
          ? `Je peux vous aider à consulter le catalogue, vérifier les prix, stocks et tailles indiqués, commander, suivre une commande ou proposer un deal. Pour votre question sur Japora, précisez l'étape concernée ; je ne veux pas inventer une règle sur le compte ou le paiement.`
          : `I can help browse the catalog, check listed prices, stock and sizes, place or track an order, or propose a deal. Please specify the Japora step you mean; I won't guess about account or payment rules.`;
      }
      return withAway({
        // Scope questions have a deterministic answer so they remain useful
        // even when the optional AI provider is disabled or unavailable.
        reply: asksAssistantScope || (asksOrderHelp && !negatesAction) ? fallback : ai || fallback,
        intent: parsed.intent,
        buttons: [
          { id: "MENU", title: frenchQuestion ? "Voir catalogue" : "See menu" },
          { id: "TRACK", title: frenchQuestion ? "Suivre commande" : "Track order" },
          { id: "DEAL", title: frenchQuestion ? "Proposer un deal" : "Propose a deal" },
        ],
      });
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
          reply: `Vous n'avez aucun montant à payer chez ${shopName}. Merci !`,
          intent: parsed.intent,
          buttons: [
            MENU_BUTTON,
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
        reply: `Reste à payer chez ${shopName} : ${formatMoney(total, currency)}\n\n${lines.join("\n")}`,
        intent: parsed.intent,
        buttons: [
          { id: "TRACK", title: "📦 Suivre commande" },
          MENU_BUTTON,
        ],
      });
    }

    default: {
      const { reply: ai, topProducts } = await tryLlmAnswer({
        vendorId,
        fromPhone,
        shopName,
        currency,
        question: raw,
        assistantName: waConfig.assistantName,
        tagline: vendor?.tagline,
        category: vendor?.category,
        region: vendor?.region,
        bio: vendor?.bio,
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
      actionButtons.push(MENU_BUTTON);
      if (actionButtons.length < 3) {
        actionButtons.push(ai ? { id: "TRACK", title: "📦 Suivre commande" } : HANDOFF_BUTTON);
      }
      return withAway({
        reply: ai || (isFrenchMessage(raw)
          ? `Je n'ai pas bien compris votre demande. Je peux vous aider avec le catalogue, les informations disponibles sur les produits, les commandes, les deals et leur suivi. Reformulez votre question ou choisissez une action ci-dessous.`
          : `I didn't understand that request. I can help with the catalog, listed product information, orders, deals, and order tracking. Please rephrase or choose an action below.`),
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
export const __testing = { levenshtein, tokens, scoreTokens, normalize, asksOrderProcedure, productInfoLines };
