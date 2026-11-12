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

async function callGemini(
  system: string,
  user: string,
  vendorGeminiKey?: string,
): Promise<string | null> {
  const key =
    vendorGeminiKey ||
    process.env.GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!key) return null;

  const candidateModels = [
    process.env.JAPORA_LLM_MODEL,
    "gemini-2.5-flash",
    "gemini-flash-latest",
  ].filter((m): m is string => Boolean(m && m.trim()));

  for (const modelName of candidateModels) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: system }],
          },
          contents: [
            {
              role: "user",
              parts: [{ text: user }],
            },
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 380,
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
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) return text;
    } catch (e) {
      logger.warn("llm.gemini_failed", { model: modelName, error: String(e) });
    } finally {
      clearTimeout(timer);
    }
  }
  return null;
}

async function callAnthropic(system: string, user: string): Promise<string | null> {
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
        messages: [{ role: "user", content: user }],
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

async function callOpenAI(system: string, user: string): Promise<string | null> {
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
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
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
}): Promise<string | null> {
  if (!isLlmConfigured(opts.vendorGeminiKey)) return null;
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
    answer = await callGemini(system, user, opts.vendorGeminiKey);
  } else if (provider === "anthropic") {
    answer = await callAnthropic(system, user);
  } else if (provider === "openai") {
    answer = await callOpenAI(system, user);
  }

  // Fallback to Gemini if primary failed and Gemini key is available
  if (!answer && provider !== "gemini") {
    answer = await callGemini(system, user, opts.vendorGeminiKey);
  }

  if (answer) logger.info("llm.reply", { provider, shopName: opts.shopName });
  return answer;
}

export const __testing = { formatCatalogForPrompt, buildSystemPrompt };
