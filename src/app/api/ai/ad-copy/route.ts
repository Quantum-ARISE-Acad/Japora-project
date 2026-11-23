import { NextRequest, NextResponse } from "next/server";
import { getCurrentVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/utils";
import { getClientIp, rateLimit, tooManyRequests } from "@/lib/ratelimit";
import {
  buildAdCopyPrompt,
  fallbackAdCopy,
  normalizeAdPlatform,
  parseAdCopyResponse,
} from "@/lib/ad-copy";
import { findCategory, findRegion } from "@/lib/regions";
import { logger } from "@/lib/logger";
import { getServerTr } from "@/lib/public-locale";

export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  const vendor = await getCurrentVendor();
  if (!vendor) {
    return NextResponse.json({ error: tr("Veuillez vous connecter pour générer un texte.", "Please sign in to generate a text.") }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limit = rateLimit({ key: `ad-copy:${vendor.id}:${ip}`, limit: 10, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return tooManyRequests(limit, "Limite de générations atteinte. Réessayez plus tard.");
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: tr("La demande est invalide.", "The request is invalid.") }, { status: 400 });
  }

  const platform = normalizeAdPlatform(body.platform);
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const manualProductName = typeof body.productName === "string"
    ? body.productName.replace(/[\u0000-\u001F\u007F]/g, " ").trim().slice(0, 120)
    : "";

  let product: { name: string; priceCents: number; stock: number } | null = null;
  if (productId) {
    product = await prisma.product.findFirst({
      where: { id: productId, vendorId: vendor.id, isActive: true },
      select: { name: true, priceCents: true, stock: true },
    });
    if (!product) {
      return NextResponse.json({ error: tr("Ce produit est introuvable dans votre catalogue actif.", "This product is not in your active catalog.") }, { status: 400 });
    }
  }

  const context = {
    platform,
    storeName: vendor.shopName,
    tagline: vendor.tagline,
    category: findCategory(vendor.category)?.label || vendor.category,
    region: findRegion(vendor.region)?.label || vendor.region,
    bio: vendor.bio,
    language: vendor.language,
    targetRegion: typeof body.targetRegion === "string" ? body.targetRegion.slice(0, 120) : "",
    productName: product?.name || manualProductName,
    productPrice: product ? formatMoney(product.priceCents, vendor.currency) : "",
    productStock: product?.stock,
  };

  const fallback = fallbackAdCopy(context);
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json(fallback);

  const prompt = buildAdCopyPrompt(context);
  const preferredModel = process.env.GEMINI_AD_COPY_MODEL || "gemini-2.5-flash";
  const models = [...new Set([preferredModel, "gemini-flash-latest"])];
  for (const model of models) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              maxOutputTokens: 500,
              responseMimeType: "application/json",
            },
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!response.ok) {
        logger.warn("ad_copy.model_unavailable", { model, status: response.status, vendorId: vendor.id });
        continue;
      }
      const data = await response.json();
      const generated = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof generated !== "string") continue;

      try {
        return NextResponse.json({ ...parseAdCopyResponse(generated), model, mode: "ai" });
      } catch {
        logger.warn("ad_copy.invalid_model_output", { model, vendorId: vendor.id });
      }
    } catch (error) {
      logger.warn("ad_copy.model_request_failed", {
        model,
        vendorId: vendor.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json(fallback);
}
