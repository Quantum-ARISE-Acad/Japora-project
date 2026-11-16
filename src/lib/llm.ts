/**
 * Japora LLM bot upgrade — an optional answer layer on top of the keyword bot.
 *
 * The keyword bot (src/lib/bot.ts) stays authoritative for the money-moving
 * intents (price, order, balance, menu, track, deal) — those must be exact. This
 * module handles the long tail: open questions like "do you deliver to Kara?",
 * "is the blue one cotton?", "what do you recommend for a wedding?", or searching
 * for available products matching specific criteria.
 *
 * Supports:
 * - Google Gemini (GEMINI_API_KEY / NEXT_PUBLIC_GEMINI_API_KEY / per-vendor key)
 * - Anthropic (ANTHROPIC_API_KEY)
 * - OpenAI (OPENAI_API_KEY)
 */

import { logger } from "./logger";
import { prisma } from "./db";

export type CatalogItem = {
  id?: string;
  name: string;
  priceLabel: string;
  stock: number;
  sizes?: string;
  description?: string;
};

/** One earlier message of the WhatsApp conversation, oldest first. */
export type ChatTurn = { role: "customer" | "assistant"; text: string };

/**
 * Normalize a conversation for chat APIs: merge consecutive turns of the same
 * speaker, start with the customer, keep the last `max` turns.
 */
export function normalizeHistory(history: ChatTurn[] = [], max = 10): ChatTurn[] {
  const merged: ChatTurn[] = [];
  for (const t of history) {
    const text = (t.text || "").trim();
    if (!text) continue;
    const last = merged[merged.length - 1];
    if (last && last.role === t.role) last.text = `${last.text}\n${text}`;
    else merged.push({ role: t.role, text });
  }
  let out = merged.slice(-max);
  while (out.length > 0 && out[0].role !== "customer") out = out.slice(1);
  // The current question is sent after the history as a customer turn.
  if (out.length > 0 && out[out.length - 1].role === "customer") out = out.slice(0, -1);
  return out;
}

/** Gemini key: the vendor's own, else the server's. */
function geminiKey(vendorGeminiKey?: string): string | undefined {
  return vendorGeminiKey || process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || undefined;
}

/** Audio, photos: Gemini only (it reads both). */
export function isMediaAiConfigured(vendorGeminiKey?: string): boolean {
  return Boolean(geminiKey(vendorGeminiKey));
}

export function isLlmConfigured(vendorGeminiKey?: string): boolean {
  return Boolean(
    vendorGeminiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      process.env.OPENAI_API_KEY,
  );
}

/** Per-vendor daily cap on LLM calls (cost guardrail). Env-tunable. */
export function llmDailyCap(): number {
  const n = Number(process.env.JAPORA_LLM_DAILY_CAP_PER_VENDOR);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 200;
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}

/**
 * Atomically reserve one LLM call for a vendor today. Returns false (and does
 * NOT consume budget) once the daily cap is reached, so the caller falls back
 * to the keyword bot.
 */
export async function reserveLlmCall(vendorId: string): Promise<boolean> {
  const day = utcDay();
  const cap = llmDailyCap();
  try {
    const existing = await prisma.llmUsage.findUnique({
      where: { vendorId_day: { vendorId, day } },
      select: { count: true },
    });
    if (existing && existing.count >= cap) {
      logger.warn("llm.cap_reached", { vendorId, day, cap });
      return false;
    }
    await prisma.llmUsage.upsert({
      where: { vendorId_day: { vendorId, day } },
      create: { vendorId, day, count: 1 },
      update: { count: { increment: 1 } },
    });
    return true;
  } catch (e) {
    logger.warn("llm.reserve_failed", { vendorId, error: String(e) });
    return false;
  }
}

/** Which backend we'd use (for diagnostics / the bot status pill). */
export function llmProviderName(
  vendorGeminiKey?: string,
): "gemini" | "anthropic" | "openai" | "none" {
  if (vendorGeminiKey) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY) return "gemini";
  return "none";
}

/** Render the retrieved catalog as a compact, grounded context block. */
export function formatCatalogForPrompt(items: CatalogItem[]): string {
  if (items.length === 0) return "(no products listed yet)";
  return items
    .map((p) => {
      const stock = p.stock > 0 ? `${p.stock} in stock` : "out of stock";
      const sizes = p.sizes ? ` [Tailles: ${p.sizes}]` : "";
      const desc = p.description ? ` — ${p.description.slice(0, 140)}` : "";
      return `- ${p.name}: ${p.priceLabel}, ${stock}${sizes}${desc}`;
    })
    .join("\n");
}

