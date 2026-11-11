import { errorMessage } from "@/lib/errors";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { platform = "meta", productName = "", productPrice = "", storeName = "Japora Store" } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    const platformGuidelines: Record<string, string> = {
      meta: "Crée une accroche dynamique pour Facebook & Instagram axée sur la commande directe via WhatsApp. Utilise 2-3 emojis, un texte percutant, et un appel à l'action clair.",
      tiktok: "Crée un texte court, branché et captivant pour TikTok Ads (For You Page). Utilise un hook puissant dès le premier mot, un ton jeune et direct, et des hashtags tendance (#TikTokMadeMeBuyIt #BoutiqueAfrique).",
      linkedin: "Crée un texte professionnel orienté B2B et opportunité de marché pour LinkedIn Ads. Met en avant la qualité, le partenariat, la fiabilité et le sérieux du fournisseur.",
    };

    const prompt = `Tu es un expert mondial en copywriting de publicités digitales (Meta Ads, TikTok Ads, LinkedIn Ads).
Boutique : ${storeName}
Produit vedette : ${productName || "Sélection exclusive du catalogue"}
Prix : ${productPrice || "Prix direct atelier"}
Réseau publicitaire cible : ${platform.toUpperCase()}

Instructions spécifiques :
${platformGuidelines[platform] || platformGuidelines.meta}

Formatte ta réponse STRICTEMENT sous format JSON valide avec les champs suivants :
{
  "headline": "Titre d'accroche court (max 60 caractères)",
  "body": "Texte principal de la publicité (2 à 4 phrases percutantes avec emojis et appel à l'action)",
  "cta": "Texte du bouton (ex: Commander sur WhatsApp, Acheter, Découvrir)",
  "hashtags": "3 à 5 hashtags pertinents"
}
Ne renvoie rien d'autre que l'objet JSON.`;

    if (apiKey) {
      const candidateModels = ["gemini-flash-latest", "gemini-2.5-flash-lite", "gemini-1.5-flash"];
      for (const model of candidateModels) {
        try {
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 500,
                responseMimeType: "application/json",
              },
            }),
          });

          if (res.ok) {
            const data = await res.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const parsed = JSON.parse(text);
              return NextResponse.json({ ...parsed, model });
            }
          }
        } catch {}
      }
    }

    // Smart fallback if API is unreachable
    const fallbacks: Record<string, { headline: string; body: string; cta: string; hashtags: string }> = {
      meta: {
        headline: `🔥 Offre Spéciale : ${productName || "Nouveautés en stock"}`,
        body: `Découvrez la nouvelle collection chez ${storeName} ! ${productName ? `${productName} disponible immédiatement.` : "Qualité premium certifiée."} Cliquez pour commander directement sur WhatsApp avec paiement sécurisé Flooz/T-Money.`,
        cta: "Commander sur WhatsApp",
        hashtags: "#BoutiqueWhatsApp #ModeLomé #Promo",
      },
      tiktok: {
        headline: `POV: Tu as trouvé ${productName || "la pépite"} ✨`,
        body: `Ne cherchez plus, c'est disponible chez ${storeName} ! Stocks limités, livraison rapide à domicile. Tapote sur le lien pour sécuriser ta commande !`,
        cta: "Acheter maintenant",
        hashtags: "#TikTokMadeMeBuyIt #TendanceAfrique #Shoppez",
      },
      linkedin: {
        headline: `Fourniture & Qualité Pro : ${productName || "Catalogue B2B"}`,
        body: `${storeName} accompagne les professionnels et particuliers exigeants. Approvisionnement direct, conformité et transactions garanties sous séquestre. Contactez-nous pour votre devis.`,
        cta: "Contacter le fournisseur",
        hashtags: "#CommerceAfrique #FournisseurCertifie #Wataru",
      },
    };

    return NextResponse.json(fallbacks[platform] || fallbacks.meta);
  } catch (e) {
    return NextResponse.json({ error: errorMessage(e, "Unable to generate ad copy") }, { status: 500 });
  }
}
