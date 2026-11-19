import type { Metadata } from "next";
import { getServerTr } from "@/lib/public-locale";
import HowToUseClient from "./HowToUseClient";

export async function generateMetadata(): Promise<Metadata> {
  const tr = await getServerTr();
  return {
    title: tr("Comment marche Japora — de « c'est combien ? » au paiement", "How Japora works — from “how much?” to paid"),
    description: tr(
      "Une visite guidée et animée : créez votre boutique, ajoutez vos produits, partagez votre lien, laissez le bot répondre, encaissez sur WhatsApp et lisez votre bilan de 18 h.",
      "A guided, animated walkthrough: create your shop, add products, share your link, let the bot answer, get paid on WhatsApp, and read your 6 PM summary.",
    ),
  };
}

export default function HowToUsePage() {
  return <HowToUseClient />;
}
