import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isLiveMode } from "@/lib/whatsapp";
import { isLlmConfigured, llmProviderName } from "@/lib/llm";
import { parseWhatsAppAssistantConfig } from "@/lib/whatsapp-config";
import BotChatClient from "./BotChatClient";
import DeliveryLog from "./DeliveryLog";
import WhatsAppAssistantConfig from "./WhatsAppAssistantConfig";
import Glyph from "@/components/Glyph";

export default async function BotPage() {
  const vendor = await requireVendor();
  const outbound = await prisma.whatsAppMessage.findMany({
    where: { vendorId: vendor.id, direction: "OUT" },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { id: true, contact: true, body: true, status: true, createdAt: true },
  });

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
              : "bg-amber-100 text-amber-800")
          }
        >
          ● {cloudLive ? "WhatsApp Cloud API (Connecté)" : "WhatsApp Cloud API (À configurer)"}
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
            : "Renseignez votre Token Meta Cloud API & Phone Number ID ci-dessous pour activer l'envoi WhatsApp en direct."}
        </span>
      </div>

      {/* Configuration complète : QR Codes + Gemini IA + Meta WhatsApp Cloud API */}
      <WhatsAppAssistantConfig
        shopName={vendor.shopName}
        shopSlug={vendor.shopSlug}
        initialWhatsappNumber={vendor.whatsappNumber}
        initialPhoneNumberId={vendor.whatsappPhoneNumberId || ""}
        initialConfig={waConfig}
        isCloudLive={cloudLive}
        isGeminiLive={llmActive}
      />

      {/* Console en direct WhatsApp Cloud API & Assistant IA */}
      <div>
        <h2 className="text-base font-bold text-arctic-900 mb-2">
          💬 Console Live WhatsApp Cloud API & Assistant IA Gemini
        </h2>
        <p className="text-xs text-arctic-600 mb-3">
          Interagissez en direct avec votre Assistant IA connecté à votre base de données MySQL : posez des questions à Gemini, passez de vraies commandes (enregistrées dans votre onglet <strong>Orders</strong>), suivez vos commandes et envoyez les réponses sur WhatsApp Cloud API !
        </p>
        <BotChatClient shopName={vendor.shopName} />
      </div>

      <DeliveryLog messages={outbound} />
    </div>
  );
}
