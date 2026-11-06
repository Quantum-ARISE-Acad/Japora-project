import type { Metadata } from "next";
import HowToUseClient from "./HowToUseClient";

export const metadata: Metadata = {
  title: "How Japora works — from “how much?” to paid",
  description:
    "A guided, animated walkthrough: create your shop, add products, share your link, let the bot answer, get paid on WhatsApp, and read your 6 PM summary.",
};

export default function HowToUsePage() {
  return <HowToUseClient />;
}
