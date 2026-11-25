"use client";

import VerifiedBadge from "@/components/VerifiedBadge";
import { usePublicLang } from "@/components/PublicLanguageProvider";
import Glyph from "@/components/Glyph";

type Progress = {
  verified: boolean;
  phoneVerified: boolean;
  paidOrders: number;
  paidOrdersNeeded: number;
};

function Check({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span
        className={
          "grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold " +
          (done ? "bg-brand/15 text-brand-dark" : "bg-arctic-200/70 text-arctic-600")
        }
      >
        {done ? <Glyph name="check" size={13} /> : "•"}
      </span>
      <span className={done ? "text-arctic-700" : "text-arctic-600"}>{children}</span>
    </li>
  );
}

export default function VerifiedShopCard({ progress }: { progress: Progress }) {
  const { tr } = usePublicLang();

  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-bold text-arctic-900">
          {tr("Boutique vérifiée", "Verified shop")}
        </h2>
        {progress.verified && <VerifiedBadge size="sm" />}
      </div>

      {progress.verified ? (
        <p className="text-sm text-arctic-600">
          {tr(
            "Votre boutique est vérifiée. Les acheteurs voient le badge de confiance sur votre catalogue et sur le marketplace — un gage de confiance qui augmente vos ventes.",
            "Your shop is verified. Buyers see the trust badge on your catalog and across the marketplace — a trust signal that lifts conversion.",
          )}
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-arctic-600">
            {tr(
              "Obtenez automatiquement le badge de confiance. Validez ces deux étapes pour l’afficher sur votre catalogue et le marketplace.",
              "Earn the trust badge automatically. Clear both and it appears on your catalog and marketplace listing.",
            )}
          </p>
          <ul className="space-y-2">
            <Check done={progress.phoneVerified}>
              {tr("Numéro WhatsApp vérifié", "WhatsApp number verified")}
            </Check>
            <Check done={progress.paidOrdersNeeded === 0}>
              {progress.paidOrdersNeeded === 0
                ? tr("Nombre suffisant de commandes honorées", "Enough fulfilled orders")
                : tr(
                    `${progress.paidOrders} commande${progress.paidOrders === 1 ? "" : "s"} payée${progress.paidOrders === 1 ? "" : "s"} — encore ${progress.paidOrdersNeeded} requise${progress.paidOrdersNeeded === 1 ? "" : "s"}`,
                    `${progress.paidOrders} paid order${progress.paidOrders === 1 ? "" : "s"} — ${progress.paidOrdersNeeded} more to go`,
                  )}
            </Check>
          </ul>
        </>
      )}
    </section>
  );
}
