"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import type { WhatsAppDiagnosticAlert } from "@/lib/whatsapp-config";

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
              ? "border-red-500/60 bg-red-50 text-red-950"
              : "border-amber-500/60 bg-amber-50 text-amber-950"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-base shadow-xs">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-red-700">
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
                  <p className="rounded bg-white/80 p-2 text-[11px] font-medium text-arctic-900 border border-black/10">
                    <strong>{tr("Solution :", "Fix:")}</strong> {tr(latestWaAlert.fixHint, latestWaAlert.fixHintEn || latestWaAlert.fixHint)}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setDismissedAlertId(latestWaAlert.id)}
              className="text-arctic-500 hover:text-arctic-900 text-xs font-bold px-1"
              title={tr("Masquer", "Dismiss")}
              aria-label={tr("Masquer", "Dismiss")}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
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
              className="font-bold text-red-800 underline hover:no-underline"
            >
              {tr("Ouvrir le diagnostic et régler →", "Open diagnostics and fix →")}
            </Link>
          </div>
        </div>
      )}

      {latestToast && (
        <div className="a-fade-in rounded-shape-lg border border-emerald-500/30 bg-white p-4 shadow-elev-3 dark:bg-arctic-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-lg">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 text-emerald-700" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6" /></svg>
              </span>
              <div>
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  {tr("Nouvelle commande !", "New order!")}
                </div>
                <div className="text-sm font-semibold text-arctic-900 dark:text-white">
                  {latestToast.customerName}
                </div>
              </div>
            </div>
            <button
              onClick={() => setLatestToast(null)}
              aria-label={tr("Fermer", "Close")}
              className="grid h-11 w-11 place-items-center text-arctic-500 hover:text-arctic-800"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-arctic-200/50 pt-2 text-xs">
            <span className="font-bold text-arctic-800 dark:text-arctic-200">
              {formatMoney(latestToast.totalCents, currency)}
            </span>
            <Link
              href="/dashboard/orders"
              onClick={() => setLatestToast(null)}
              className="font-semibold text-emerald-700 underline hover:no-underline dark:text-emerald-400"
            >
              {tr("Voir la commande →", "View the order →")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
