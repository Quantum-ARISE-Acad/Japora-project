import Link from "next/link";
import { requireVendor } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getEntitlement, computeCommissionCents } from "@/lib/billing";
import { billingMode, priceDisplay } from "@/lib/stripe";
import { formatMoney } from "@/lib/utils";
import BillingActions from "./BillingActions";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; canceled?: string }>;
}) {
  const vendor = await requireVendor();
  const ent = getEntitlement(vendor);
  const mode = billingMode();
  const sp = await searchParams;

  // Japora fee this month — per-order with the success-based floor + cap applied
  // (free under the small-order floor, capped per order). PAID/DELIVERED orders
  // in the current calendar month. Starter (0%) vendors show zero.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const paidThisMonth = await prisma.order.findMany({
    where: {
      vendorId: vendor.id,
      status: { in: ["PAID", "DELIVERED"] },
      createdAt: { gte: monthStart, lt: monthEnd },
      deletedAt: null,
    },
    select: { totalCents: true },
  });
  const commissionCents = paidThisMonth.reduce(
    (sum, o) => sum + computeCommissionCents(o.totalCents, vendor.commissionPct || undefined),
    0,
  );

  return (
    <div className="space-y-5">
      <div>
        <h1 className="a-headline-md text-arctic-900">Billing</h1>
        <p className="text-sm text-arctic-600">Manage your Japora Pro subscription.</p>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">Commission this month</h2>
          <span className="rounded-full bg-arctic-200/65 px-2 py-0.5 text-xs font-semibold text-arctic-700">
            {(vendor.commissionPct * 100).toFixed(1)}%
          </span>
        </div>
        <div className="mt-2 text-3xl font-bold text-brand-dark">
          {commissionCents > 0
            ? formatMoney(commissionCents, vendor.currency)
            : `0 ${vendor.currency} — no paid orders this month yet`}
        </div>
        <p className="mt-1 text-xs text-arctic-600">
          {commissionCents > 0
            ? "Auto-deducted on next settled payment."
            : "We only take a cut after you get paid."}
        </p>
      </div>

      {sp.ok === "1" && (
        <div className="rounded-xl border border-brand/20 bg-brand/10 px-4 py-3 text-sm text-brand-dark">
          You&apos;re on Pro. That&apos;s it — nothing else to do.
        </div>
      )}
      {sp.canceled === "1" && (
        <div className="rounded-xl border border-arctic-400/30 bg-arctic-100/55 px-4 py-3 text-sm text-arctic-800">
          Checkout cancelled. Come back any time.
        </div>
      )}

      <div className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">Current plan</h2>
          <span
            className={
              "rounded-full px-2 py-0.5 text-xs font-semibold " +
              (ent.active
                ? "bg-brand/10 text-brand-dark"
                : "bg-amber-100 text-amber-800")
            }
          >
            ● {ent.status.replace("_", " ")}
          </span>
        </div>
        <p className="mt-2 text-sm text-arctic-700">{ent.summary}</p>

        {ent.status === "trialing" && ent.trialDaysRemaining !== null && (
          <div className="mt-4 rounded-lg bg-arctic-100/55 p-4">
            <div className="text-xs uppercase tracking-wide text-arctic-600">Trial countdown</div>
            <div className="mt-1 a-headline-md text-arctic-900">
              {ent.trialDaysRemaining} days left
            </div>
            <p className="mt-1 text-sm text-arctic-600">
              You can add a card any time — you won&apos;t be charged until day 30.
            </p>
          </div>
        )}

        <div className="mt-5">
          {mode === "stub" ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              <strong>Stripe isn&apos;t configured yet.</strong>
              <br />
              Add <code>STRIPE_SECRET_KEY</code>, <code>STRIPE_WEBHOOK_SECRET</code>, and{" "}
              <code>STRIPE_PRICE_ID</code> to <code>.env</code>, then{" "}
              <code>pnpm add stripe</code> to enable checkout.
            </div>
          ) : (
            <BillingActions
              hasSubscription={Boolean(vendor.stripeSubscriptionId)}
              priceDisplay={priceDisplay()}
            />
          )}
        </div>
      </div>

      <div className="card p-5 text-sm text-arctic-600">
        Need a receipt or to change payment method?{" "}
        <Link href="/dashboard/billing" className="font-semibold text-brand-dark hover:underline">
          Use &ldquo;Manage subscription&rdquo;
        </Link>{" "}
        to open Stripe&apos;s hosted billing portal.
      </div>
    </div>
  );
}
