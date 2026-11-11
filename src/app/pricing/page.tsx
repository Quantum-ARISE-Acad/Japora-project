import Link from "next/link";
import { getCurrentVendor } from "@/lib/auth";
import {
  PRICING,
  PRICING_FEE_PERCENT,
  PRICING_KEEP_PERCENT,
} from "@/lib/billing";
import { formatMoney } from "@/lib/utils";

export default async function PricingPage() {
  const vendor = await getCurrentVendor();
  const cur = PRICING.displayCurrency; // XOF (launch market)
  const floor = formatMoney(PRICING.freeBelowCents, cur);
  const cap = formatMoney(PRICING.feeCapCents, cur);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-arctic-300/50 bg-arctic-50/80 backdrop-blur-glass-thin">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/" className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand font-black text-white">J</span>
            <span className="font-display text-[17px] font-semibold text-arctic-900">Japora</span>
          </Link>
          <div className="flex items-center gap-2">
            {vendor ? (
              <Link href="/dashboard/billing" className="btn-primary">Manage billing</Link>
            ) : (
              <>
                <Link href="/login" className="btn-ghost">Sign in</Link>
                <Link href="/signup" className="btn-primary">Start free</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="text-center a-fade-in">
          <div className="a-eyebrow">Pricing</div>
          <h1 className="a-display-sm mt-2 text-arctic-900 sm:a-display-md">
            Free to start. Pay only when you sell.
          </h1>
          <p className="a-body-lg mx-auto mt-3 max-w-xl text-arctic-700">
            No monthly fee, no card to start. When you take payment through Japora
            you keep <span className="font-semibold text-brand-dark">{PRICING_KEEP_PERCENT}%</span> — that&apos;s it.
          </p>
        </div>

        <div className="mx-auto mt-10 grid gap-5 sm:grid-cols-2">
          {/* Starter — free */}
          <div className="card flex flex-col p-6">
            <div className="a-eyebrow">Starter</div>
            <div className="mt-2 flex items-end gap-1">
              <span className="a-num font-display text-5xl font-semibold leading-none text-arctic-900">0%</span>
            </div>
            <p className="a-body-sm mt-2 text-arctic-600">
              Sell on WhatsApp, free forever. Customers pay you directly on your own
              T-Money or Flooz.
            </p>
            <ul className="mt-5 flex-1 space-y-2 a-body-md text-arctic-800">
              {[
                "Your catalog + shareable link & QR",
                "The bot answers “how much?” day and night",
                "Orders board, customers, the 6 PM summary",
                "Listed on the Japora marketplace",
                "Unlimited products, orders, messages",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 font-semibold text-brand-dark">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href={vendor ? "/dashboard" : "/start"} className="btn-ghost mt-6 w-full">
              {vendor ? "Go to dashboard" : "Start free"}
            </Link>
          </div>

          {/* Pro — pay as you sell */}
          <div className="glass glass-edge relative flex flex-col overflow-hidden rounded-shape-lg p-6">
            <span className="absolute right-4 top-4 a-eyebrow rounded-full bg-brand/10 px-2 py-0.5">Most popular</span>
            <div className="a-eyebrow">Pay as you sell</div>
            <div className="mt-2 flex items-end gap-2">
              <span className="a-num font-display text-5xl font-semibold leading-none text-arctic-900">
                Keep {PRICING_KEEP_PERCENT}%
              </span>
            </div>
            <p className="a-body-sm mt-2 text-arctic-600">
              Take payment in the chat (T-Money, Flooz, Moov, Orange). Japora&apos;s
              all-in fee is <span className="font-semibold text-brand-dark">{PRICING_FEE_PERCENT}%</span> of the
              order — mobile-money processing included. No monthly fee.
            </p>
            <ul className="mt-5 flex-1 space-y-2 a-body-md text-arctic-800">
              {[
                "Everything in Starter",
                "Inline payment — you see ✓ Paid the moment it clears",
                `Orders under ${floor} are free`,
                `Fee capped at ${cap} per order`,
                "Verified-shop badge eligibility",
              ].map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 font-semibold text-brand-dark">✓</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href={vendor ? "/dashboard/billing" : "/signup"} className="btn-primary mt-6 w-full">
              {vendor ? "Manage billing" : "Open my shop"}
            </Link>
          </div>
        </div>

        <p className="mx-auto mt-8 max-w-xl text-center a-body-sm text-arctic-600">
          Prices in CFA francs (XOF). The {PRICING_FEE_PERCENT}% is all-in — it
          already covers the mobile-money processing fee, so there are no
          surprises at settlement.
        </p>
      </main>
    </div>
  );
}
