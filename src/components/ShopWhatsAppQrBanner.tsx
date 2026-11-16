"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { SaasIcon } from "@/components/ui/SaasIcons";
import { shopWhatsAppLink } from "@/lib/shop-picker";

export default function ShopWhatsAppQrBanner({
  shopName,
  shopSlug,
  whatsappNumber,
  assistantName = "Assistant IA",
  whatsappPrefillMessage,
  onOpenWebAssistant,
  onOpenShopAi,
}: {
  shopName: string;
  shopSlug: string;
  whatsappNumber: string;
  assistantName?: string;
  whatsappPrefillMessage?: string;
  onOpenWebAssistant?: () => void;
  onOpenShopAi?: () => void;
}) {
  const [waQrSvg, setWaQrSvg] = useState<string>("");
  const [zoomOpen, setZoomOpen] = useState(false);

  // The Japora bot number (Meta Cloud API) when configured: the webhook routes the
  // chat to this shop through "(shopSlug)" in the prefill. Otherwise the vendor's own number.
  const waLink = shopWhatsAppLink({
    shopName,
    shopSlug,
    vendorNumber: whatsappNumber,
    botNumber: process.env.NEXT_PUBLIC_WHATSAPP_BOT_NUMBER,
    prefill: whatsappPrefillMessage,
  });
  const whatsappUrl = waLink
    ? waLink.url
    : typeof window !== "undefined"
    ? `${window.location.origin}/c/${shopSlug}?assistant=open`
    : `/c/${shopSlug}?assistant=open`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(whatsappUrl, {
      type: "svg",
      margin: 1,
      width: 220,
      color: { dark: "#075E54", light: "#FFFFFF" },
    })
      .then((svg) => {
        if (!cancelled) setWaQrSvg(svg);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [whatsappUrl]);

  function triggerWebAssistant() {
    if (onOpenWebAssistant) {
      onOpenWebAssistant();
      return;
    }
    if (onOpenShopAi) {
      onOpenShopAi();
      return;
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("japora:open-ai-assistant"));
    }
  }

  return (
    <>
      <div className="mb-6 rounded-2xl border border-emerald-500/35 bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-emerald-950/85 p-4 sm:p-5 shadow-lg">
        <div className="flex flex-col md:flex-row items-center justify-between gap-5">
          {/* Left: Description + Link to Assistant on the website itself + Direct WhatsApp link */}
          <div className="flex-1 space-y-3 text-center md:text-left">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              <SaasIcon name="bot" size={14} />
              <span>Assistant WhatsApp & IA</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>En ligne 24h/24</span>
            </div>

            <div>
              <h2 className="text-base sm:text-lg font-extrabold text-white">
                {assistantName} de {shopName}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
                Scannez le <strong>QR Code WhatsApp</strong> ci-contre pour discuter avec notre assistant IA directement dans votre WhatsApp (voir le catalogue, chercher un produit disponible, commander et suivre votre colis), ou ouvrez l&apos;assistant directement ici sur le site :
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 pt-1">
              <button
                type="button"
                onClick={triggerWebAssistant}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-900/50 transition cursor-pointer"
              >
                <SaasIcon name="sparkles" size={15} />
                <span>Ouvrir l&apos;Assistant IA sur le site</span>
              </button>

              {waLink && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/40 bg-emerald-500/15 hover:bg-emerald-500/25 px-4 py-2.5 text-xs sm:text-sm font-bold text-emerald-200 transition"
                >
                  <SaasIcon name="message" size={15} />
                  <span>Ouvrir dans WhatsApp</span>
                </a>
              )}
            </div>
          </div>

          {/* Right: Direct QR Code that opens the WhatsApp Assistant */}
          <div className="flex flex-col items-center shrink-0">
            <div
              onClick={() => setZoomOpen(true)}
              title="Cliquez pour agrandir le QR Code WhatsApp"
              className="group relative cursor-pointer rounded-2xl bg-white p-3 shadow-xl ring-2 ring-emerald-400/60 transition hover:scale-105"
            >
              {waQrSvg ? (
                <div
                  className="h-32 w-32 sm:h-36 sm:w-36 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: waQrSvg }}
                />
              ) : (
                <div className="grid h-32 w-32 sm:h-36 sm:w-36 place-items-center text-xs text-slate-400">
                  Chargement QR…
                </div>
              )}
              <div className="mt-1.5 text-center">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-700 px-2.5 py-0.5 text-[10px] font-bold text-white">
                  <SaasIcon name="qr" size={12} />
                  <span>Scanner pour WhatsApp IA</span>
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setZoomOpen(true)}
              className="mt-1.5 text-[11px] font-medium text-emerald-300 hover:text-emerald-200 underline cursor-pointer"
            >
              Agrandir le QR Code
            </button>
          </div>
        </div>
      </div>

      {/* Zoom Modal for the WhatsApp Assistant QR Code */}
      {zoomOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setZoomOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-slate-700 bg-slate-900 p-6 text-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-[11px] font-bold text-emerald-300">
                  <SaasIcon name="qr" size={13} />
                  <span>QR Code Assistant WhatsApp</span>
                </span>
                <h3 className="mt-1 text-lg font-extrabold text-white">{shopName}</h3>
                <p className="text-xs text-slate-400">
                  Scannez avec l&apos;appareil photo de votre téléphone pour discuter avec l&apos;IA sur WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setZoomOpen(false)}
                className="rounded-lg bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                <SaasIcon name="x" size={14} />
              </button>
            </div>

            <div className="flex flex-col items-center rounded-2xl bg-white p-5 text-slate-900 shadow-inner">
              {waQrSvg && (
                <div
                  className="h-56 w-56 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{ __html: waQrSvg }}
                />
              )}
              <p className="mt-2 text-center text-xs font-bold text-emerald-800">
                Ouvre directement l&apos;Assistant IA sur WhatsApp
              </p>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              {waLink && (
                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] px-4 py-2.5 text-xs font-bold text-white shadow-md transition"
                >
                  <SaasIcon name="message" size={14} />
                  <span>Ouvrir directement dans WhatsApp</span>
                </a>
              )}
              <button
                type="button"
                onClick={() => {
                  setZoomOpen(false);
                  triggerWebAssistant();
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 px-4 py-2.5 text-xs font-bold text-white transition cursor-pointer"
              >
                <SaasIcon name="sparkles" size={14} />
                <span>Utiliser l&apos;Assistant IA sur le site</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
