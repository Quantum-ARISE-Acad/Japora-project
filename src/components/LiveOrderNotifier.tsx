"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import type { WhatsAppDiagnosticAlert } from "@/lib/whatsapp-config";
import Glyph from "@/components/Glyph";

type NotifOrder = {
  id: string;
  customerName: string;
  totalCents: number;
  status: string;
  createdAt: string;
};

export default function LiveOrderNotifier({ currency = "USD" }: { currency?: string }) {
  const { tr } = usePublicLang();
  const [latestToast, setLatestToast] = useState<NotifOrder | null>(null);
  const [latestWaAlert, setLatestWaAlert] = useState<WhatsAppDiagnosticAlert | null>(null);
  const [dismissedAlertId, setDismissedAlertId] = useState<string>("");
  const lastCheckRef = useRef<string>(new Date(Date.now() - 120_000).toISOString());

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/notify?since=${encodeURIComponent(lastCheckRef.current)}`);
        if (!res.ok) return;
        const data = await res.json();
        lastCheckRef.current = data.serverTime || new Date().toISOString();

        if (!cancelled && data.orders && data.orders.length > 0) {
          const newest = data.orders[0];
          setLatestToast(newest);
          setTimeout(() => setLatestToast(null), 6000);
        }

        if (!cancelled && data.whatsappAlerts && data.whatsappAlerts.length > 0) {
          setLatestWaAlert(data.whatsappAlerts[0]);
        } else if (!cancelled && data.latestWhatsappIssue && !latestWaAlert) {
          setLatestWaAlert(data.latestWhatsappIssue);
        }
      } catch {
        // network silent ignore
      }
    }

    poll();
    const interval = setInterval(poll, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showWaAlert = latestWaAlert && latestWaAlert.id !== dismissedAlertId;

  if (!latestToast && !showWaAlert) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md">
      {showWaAlert && latestWaAlert && (
        <div
          className={`a-fade-in rounded-shape-lg border-2 p-4 shadow-elev-3 ${
            latestWaAlert.severity === "error"
              ? "border-aurora-error/50 bg-aurora-error-bg text-aurora-error-text"
              : "border-aurora-warning/50 bg-aurora-warning-bg text-aurora-warning-text"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-aurora-surface shadow-xs">
                <Glyph name="alert" size={16} />
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider">
                  <span>
                    {latestWaAlert.stage === "gemini_ai"
                      ? tr("Diagnostic IA Gemini", "Gemini AI diagnostic")
                      : latestWaAlert.stage === "webhook_routing"
                      ? tr("Diagnostic routage webhook", "Webhook routing diagnostic")
                      : tr("Diagnostic WhatsApp Cloud API", "WhatsApp Cloud API diagnostic")}
                  </span>
                </div>
                <div className="text-xs font-bold leading-snug">
                  {tr(latestWaAlert.title, latestWaAlert.titleEn || latestWaAlert.title)}
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {tr(latestWaAlert.message, latestWaAlert.messageEn || latestWaAlert.message)}
                </p>
                {latestWaAlert.fixHint && (
                  <p className="rounded-shape-xs border border-arctic-400/30 bg-aurora-surface p-2 text-[11px] font-medium text-arctic-900">
                    <strong>{tr("Solution :", "Fix:")}</strong> {tr(latestWaAlert.fixHint, latestWaAlert.fixHintEn || latestWaAlert.fixHint)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setDismissedAlertId(latestWaAlert.id)}
              className="grid min-h-6 min-w-6 shrink-0 place-items-center rounded-shape-xs text-arctic-600 hover:text-arctic-900"
              title={tr("Masquer", "Dismiss")}
              aria-label={tr("Masquer", "Dismiss")}
            >
              <Glyph name="close" size={16} />
            </button>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-black/10 pt-2 text-xs">
            <span className="text-[11px] opacity-75">
              {new Date(latestWaAlert.at).toLocaleTimeString("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}
            </span>
            <Link
              href="/dashboard/bot"
              onClick={() => setDismissedAlertId(latestWaAlert.id)}
              className="inline-flex min-h-6 items-center font-bold underline hover:no-underline"
            >
              {tr("Ouvrir le diagnostic", "Open diagnostics")}
            </Link>
          </div>
        </div>
      )}

      {latestToast && (
        <div className="a-fade-in rounded-shape-lg border border-signal-fill/30 bg-aurora-surface p-4 shadow-elev-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-arctic-200/70 text-signal-text">
                <Glyph name="cart" size={16} />
              </span>
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-signal-text">
                  {tr("Nouvelle commande !", "New order!")}
                </div>
                <div className="text-sm font-semibold text-arctic-900">
                  {latestToast.customerName}
                </div>
              </div>
            </div>
            <button
              onClick={() => setLatestToast(null)}
              aria-label={tr("Fermer", "Close")}
              className="grid h-11 w-11 place-items-center text-arctic-500 hover:text-arctic-800"
            >
              <Glyph name="close" size={16} />
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-arctic-200/50 pt-2 text-xs">
            <span className="a-num font-bold text-arctic-800">
              {formatMoney(latestToast.totalCents, currency)}
            </span>
            <Link
              href="/dashboard/orders"
              onClick={() => setLatestToast(null)}
              className="inline-flex min-h-6 items-center font-semibold text-signal-text underline hover:no-underline"
            >
              {tr("Voir la commande", "View the order")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
