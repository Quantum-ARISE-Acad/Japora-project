/**
 * Verified-shop status card for settings. Presentational — fed by
 * verificationProgress(). Shows the badge when earned, or a checklist of what's
 * left (phone verified + N paid orders).
 */

import VerifiedBadge from "@/components/VerifiedBadge";

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
          (done ? "bg-brand/15 text-brand-dark" : "bg-arctic-200/70 text-arctic-500")
        }
      >
        {done ? "✓" : "•"}
      </span>
      <span className={done ? "text-arctic-700" : "text-arctic-600"}>{children}</span>
    </li>
  );
}

export default function VerifiedShopCard({ progress }: { progress: Progress }) {
  return (
    <section className="card p-5">
      <div className="mb-1 flex items-center gap-2">
        <h2 className="font-bold text-arctic-900">Verified shop</h2>
        {progress.verified && <VerifiedBadge size="sm" />}
      </div>

      {progress.verified ? (
        <p className="text-sm text-arctic-600">
          Your shop is verified. Buyers see the ✓ badge on your catalog and across the marketplace —
          a trust signal that lifts conversion.
        </p>
      ) : (
        <>
          <p className="mb-3 text-sm text-arctic-600">
            Earn the trust badge automatically. Clear both and the ✓ appears on your catalog and
            marketplace listing.
          </p>
          <ul className="space-y-2">
            <Check done={progress.phoneVerified}>WhatsApp number verified</Check>
            <Check done={progress.paidOrdersNeeded === 0}>
              {progress.paidOrdersNeeded === 0
                ? "Enough fulfilled orders"
                : `${progress.paidOrders} paid order${progress.paidOrders === 1 ? "" : "s"} — ${progress.paidOrdersNeeded} more to go`}
            </Check>
          </ul>
        </>
      )}
    </section>
  );
}