export function buildSystemPrompt(
  shopName: string,
  extra?: {
    assistantName?: string;
    deliveryInfo?: string;
    customInstructions?: string;
  },
): string {
  const assistantLabel = extra?.assistantName
    ? `"${extra.assistantName}" (assistant WhatsApp de "${shopName}")`
    : `the friendly WhatsApp shop assistant for "${shopName}"`;

  const lines = [
    `You are ${assistantLabel}, a vendor selling on Japora.`,
    `Answer the customer's question using ONLY the catalog and shop rules provided.`,
    `Rules:`,
    `- Never invent prices, stock, products, or delivery promises. If the catalog doesn't say, tell them to ask the seller directly.`,
    `- Keep it to 1-4 short sentences. Warm, concrete, no fluff.`,
    `- Reply in the same language the customer used (French, English, Pidgin, Ewe, etc.).`,
    `- When the customer asks to search or find available products, list the matching in-stock items with their exact price and available stock.`,
    `- If they want to buy, tell them to tap the "🛒 Commander" button below or send "Commander [Nom du produit]".`,
    `- If they want to negotiate or propose a deal/discount, tell them they can tap "🤝 Proposer un deal" or send "Deal [Nom du produit] à [Prix proposé]" and the seller will validate it in their dashboard.`,
    `- If they want to track an order, tell them to tap "📦 Suivre commande" or send their order reference (#XXXXXX).`,
    `- Prices are already formatted; quote them exactly as written.`,
    `- Use the earlier messages of the conversation to understand short follow-ups ("et en rouge ?", "et la taille M ?", "combien pour deux ?").`,
    `- Never reveal or hint at a minimum price; the seller's bargaining rules are handled separately.`,
    `- If you are not sure which language to use, answer in French.`,
  ];

  if (extra?.deliveryInfo) {
    lines.push(`Delivery info: ${extra.deliveryInfo}`);
  }
  if (extra?.customInstructions) {
    lines.push(`Vendor instructions: ${extra.customInstructions}`);
  }

  return lines.join("\n");
}

const TIMEOUT_MS = 9000;

type GeminiPart = { text: string } | { inline_data: { mime_type: string; data: string } };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

/** Calls Gemini with a fallback model list; returns the text answer or null. */
async function geminiGenerate(
  body: {
    system?: string;
    contents: GeminiContent[];
    temperature?: number;
    maxOutputTokens?: number;
    json?: boolean;
  },
  vendorGeminiKey?: string,
  timeoutMs = TIMEOUT_MS,
): Promise<string | null> {
  const key = geminiKey(vendorGeminiKey);
  if (!key) return null;

  const candidateModels = [
    process.env.JAPORA_LLM_MODEL,
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ].filter((m): m is string => Boolean(m && m.trim()));

  for (const modelName of candidateModels) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(body.system ? { systemInstruction: { parts: [{ text: body.system }] } } : {}),
          contents: body.contents,
          generationConfig: {
            temperature: body.temperature ?? 0.6,
            maxOutputTokens: body.maxOutputTokens ?? 380,
            ...(body.json ? { responseMimeType: "application/json" } : {}),
          },
        }),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        continue;
      }
      const data = (await res.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = data.candidates?.[0]?.content?.parts
        ?.map((p) => p.text || "")
        .join("")
        .trim();
      if (text) return text;
    } catch (e) {
      logger.warn("llm.gemini_failed", { model: modelName, error: String(e) });
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function callGemini(
  system: string,
  user: string,
  vendorGeminiKey?: string,
  history: ChatTurn[] = [],
): Promise<string | null> {
  const contents: GeminiContent[] = [
    ...history.map((t) => ({
      role: (t.role === "customer" ? "user" : "model") as "user" | "model",
      parts: [{ text: t.text.slice(0, 600) }],
    })),
    { role: "user", parts: [{ text: user }] },
  ];
  return geminiGenerate({ system, contents }, vendorGeminiKey);
}

function chatMessages(history: ChatTurn[], user: string) {
  return [
    ...history.map((t) => ({
      role: t.role === "customer" ? ("user" as const) : ("assistant" as const),
      content: t.text.slice(0, 600),
    })),
    { role: "user" as const, content: user },
  ];
}

async function callAnthropic(
  system: string,
  user: string,
  history: ChatTurn[] = [],
): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  const model = process.env.JAPORA_LLM_MODEL || "claude-3-5-haiku-latest";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        system,
        messages: chatMessages(history, user),
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      logger.warn("llm.anthropic_error", { status: res.status });
      return null;
    }
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    return text || null;
  } catch (e) {
    logger.warn("llm.anthropic_failed", { error: String(e) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(
  system: string,
  user: string,
  history: ChatTurn[] = [],
): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const model = process.env.JAPORA_LLM_MODEL || "gpt-4o-mini";
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        messages: [{ role: "system", content: system }, ...chatMessages(history, user)],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      logger.warn("llm.openai_error", { status: res.status });
      return null;
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = data.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch (e) {
    logger.warn("llm.openai_failed", { error: String(e) });
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generate a grounded answer to an open-ended customer question. Returns null
 * if no provider is configured or the call fails — the caller MUST fall back to
 * the keyword bot in that case.
 */
export async function generateBotReply(opts: {
  shopName: string;
  question: string;
  catalog: CatalogItem[];
  assistantName?: string;
  deliveryInfo?: string;
  customInstructions?: string;
  vendorGeminiKey?: string;
  /** Earlier messages of this WhatsApp conversation, oldest first. */
  history?: ChatTurn[];
}): Promise<string | null> {
  if (!isLlmConfigured(opts.vendorGeminiKey)) return null;
  const history = normalizeHistory(opts.history);
  const system = buildSystemPrompt(opts.shopName, {
    assistantName: opts.assistantName,
    deliveryInfo: opts.deliveryInfo,
    customInstructions: opts.customInstructions,
  });
  const user = [
    `Catalog:`,
    formatCatalogForPrompt(opts.catalog),
    ``,
    `Customer: ${opts.question.slice(0, 500)}`,
  ].join("\n");

  const provider = llmProviderName(opts.vendorGeminiKey);
  let answer: string | null = null;
  if (provider === "gemini") {
    answer = await callGemini(system, user, opts.vendorGeminiKey, history);
  } else if (provider === "anthropic") {
    answer = await callAnthropic(system, user, history);
  } else if (provider === "openai") {
    answer = await callOpenAI(system, user, history);
  }

  // Fallback to Gemini if primary failed and Gemini key is available
  if (!answer && provider !== "gemini") {
    answer = await callGemini(system, user, opts.vendorGeminiKey, history);
  }

  if (answer) logger.info("llm.reply", { provider, shopName: opts.shopName });
  return answer;
}

/**
 * Transcribe a WhatsApp voice note (any language the customer speaks) with
 * Gemini. Returns the words only, or null when Gemini is unavailable.
 */
export async function transcribeAudio(opts: {
  data: Buffer;
  mimeType: string;
  vendorGeminiKey?: string;
}): Promise<string | null> {
  const text = await geminiGenerate(
    {
      system:
        "You transcribe WhatsApp voice notes sent by customers of a small shop in West Africa. " +
        "Write exactly what the customer says, in the language they speak (French, English, Pidgin, Ewe, Mina...). " +
        "Output only the transcription, without quotes or comments. If nothing is understandable, output nothing.",
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: opts.mimeType.split(";")[0] || "audio/ogg", data: opts.data.toString("base64") } },
            { text: "Transcris ce message vocal." },
          ],
        },
      ],
      temperature: 0,
      maxOutputTokens: 400,
    },
    opts.vendorGeminiKey,
    20000,
  );
  return text ? text.replace(/^["«\s]+|["»\s]+$/g, "").trim() || null : null;
}

