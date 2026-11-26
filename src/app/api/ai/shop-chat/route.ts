import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { formatCurrencyAmount, convertCurrency } from "@/lib/currency";
import { digitsOnly, waMeLink } from "@/lib/utils";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";
import { getServerTr } from "@/lib/public-locale";

interface ChatMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export type ShopAiActionButton = {
  type:
    | "add_to_cart"
    | "buy_now"
    | "propose_deal"
    | "view_product"
    | "whatsapp_order"
    | "track_order"
    | "open_whatsapp_qr"
    | "pay_order";
  label: string;
  productId?: string;
  productName?: string;
  priceFormatted?: string;
  priceMajor?: number;
  url?: string;
  orderId?: string;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "🕒 Nouvelle (en attente de confirmation)",
  CONFIRMED: "✅ Confirmée (en préparation)",
  PAID: "💳 Payée (en cours d'expédition)",
  DELIVERED: "🎉 Livrée",
  CANCELLED: "❌ Annulée / Refusée",
};

export async function POST(req: NextRequest) {
  const tr = await getServerTr();
  try {
    const body = await req.json();
    const {
      shopSlug,
      message,
      history = [],
      currency = "XOF",
    } = body;

    if (!shopSlug || !message) {
      return NextResponse.json(
        { error: tr("shopSlug et message sont obligatoires.", "shopSlug and message are required") },
        { status: 400 },
      );
    }

    // 1. Fetch vendor and active products from database
    const vendor = await prisma.vendor.findUnique({
      where: { shopSlug },
      include: {
        products: {
          where: { isActive: true },
          orderBy: [{ stock: "desc" }, { createdAt: "desc" }],
          take: 50,
        },
      },
    });

    if (!vendor) {
      return NextResponse.json({ error: tr("Boutique introuvable", "Shop not found") }, { status: 404 });
    }

    const waConfig = parseWhatsAppAssistantConfig(vendor.uiPrefs);
    const assistantTitle = waConfig.assistantName || `Assistant ${vendor.shopName}`;
    const lower = String(message).toLowerCase().trim();

    // 2. Check if customer is asking to track an order or sent an order reference / phone
    const isTrackingIntent =
      lower.includes("suivre") ||
      lower.includes("suivi") ||
      lower.includes("ma commande") ||
      lower.includes("mes commandes") ||
      lower.includes("statut") ||
      lower.includes("track") ||
      /#[a-z0-9]{4,25}/i.test(lower);

    let orderContext = "";
    const actions: ShopAiActionButton[] = [];

    if (isTrackingIntent) {
      const hashMatch = message.match(/#?([a-z0-9]{5,25})\b/i);
      const phoneDigits = digitsOnly(message);
      const recentOrders = await prisma.order.findMany({
        where: { vendorId: vendor.id, deletedAt: null },
        include: { items: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      const matchedOrders = recentOrders.filter((o) => {
        const idLower = o.id.toLowerCase();
        if (hashMatch) {
          const ref = hashMatch[1].toLowerCase();
          if (
            ref !== "suivre" &&
            ref !== "commande" &&
            ref !== "statut" &&
            (idLower.endsWith(ref) ||
              idLower.startsWith(ref) ||
              idLower.slice(-6) === ref ||
              idLower.slice(0, 8) === ref)
          ) {
            return true;
          }
        }
        if (phoneDigits.length >= 8 && o.customerPhone) {
          const od = digitsOnly(o.customerPhone);
          if (od.endsWith(phoneDigits.slice(-8)) || phoneDigits.endsWith(od.slice(-8))) {
            return true;
          }
        }
        return false;
      });

      if (matchedOrders.length > 0) {
        const o = matchedOrders[0];
        const refCode = o.id.slice(-6).toUpperCase();
        const convertedTotal = convertCurrency(o.totalCents, vendor.currency, currency);
        const totalFormatted = formatCurrencyAmount(convertedTotal, currency);
        const itemsDesc = o.items.map((i) => `${i.quantity}× ${i.productName}`).join(", ");
        const statusLabel = STATUS_LABELS[o.status] || o.status;

        orderContext = `\nCommande trouvée pour le client : Réf #${refCode} | Statut: ${statusLabel} | Articles: ${itemsDesc} | Total: ${totalFormatted}.`;

        actions.push({
          type: "pay_order",
          label: `📦 Voir / Payer la commande #${refCode}`,
          orderId: o.id,
          url: `/pay/${o.id}`,
        });
        if (vendor.whatsappNumber) {
          actions.push({
            type: "whatsapp_order",
            label: `💬 Suivre #${refCode} sur WhatsApp`,
            url: waMeLink(
              vendor.whatsappNumber,
              `Bonjour ${vendor.shopName}, je souhaite suivre ma commande #${refCode}.`,
            ),
          });
        }
      }
    }

    // 3. Format catalog items with display currency
    const formattedProducts = vendor.products.map((p) => {
      const convertedCents = convertCurrency(p.priceCents, vendor.currency, currency);
      const priceFormatted = formatCurrencyAmount(convertedCents, currency);
      return {
        ...p,
        priceFormatted,
        priceMajor: Math.round(p.priceCents / 100),
        promptLine: `- [ID:${p.id}] ${p.name} | Prix: ${priceFormatted} (${p.priceCents / 100} ${vendor.currency}) | Stock: ${
          p.stock > 0 ? `${p.stock} disponible(s)` : "Épuisé"
        } | Tailles: ${p.sizes || "Unique"} | Description: ${p.description || "Aucune description"}`,
      };
    });

    const productCatalog = formattedProducts.map((p) => p.promptLine).join("\n");

    const deliveryInfo = vendor.deliveryEnabled
      ? `Livraison disponible. Frais de base: ${vendor.deliveryFeeCents / 100} ${vendor.currency}. Zones desservies: ${vendor.deliveryZones || "Standard"}.`
      : "Retrait en boutique ou accord direct par WhatsApp.";

    const systemInstruction = `Tu es "${assistantTitle}", l'Assistant IA officiel de la boutique "${vendor.shopName}" sur Japora.
Informations de la boutique :
- Nom : ${vendor.shopName}
- Slogan : ${vendor.tagline || "Boutique officielle sur Japora"}
- Présentation : ${vendor.bio || "Boutique marchande sur Japora"}
- Contact WhatsApp : ${vendor.whatsappNumber || "Disponible sur la page"}
- Modalités de livraison : ${deliveryInfo}
- Devise affichée : ${currency}
${waConfig.customInstructions ? `- Instructions spécifiques du vendeur : ${waConfig.customInstructions}\n` : ""}
Catalogue des produits disponibles dans la boutique :
${productCatalog || "(Aucun produit pour le moment)"}
${orderContext}

RÈGLES STRICTES :
1. Réponds de manière chaleureuse, précise et concise (2 à 4 phrases bien formatées).
2. Base-toi EXCLUSIVEMENT sur les produits et données fournis ci-dessus. N'invente JAMAIS de produits ou de prix.
3. Si le client cherche un produit disponible, recommande-lui les articles en stock correspondants avec leur nom exact et leur prix en ${currency}.
4. Si le client souhaite négocier ou proposer un deal, dis-lui qu'il peut cliquer sur le bouton "🤝 Proposer un deal" sous ta réponse pour envoyer son offre directement au Dashboard du vendeur.
5. Si le client souhaite suivre sa commande, invite-le à cliquer sur "📦 Suivre une commande" ou à donner sa référence (#XXXXXX).
6. Réponds dans la langue du client (Français ou Anglais).`;

    const apiKey =
      waConfig.geminiApiKey ||
      process.env.GEMINI_API_KEY ||
      process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    let replyText = "";
    let usedModel = "fallback-smart-assistant";

    // 4. Try Gemini (gemini-2.5-flash first; JAPORA_LLM_MODEL overrides)
    if (apiKey && waConfig.aiEnabled !== false) {
      const candidateModels = [
        ...new Set([process.env.JAPORA_LLM_MODEL, "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"]),
      ].filter((m): m is string => Boolean(m && m.trim()));

      const contents = [
        ...history.slice(-6).map((h: ChatMessage) => ({
          role: h.role === "assistant" ? "model" : "user",
          parts: [{ text: h.content }],
        })),
        {
          role: "user",
          parts: [{ text: message }],
        },
      ];

      for (const modelName of candidateModels) {
        try {
          const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
          const response = await fetch(geminiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [{ text: systemInstruction }],
              },
              contents,
              generationConfig: {
                temperature: 0.65,
                maxOutputTokens: 420,
              },
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const candidate =
              data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
            if (candidate) {
              replyText = candidate;
              usedModel = modelName;
              break;
            }
          }
        } catch (geminiError) {
          console.warn(`[gemini-api ${modelName} error]`, geminiError);
        }
      }
    }

    // 5. Find matching products from either the user message or the AI reply
    const combinedText = `${lower} ${replyText.toLowerCase()}`;
    const matchedProducts = formattedProducts.filter((p) => {
      const nameLower = p.name.toLowerCase();
      if (combinedText.includes(nameLower)) return true;
      const words = nameLower.split(/\s+/).filter((w) => w.length >= 3);
      return words.some((w) => lower.includes(w));
    });

    // 6. Resilient Intelligent Fallback if Gemini wasn't reached
    if (!replyText) {
      if (orderContext) {
        replyText = `Voici les informations trouvées pour votre commande :${orderContext}\n\nUtilisez les boutons ci-dessous pour accéder aux détails de paiement ou suivre sur WhatsApp.`;
      } else if (isTrackingIntent) {
        replyText = `📦 Pour suivre votre commande chez **${vendor.shopName}**, cliquez sur le bouton **Suivre une commande** ci-dessous ou indiquez votre référence de commande (ex: #AB12CD) ou votre numéro de téléphone WhatsApp.`;
      } else if (matchedProducts.length > 0) {
        const p = matchedProducts[0];
        replyText = `✨ **${p.name}** est disponible chez ${vendor.shopName} au prix de **${p.priceFormatted}**.\n\n${
          p.stock > 0
            ? `Il reste ${p.stock} exemplaire(s) en stock.`
            : "Cet article est actuellement épuisé."
        }${p.sizes ? ` Tailles disponibles : ${p.sizes}.` : ""}\n\nUtilisez les boutons d'action directe ci-dessous pour commander en 1 clic, proposer un deal, ou continuer sur WhatsApp !`;
      } else if (
        lower.includes("livraison") ||
        lower.includes("livrer") ||
        lower.includes("expedi")
      ) {
        replyText = `🚚 **Livraison chez ${vendor.shopName}** :\n${deliveryInfo}\n\nVous pouvez commander directement avec les boutons ci-dessous ou discuter avec notre assistant sur WhatsApp.`;
      } else if (formattedProducts.length > 0) {
        const sample = formattedProducts.filter((p) => p.stock > 0).slice(0, 4);
        const list = sample
          .map((p) => `• **${p.name}** : ${p.priceFormatted} (${p.stock} en stock)`)
          .join("\n");
        replyText = `Voici les articles disponibles en stock chez **${vendor.shopName}** :\n\n${list}\n\nCliquez sur un bouton d'action directe ci-dessous pour commander, proposer un deal, ou ouvrir l'assistant sur WhatsApp !`;
      } else {
        replyText = `Bienvenue chez **${vendor.shopName}** ! Comment puis-je vous aider aujourd'hui ?`;
      }
    }

    // 7. Build Direct Action Buttons (`actions`) for the customer
    const productsForButtons =
      matchedProducts.length > 0
        ? matchedProducts.slice(0, 2)
        : formattedProducts.filter((p) => p.stock > 0).slice(0, 2);

    for (const p of productsForButtons) {
      if (p.stock > 0) {
        actions.push({
          type: "buy_now",
          productId: p.id,
          productName: p.name,
          priceFormatted: p.priceFormatted,
          label: `⚡ Commander : ${p.name} (${p.priceFormatted})`,
        });
        actions.push({
          type: "propose_deal",
          productId: p.id,
          productName: p.name,
          priceFormatted: p.priceFormatted,
          priceMajor: p.priceMajor,
          label: `🤝 Proposer un deal : ${p.name}`,
        });
        actions.push({
          type: "add_to_cart",
          productId: p.id,
          productName: p.name,
          priceFormatted: p.priceFormatted,
          label: `🛒 Ajouter au panier : ${p.name}`,
        });
      } else {
        actions.push({
          type: "view_product",
          productId: p.id,
          productName: p.name,
          label: `🔍 Voir la fiche : ${p.name}`,
        });
      }
    }

    if (isTrackingIntent && !orderContext) {
      actions.unshift({
        type: "track_order",
        label: "📦 Rechercher ma commande",
      });
    } else {
      actions.push({
        type: "track_order",
        label: "📦 Suivre une commande",
      });
    }

    if (vendor.whatsappNumber) {
      actions.push({
        type: "open_whatsapp_qr",
        label: "📲 Assistant sur WhatsApp (QR Code)",
      });
    }

    return NextResponse.json({
      reply: replyText,
      model: usedModel,
      assistantName: assistantTitle,
      actions: actions.slice(0, 6),
      catalogSummary: formattedProducts.slice(0, 12).map((p) => ({
        id: p.id,
        name: p.name,
        priceFormatted: p.priceFormatted,
        priceMajor: p.priceMajor,
        stock: p.stock,
      })),
    });
  } catch (error: unknown) {
    console.error("[shop-chat error]", error);
    return NextResponse.json(
      { error: tr("Erreur lors du traitement de votre message.", "Error while processing your message.") },
      { status: 500 },
    );
  }
}
