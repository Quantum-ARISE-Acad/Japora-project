"use client";

import { useMemo, useState } from "react";
import { AuroraIsoscout } from "@/components/aurora";

type Referral = {
  id: string;
  status: string;
  createdAt: string;
  rewardedAt: string | null;
  referee: {
    shopName: string;
    email: string;
    createdAt: string;
  } | null;
};

const TARGET = 3;

export default function ReferralClient({
  referralCode,
  shareUrl,
  referrals,
  rewardCount,
  shopName,
}: {
  referralCode: string;
  shareUrl: string;
  referrals: Referral[];
  rewardCount: number;
  shopName: string;
}) {
  const [copied, setCopied] = useState<"" | "code" | "url">("");

  // Prefilled WhatsApp invite — wa.me without a number opens the share
  // picker so the sender can pick a contact / group.
  const inviteMessage = useMemo(
    () =>
      `Hey! I'm using Japora to sell on WhatsApp — orders, payments, all sorted. ${shopName} got me hooked. Sign up with my link and we both win: ${shareUrl}`,
    [shareUrl, shopName],
  );
  const waLink = `https://wa.me/?text=${encodeURIComponent(inviteMessage)}`;

  async function copy(text: string, kind: "code" | "url") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // no-op — most browsers prompt for permission on first use.
    }
  }

  const progress = Math.min(rewardCount, TARGET);
  const remaining = Math.max(0, TARGET - rewardCount);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="a-headline-md text-arctic-900">Refer a vendor</h1>
        <p className="text-sm text-arctic-600">
          Invite other sellers. When 3 make their first paid order, you get 3 months
          commission-free.
        </p>
      </div>

      <div className="card space-y-4 p-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-arctic-600">
            Your referral code
          </div>
          <div className="mt-1 flex items-center gap-3">
            <div className="rounded-lg bg-arctic-200/65 px-3 py-2 font-mono text-lg font-bold tracking-widest text-arctic-900">
              {referralCode}
            </div>
            <button
              onClick={() => copy(referralCode, "code")}
              className="rounded-lg border border-arctic-400/45 px-3 py-2 text-xs font-semibold text-arctic-800 hover:bg-arctic-100/55"
            >
              {copied === "code" ? "Copied" : "Copy code"}
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-semibold uppercase tracking-wide text-arctic-600">
            Share link
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              type="text"
              readOnly
              value={shareUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="flex-1 min-w-[16rem] rounded-lg border border-arctic-400/45 bg-arctic-100/55 px-3 py-2 text-sm text-arctic-800"
            />
            <button
              onClick={() => copy(shareUrl, "url")}
              className="rounded-lg border border-arctic-400/45 px-3 py-2 text-sm font-semibold text-arctic-800 hover:bg-arctic-100/55"
            >
              {copied === "url" ? "Copied" : "Copy"}
            </button>
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Share on WhatsApp
            </a>
          </div>
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-arctic-900">Reward progress</h2>
          <span className="text-xs font-semibold text-arctic-600">
            {progress} / {TARGET} qualified
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-arctic-300">
          <div
            className="h-full bg-brand-dark transition-all"
            style={{ width: `${(progress / TARGET) * 100}%` }}
          />
        </div>
        <p className="text-sm text-arctic-700">
          {remaining === 0
            ? "You unlocked 3 months free of Japora commission. Nice work."
            : `${remaining} more qualified referral${remaining > 1 ? "s" : ""} to unlock 3 months free.`}
        </p>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b border-arctic-400/30 px-5 py-3">
          <h2 className="text-sm font-semibold text-arctic-900">Referred vendors</h2>
        </div>
        {referrals.length === 0 ? (
          <div className="p-2">
            <AuroraIsoscout
              compact
              variant="customers"
              title="No referrals yet"
              body="Share your code on WhatsApp. Vendors who sign up with it get a discount on their first month — you get free months once 3 of them qualify."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-arctic-100/55 text-left text-xs uppercase tracking-wide text-arctic-600">
              <tr>
                <th className="px-5 py-3">Shop</th>
                <th className="px-5 py-3">Email</th>
                <th className="px-5 py-3">Joined</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-arctic-400/20">
              {referrals.map((r) => (
                <tr key={r.id}>
                  <td className="px-5 py-3 font-semibold text-arctic-900">
                    {r.referee?.shopName ?? "—"}
                  </td>
                  <td className="px-5 py-3 text-arctic-700">{r.referee?.email ?? "—"}</td>
                  <td className="px-5 py-3 text-arctic-700">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-arctic-200/65 text-arctic-800",
    qualified: "bg-emerald-100 text-emerald-700",
    rewarded: "bg-amber-100 text-amber-700",
  };
  const cls = styles[status] || "bg-arctic-200/65 text-arctic-800";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}