export type ImageMatch = { description: string; productIds: string[] };

/**
 * Photo search: Gemini looks at the customer's photo and picks the catalog
 * products that look like it (same kind of item, colour, material).
 */
export async function matchProductsFromImage(opts: {
  data: Buffer;
  mimeType: string;
  caption?: string;
  catalog: { id: string; name: string; description?: string }[];
  vendorGeminiKey?: string;
}): Promise<ImageMatch | null> {
  const catalogText = opts.catalog
    .slice(0, 150)
    .map((p) => `${p.id} | ${p.name}${p.description ? ` | ${p.description.slice(0, 120)}` : ""}`)
    .join("\n");
  const raw = await geminiGenerate(
    {
      system:
        "You help a shop find, in its own catalog, the products that look like the item in a customer's photo. " +
        'Answer with JSON only: {"description": "<the item in the photo, in French, max 12 words>", "productIds": ["<id>", ...]}. ' +
        "productIds: up to 3 catalog ids of the same kind of item, best match first; empty if nothing is similar. " +
        "Only use ids from the catalog.",
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: opts.mimeType.split(";")[0] || "image/jpeg", data: opts.data.toString("base64") } },
            {
              text:
                `Catalogue (id | nom | description):\n${catalogText || "(vide)"}\n\n` +
                `Message du client : ${opts.caption?.slice(0, 300) || "(aucun)"}`,
            },
          ],
        },
      ],
      temperature: 0.1,
      maxOutputTokens: 300,
      json: true,
    },
    opts.vendorGeminiKey,
    20000,
  );
  return raw ? parseImageMatch(raw, new Set(opts.catalog.map((p) => p.id))) : null;
}

/** Parse Gemini's JSON answer, keeping only ids that exist in the catalog. */
export function parseImageMatch(raw: string, knownIds: Set<string>): ImageMatch | null {
  try {
    const json = JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, "")) as {
      description?: unknown;
      productIds?: unknown;
    };
    const ids = Array.isArray(json.productIds)
      ? [...new Set(json.productIds.filter((id): id is string => typeof id === "string" && knownIds.has(id)))]
      : [];
    return {
      description: typeof json.description === "string" ? json.description.slice(0, 120) : "",
      productIds: ids.slice(0, 3),
    };
  } catch {
    return null;
  }
}

export const __testing = { formatCatalogForPrompt, buildSystemPrompt };
