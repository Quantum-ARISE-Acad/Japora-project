import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLiveMode } from "@/lib/whatsapp";
import { isLlmConfigured, llmProviderName } from "@/lib/llm";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";
import BotChatClient from "./BotChatClient";
import DeliveryLog from "./DeliveryLog";
import HandoffInbox, { type WaitingCustomer } from "./HandoffInbox";
import { listOpenHandoffs } from "@/lib/handoff";
import WhatsAppAssistantConfig from "./WhatsAppAssistantConfig";
import Glyph from "@/components/Glyph";

export default async function BotPage() {
  const vendor = await requireVendor();
  const outbound = await prisma.whatsAppMessage.findMany({
    where: { vendorId: vendor.id, direction: "OUT" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      contact: true,
      body: true,
      status: true,
      messageId: true,
      orderId: true,
      createdAt: true,
    },
  });

  const handoffs = await listOpenHandoffs(vendor.id);
  const waiting: WaitingCustomer[] = await Promise.all(
    handoffs.map(async (h) => {
      const messages = await prisma.whatsAppMessage.findMany({
        where: { vendorId: vendor.id, contact: h.contact },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, direction: true, body: true, createdAt: true },
      });
      return {
        id: h.id,
        contact: h.contact,
        lastMessage: h.lastMessage,
        createdAt: h.createdAt.toISOString(),
        expiresAt: h.expiresAt.toISOString(),
        messages: messages.reverse().map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
      };
    }),
  );

  const waConfig = parseWhatsAppAssistantConfig(vendor.uiPrefs);
  const cloudLive = isLiveMode(vendor);
  const llmActive = isLlmConfigured(waConfig.geminiApiKey);
  const providerName = llmProviderName(waConfig.geminiApiKey);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="a-headline-md text-arctic-900">
            Assistant WhatsApp Cloud API & IA Gemini
          </h1>
          <p className="text-sm text-arctic-600">
            Configurez votre assistant IA lié à votre boutique, récupérez vos QR codes, et testez en direct les commandes et le suivi sur WhatsApp.
          </p>
        </div>
        <a
          href={`/c/${vendor.shopSlug}?assistant=open`}
          target="_blank"
          rel="noreferrer"
          className="btn-primary text-xs gap-1.5"
        >
          <span>✨</span> Voir l&apos;Assistant sur ma boutique ↗
        </a>
      </div>

      <div className="card px-4 py-3 text-sm">
        <span
          className={
            "mr-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold " +
            (cloudLive
              ? "bg-emerald-100 text-emerald-800"
              : "bg-arctic-200/65 text-arctic-700")
          }
        >
          ● {cloudLive ? "WhatsApp Cloud API (Live)" : "Mode Simulation (Stub)"}
        </span>
        <span
          className={
            "mr-2 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold " +
            (llmActive
              ? "bg-sky-100 text-sky-800"
              : "bg-arctic-200/65 text-arctic-700")
          }
        >
          <Glyph name="sparkle" size={13} />{" "}
          {llmActive ? `IA Active (${providerName.toUpperCase()})` : "IA désactivée"}
        </span>
        <span className="text-arctic-800">
          {cloudLive
            ? "Vos clients sur WhatsApp reçoivent ces réponses et boutons interactifs en temps réel via Meta Cloud API."
            : "Mode simulation actif : testez toutes les fonctionnalités ci-dessous, puis renseignez votre Token Meta Cloud API & Phone Number ID pour passer en production."}
        </span>
      </div>

      <HandoffInbox waiting={waiting} />

      {/* Configuration complète : QR Codes + Gemini IA + Meta WhatsApp Cloud API */}
      <WhatsAppAssistantConfig
        shopName={vendor.shopName}
        shopSlug={vendor.shopSlug}
        initialWhatsappNumber={vendor.whatsappNumber}
        initialPhoneNumberId={vendor.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || ""}
        initialConfig={waConfig}
        isCloudLive={cloudLive}
        isGeminiLive={llmActive}
      />

      {/* Simulateur interactif WhatsApp (Questions IA, Commandes 1-clic, Suivi de commande) */}
      <div>
        <h2 className="text-base font-bold text-arctic-900 mb-2">
          💬 Simulateur WhatsApp Client (Test en direct)
        </h2>
        <p className="text-xs text-arctic-600 mb-3">
          Testez exactement ce que voit un client qui scanne votre QR Code WhatsApp : posez des questions à Gemini, cliquez sur les boutons de commande directe (les commandes arrivent dans votre onglet <strong>Orders</strong>), et testez le suivi de commande !
        </p>
        <BotChatClient shopName={vendor.shopName} />
      </div>

      <DeliveryLog
        messages={outbound.map((message) => ({
          ...message,
          createdAt: message.createdAt.toISOString(),
        }))}
        liveMode={cloudLive}
      />
    </div>
  );
}
