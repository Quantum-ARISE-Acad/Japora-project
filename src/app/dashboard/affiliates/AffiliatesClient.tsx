"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/lib/utils";
import { AuroraIsoscout } from "@/components/aurora";

type Affiliate = {
  id: string;
  code: string;
  name: string;
  commissionPct: number;
  totalEarnedCents: number;
  sumCommissionCents: number;
  attributionCount: number;
  createdAt: string;
};

const EMPTY = { code: "", name: "", commissionPct: "10" };

export default function AffiliatesClient({
  initialAffiliates,
  currency,
}: {
  initialAffiliates: Affiliate[];
  currency: string;
}) {
  const router = useRouter();
  const [affiliates, setAffiliates] = useState<Affiliate[]>(initialAffiliates);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function reload() {
    const res = await fetch("/api/affiliate");
    if (res.ok) {
      const data = await res.json();
      setAffiliates(
        (data.affiliates as Array<Record<string, unknown>>).map((a) => ({
          id: a.id as string,
          code: a.code as string,
          name: a.name as string,
          commissionPct: a.commissionPct as number,
          totalEarnedCents: (a.totalEarnedCents as number) ?? 0,
          sumCommissionCents: (a.sumCommissionCents as number) ?? 0,
          attributionCount: (a.attributionCount as number) ?? 0,
          createdAt: String(a.createdAt),
        })),
      );
    }
    router.refresh();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const pctNum = parseFloat(form.commissionPct);
      const res = await fetch("/api/affiliate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.code,
          name: form.name,
          commissionPct: Number.isFinite(pctNum) ? pctNum / 100 : 0.1,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Could not create affiliate.");
        return;
      }
      setForm(EMPTY);
      await reload();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Remove this affiliate code? Past attributions are kept.")) return;
    const res = await fetch(`/api/affiliate/${id}`, { method: "DELETE" });
    if (res.ok) await reload();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="a-headline-md text-arctic-900">Affiliates</h1>
        <p className="text-sm text-arctic-600">
          Give influencers and resellers a code. They share; you pay commission only on
          paid orders.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-3 p-5">
        <h2 className="text-sm font-semibold text-arctic-900">New affiliate code</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="text-arctic-800">Code</span>
            <input
              type="text"
              required
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s+/g, "") })
              }
              placeholder="AMARA10"
              maxLength={32}
              className="mt-1 w-full rounded-lg border border-arctic-400/45 px-3 py-2 text-sm uppercase"
            />
          </label>
          <label className="block text-sm">
            <span className="text-arctic-800">Partner name</span>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Amara on IG"
              className="mt-1 w-full rounded-lg border border-arctic-400/45 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="text-arctic-800">Commission %</span>
            <input
              type="number"
              min="0"
              max="50"
              step="0.5"
              value={form.commissionPct}
              onChange={(e) => setForm({ ...form, commissionPct: e.target.value })}
              className="mt-1 w-full rounded-lg border border-arctic-400/45 px-3 py-2 text-sm"
            />
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Create code"}
        </button>
      </form>

      <div className="card overflow-hidden">
        <div className="border-b border-arctic-400/30 px-5 py-3">
          <h2 className="text-sm font-semibold text-arctic-900">Your codes</h2>
        </div>
        {affiliates.length === 0 ? (
          <div className="p-2">
            <AuroraIsoscout
              compact
              variant="broadcasts"
              title="No affiliate codes yet"
              body="Give an influencer their own code (e.g. STYLEBYAMA). When customers use it, a slice of the order automatically tracks back to them."
            />
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-arctic-100/55 text-left text-xs uppercase tracking-wide text-arctic-600">
              <tr>
                <th className="px-5 py-3">Code</th>
                <th className="px-5 py-3">Partner</th>
                <th className="px-5 py-3">Rate</th>
                <th className="px-5 py-3">Orders</th>
                <th className="px-5 py-3">Earned</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-arctic-400/20">
              {affiliates.map((a) => (
                <tr key={a.id}>
                  <td className="px-5 py-3 font-mono font-semibold text-arctic-900">{a.code}</td>
                  <td className="px-5 py-3 text-arctic-800">{a.name}</td>
                  <td className="px-5 py-3 text-arctic-800">{(a.commissionPct * 100).toFixed(1)}%</td>
                  <td className="px-5 py-3 text-arctic-800">{a.attributionCount}</td>
                  <td className="px-5 py-3 font-semibold text-arctic-900">
                    {formatMoney(a.sumCommissionCents, currency)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => remove(a.id)}
                      className="text-xs font-semibold text-red-600 hover:underline"
                    >
                      Remove
                    </button>
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
