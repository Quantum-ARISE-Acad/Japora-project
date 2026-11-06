"use client";

import { useRef, useState } from "react";
import Glyph from "@/components/Glyph";

interface ShareStatusProps {
  shopName: string;
  shopSlug: string;
  productName?: string;
  priceText?: string;
  imageUrl?: string;
  currency?: string;
}

export default function ShareStatus({
  shopName,
  shopSlug,
  productName,
  priceText,
  imageUrl,
}: ShareStatusProps) {
  const [open, setOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const shopUrl = typeof window !== "undefined"
    ? `${window.location.origin}/c/${shopSlug}`
    : `https://japora.app/c/${shopSlug}`;

  const defaultText = productName
    ? `✨ Disponible dès maintenant chez *${shopName}* !\n📦 ${productName} — ${priceText || ""}\n\n👉 Commandez directement ici : ${shopUrl}\nLivraison rapide via WhatsApp !`
    : `🛍️ Découvrez notre boutique en ligne *${shopName}* !\n\nTous nos articles et nouveautés en un clic :\n👉 ${shopUrl}`;

  const waShareUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(defaultText)}`;

  async function generateStatusCard() {
    setGenerating(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = 1080;
    canvas.height = 1920;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, "#064e3b");
    grad.addColorStop(0.5, "#042f2e");
    grad.addColorStop(1, "#022c22");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative circles
    ctx.fillStyle = "rgba(16, 185, 129, 0.15)";
    ctx.beginPath();
    ctx.arc(900, 200, 350, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(5, 150, 105, 0.12)";
    ctx.beginPath();
    ctx.arc(150, 1750, 450, 0, Math.PI * 2);
    ctx.fill();

    // Header badge
    ctx.fillStyle = "#10b981";
    ctx.font = "bold 42px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("NOUVEL ARRIVAGE", 540, 240);

    // Shop Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "900 80px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(shopName.toUpperCase(), 540, 360);

    // Image card box
    const cardX = 140;
    const cardY = 460;
    const cardSize = 800;

    ctx.fillStyle = "rgba(255, 255, 255, 0.1)";
    ctx.roundRect(cardX, cardY, cardSize, cardSize, 36);
    ctx.fill();

    // If image exists, draw it
    if (imageUrl) {
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });
        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardSize, cardSize, 36);
        ctx.clip();
        ctx.drawImage(img, cardX, cardY, cardSize, cardSize);
        ctx.restore();
      } catch {
        // draw initial letter if failed
        ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
        ctx.font = "bold 240px sans-serif";
        ctx.fillText((productName || shopName).charAt(0), 540, 920);
      }
    } else {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "bold 240px sans-serif";
      ctx.fillText((productName || shopName).charAt(0), 540, 920);
    }

    // Title / Product Name
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 64px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText(productName || "Découvrez notre catalogue", 540, 1360);

    // Price badge if given
    if (priceText) {
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.roundRect(320, 1420, 440, 100, 50);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 52px sans-serif";
      ctx.fillText(priceText, 540, 1490);
    }

    // Call to Action footer
    ctx.fillStyle = "#ffffff";
    ctx.font = "38px -apple-system, BlinkMacSystemFont, sans-serif";
    ctx.fillText("Commandez directement en ligne :", 540, 1630);

    ctx.fillStyle = "#34d399";
    ctx.font = "bold 44px monospace";
    ctx.fillText(shopUrl, 540, 1710);

    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = "28px sans-serif";
    ctx.fillText("Paiement mobile money · WhatsApp Catalog", 540, 1800);

    setPreviewUrl(canvas.toDataURL("image/png"));
    setGenerating(false);
  }

  function downloadCard() {
    if (!previewUrl) return;
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = `status_${shopSlug}_${Date.now()}.png`;
    a.click();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setTimeout(generateStatusCard, 100);
        }}
        className="inline-flex items-center gap-1.5 rounded-shape-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
      >
        <Glyph name="chat" size={14} /> Partager en Statut WhatsApp
      </button>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-arctic-900/60 p-4 backdrop-blur-sm">
          <div className="card w-full max-w-lg overflow-hidden rounded-shape-xl bg-white shadow-elev-3 dark:bg-arctic-900">
            <div className="flex items-center justify-between border-b border-arctic-300/40 px-5 py-3">
              <h3 className="text-sm font-bold text-arctic-900 dark:text-white">
                Partager sur votre Statut WhatsApp
              </h3>
              <button onClick={() => setOpen(false)} className="text-arctic-500 hover:text-arctic-800">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              <p className="text-xs text-arctic-600">
                Téléchargez cette affiche format Story/Statut pour la poster dans votre statut WhatsApp avec le lien de votre boutique !
              </p>

              {/* Hidden canvas */}
              <canvas ref={canvasRef} className="hidden" />

              {/* Preview image */}
              <div className="mx-auto w-48 aspect-[9/16] overflow-hidden rounded-xl shadow-lg border border-arctic-300/50 bg-arctic-900">
                {previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewUrl} alt="Aperçu Statut" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full place-items-center text-xs text-white">Génération…</div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  onClick={downloadCard}
                  disabled={!previewUrl || generating}
                  className="btn-primary w-full justify-center text-xs py-2.5"
                >
                  📥 Télécharger l&apos;affiche Statut (HD)
                </button>

                <a
                  href={waShareUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-ghost w-full justify-center gap-2 text-xs py-2.5 border border-emerald-600/30 text-emerald-700 bg-emerald-500/10 hover:bg-emerald-500/20"
                >
                  <Glyph name="chat" size={15} /> Partager le message texte avec lien sur WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
