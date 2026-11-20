"use client";

import { useMemo, useState } from "react";
import { shopWhatsAppLink } from "@/lib/shop-picker";
import { usePublicLang } from "@/components/PublicLanguageProvider";

/**
 * Printable shop & WhatsApp Assistant QR codes.
 * Renders:
 *  1) WhatsApp AI Assistant direct QR (https://wa.me/<number>?text=...). Same link
 *     as the public catalog: the Japora bot number with the "(slug)" tag when
 *     NEXT_PUBLIC_WHATSAPP_BOT_NUMBER is set, otherwise the vendor's own number.
 *  2) Shop AI Assistant QR (/c/<slug>?assistant=open)
 *  3) Standard Catalog QR (/c/<slug>)
 */
export default function ShopQrCard({
  slug,
  shopName,
  whatsappNumber = "",
  whatsappPrefillMessage = "",
}: {
  slug: string;
  shopName: string;
  whatsappNumber?: string;
  whatsappPrefillMessage?: string;
}) {
  const { tr } = usePublicLang();
  const [open, setOpen] = useState(true);
  const [qrType, setQrType] = useState<"whatsapp_ai" | "shop_ai" | "catalog">("whatsapp_ai");

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    (typeof window !== "undefined" ? window.location.origin : "http://localhost:5174");

  const catalogUrl = `${base.replace(/\/$/, "")}/c/${slug}`;
  const shopAiUrl = `${catalogUrl}?assistant=open`;

  const waLink = useMemo(
    () =>
      shopWhatsAppLink({
        shopName,
        shopSlug: slug,
        vendorNumber: whatsappNumber,
        botNumber: process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER,
        prefill: whatsappPrefillMessage,
      }),
    [shopName, slug, whatsappNumber, whatsappPrefillMessage],
  );
  const hasWhatsApp = waLink !== null;
  const viaJaporaNumber = waLink?.viaJaporaNumber ?? false;
  const waAssistantUrl = waLink?.url ?? shopAiUrl;

  const targetUrl =
    qrType === "whatsapp_ai"
      ? waAssistantUrl
      : qrType === "shop_ai"
      ? shopAiUrl
      : catalogUrl;

  const qrSrc = useMemo(
    () => `/api/qr?data=${encodeURIComponent(targetUrl)}&name=japora-${qrType}-${slug}`,
    [targetUrl, qrType, slug],
  );
  const downloadSrc = `${qrSrc}&download=1`;

  function print() {
    const w = window.open("", "_blank", "width=520,height=680");
    if (!w) return;
    const subtitle =
      qrType === "whatsapp_ai"
        ? "Scannez pour discuter avec notre Assistant IA sur WhatsApp, commander & suivre vos colis"
        : qrType === "shop_ai"
        ? "Scannez pour ouvrir notre Boutique & Assistant IA Gemini"
        : "Scannez pour parcourir notre catalogue en ligne";
    w.document.write(`<!doctype html><html><head><title>${shopName} — Japora QR</title>
      <style>
        body{font-family:system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;color:#1e293b;text-align:center}
        .card{padding:36px;border:2px solid #10b981;border-radius:24px;max-width:380px}
        .badge{display:inline-block;background:#d1fae5;color:#065f46;font-size:12px;font-weight:700;padding:4px 12px;border-radius:999px;margin-bottom:8px}
        img{width:280px;height:280px;margin:12px auto;display:block}
        h1{font-size:24px;margin:4px 0}
        p{color:#475569;font-size:14px;margin:6px 0 16px}
        .u{font-size:11px;color:#64748b;word-break:break-all}
      </style></head><body><div class="card">
        <span class="badge">🤖 Assistant IA & WhatsApp Japora</span>
        <h1>${shopName}</h1>
        <p>${subtitle}</p>
        <img src="${qrSrc}" alt="QR" />
        <p class="u">${targetUrl}</p>
      </div>
      <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
      </body></html>`);
    w.document.close();
  }

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-arctic-900">
            {tr("📲 QR Codes de votre Boutique & Assistant WhatsApp IA", "📲 QR codes for your shop & WhatsApp AI assistant")}
          </h2>
          <p className="mt-1 text-sm text-arctic-600">
            {tr("Ces QR codes sont également affichés automatiquement sur votre boutique publique. Téléchargez-les ou imprimez-les pour vos clients.", "These QR codes are also shown automatically on your public shop. Download or print them for your customers.")}
          </p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="btn-ghost shrink-0 text-xs">
          {open ? tr("Masquer", "Hide") : tr("Afficher QR", "Show QR")}
        </button>
      </div>

      {open && (
        <div className="mt-4 space-y-4">
          {/* QR Mode Selector */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setQrType("whatsapp_ai")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                qrType === "whatsapp_ai"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "bg-arctic-100 text-arctic-700 hover:bg-arctic-200"
              }`}
            >
              {tr("💬 1. QR Assistant sur WhatsApp (wa.me)", "💬 1. WhatsApp assistant QR (wa.me)")}
            </button>
            <button
              type="button"
              onClick={() => setQrType("shop_ai")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                qrType === "shop_ai"
                  ? "bg-brand text-white shadow-xs"
                  : "bg-arctic-100 text-arctic-700 hover:bg-arctic-200"
              }`}
            >
              {tr("✨ 2. QR Assistant IA sur la Boutique", "✨ 2. AI assistant QR on the shop")}
            </button>
            <button
              type="button"
              onClick={() => setQrType("catalog")}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                qrType === "catalog"
                  ? "bg-arctic-800 text-white shadow-xs"
                  : "bg-arctic-100 text-arctic-700 hover:bg-arctic-200"
              }`}
            >
              {tr("🛍️ 3. QR Catalogue Standard", "🛍️ 3. Standard catalog QR")}
            </button>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center rounded-xl border border-arctic-300/60 bg-arctic-50/50 p-4">
            <div className="grid h-40 w-40 shrink-0 place-items-center rounded-shape-md border-2 border-emerald-500/30 bg-white p-2 shadow-xs">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt={tr(`QR de ${shopName}`, `QR for ${shopName}`)} className="h-full w-full" />
            </div>
            <div className="space-y-2.5 flex-1">
              <div className="text-xs font-bold text-arctic-900">
                {qrType === "whatsapp_ai"
                  ? tr("Redirige directement le client vers l'Assistant IA sur WhatsApp", "Takes the customer straight to the AI assistant on WhatsApp")
                  : qrType === "shop_ai"
                  ? tr("Ouvre votre boutique avec l'Assistant IA Gemini ouvert et prêt à répondre", "Opens your shop with the Gemini AI assistant open and ready to answer")
                  : tr("Ouvre le catalogue public de votre boutique", "Opens your shop's public catalog")}
              </div>
              <p className="text-xs text-arctic-600 break-all font-mono bg-white/80 p-2 rounded border border-arctic-200">
                {targetUrl}
              </p>
              {qrType === "whatsapp_ai" && viaJaporaNumber && (
                <p className="text-xs text-arctic-600">
                  {tr("Ce QR code ouvre le numéro WhatsApp de Japora avec le nom de votre boutique déjà écrit : l'assistant répond automatiquement au nom de votre boutique, et les commandes arrivent dans votre tableau de bord.", "This QR code opens Japora's WhatsApp number with your shop name already written: the assistant answers automatically on behalf of your shop, and orders arrive in your dashboard.")}
                </p>
              )}
              {qrType === "whatsapp_ai" && !hasWhatsApp && (
                <p className="text-xs text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded border border-amber-200">
                  {tr("⚠️ Renseignez votre numéro WhatsApp ci-dessous pour que ce QR code pointe vers votre numéro WhatsApp.", "⚠️ Enter your WhatsApp number below so this QR code points to your WhatsApp number.")}
                </p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <a href={downloadSrc} className="btn-primary text-xs">
                  {tr("📥 Télécharger SVG", "📥 Download SVG")}
                </a>
                <button type="button" onClick={print} className="btn-ghost text-xs border border-arctic-300">
                  {tr("🖨️ Imprimer l'affiche QR", "🖨️ Print the QR poster")}
                </button>
                <a
                  href={targetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost text-xs text-emerald-700 hover:underline"
                >
                  {tr("Tester le lien ↗", "Test the link ↗")}
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
