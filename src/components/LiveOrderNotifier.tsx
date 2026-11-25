"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import { usePublicLang } from "@/components/PublicLanguageProvider";
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
  const lastCheckRef = useRef<string>(new Date().toISOString());

  useEffect(() => {
    let cancelled = false;

    const interval = setInterval(async () => {
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
      } catch {
        // network silent ignore
      }
    }, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!latestToast) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 a-fade-in max-w-sm rounded-shape-lg border border-emerald-500/30 bg-white p-4 shadow-elev-3 dark:bg-arctic-900">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-100 text-lg">
            <Glyph name="cart" size={16} />
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
          className="text-arctic-400 hover:text-arctic-700"
        >
          <Glyph name="close" size={16} />
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
  );
}
