"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import type { WhatsAppDiagnosticAlert } from "@/lib/whatsapp-config";

type NotifOrder = {
  id: string;
  customerName: string;
  totalCents: number;
  status: string;
  createdAt: string;
};

export default function LiveOrderNotifier({ currency = "USD" }: { currency?: string }) {
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
                {latestWaAlert.severity === "error" ? "🚨" : "⚠️"}
              </span>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-red-700">
                  <span>
                    {latestWaAlert.stage === "gemini_ai"
                      ? "Diagnostic IA Gemini"
                      : latestWaAlert.stage === "webhook_routing"
                      ? "Diagnostic Routage Webhook"
                      : "Diagnostic WhatsApp Cloud API"}
                  </span>
                </div>
                <div className="text-xs font-bold leading-snug">
                  {latestWaAlert.title}
                </div>
                <p className="text-xs leading-relaxed opacity-90">
                  {latestWaAlert.message}
                </p>
                {latestWaAlert.fixHint && (
                  <p className="rounded bg-white/80 p-2 text-[11px] font-medium text-arctic-900 border border-black/10">
                    💡 <strong>Solution :</strong> {latestWaAlert.fixHint}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setDismissedAlertId(latestWaAlert.id)}
              className="text-arctic-500 hover:text-arctic-900 text-xs font-bold px-1"
              title="Masquer"
            >
              ✕
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
              Ouvrir le diagnostic & régler →
            </Link>
          </div>
        </div>
      )}

      {latestToast && (
        <div className="a-fade-in rounded-shape-lg border border-emerald-500/30 bg-white p-4 shadow-elev-3 dark:bg-arctic-900">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-lg">
                🛒
              </span>
              <div>
                <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                  Nouvelle commande !
                </div>
                <div className="text-sm font-semibold text-arctic-900 dark:text-white">
                  {latestToast.customerName}
                </div>
              </div>
            </div>
            <button
              onClick={() => setLatestToast(null)}
              className="text-arctic-400 hover:text-arctic-700"
            >
              ✕
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
              Voir la commande →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
