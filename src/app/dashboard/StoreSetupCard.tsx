"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CATEGORIES,
  REGIONS,
  getStoreSetupStatus,
  isPlaceholderShopName,
  normalizeWhatsAppNumber,
  validateStoreSetupInput,
  type StoreSetupCandidate,
} from "@/lib/onboarding";
import Glyph from "@/components/Glyph";

const REGIONS_BY_COUNTRY = REGIONS.reduce<Record<string, typeof REGIONS>>(
  (acc, r) => {
    (acc[r.country] ||= []).push(r);
    return acc;
  },
  {},
);

export default function StoreSetupCard({
  initial,
}: {
  initial: Required<StoreSetupCandidate>;
}) {
  const router = useRouter();
  const initialStatus = getStoreSetupStatus(initial);

  const [completed, setCompleted] = useState(initialStatus.complete);
  const [shopName, setShopName] = useState(
    isPlaceholderShopName(initial.shopName) ? "" : (initial.shopName ?? ""),
  );
  const [whatsappNumber, setWhatsappNumber] = useState(() => {
    const wa = normalizeWhatsAppNumber(initial.whatsappNumber);
    return wa.valid ? wa.e164 : (initial.whatsappNumber ?? "");
  });
  const [region, setRegion] = useState(initial.region ?? "");
  const [category, setCategory] = useState(initial.category ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (completed) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    const validation = validateStoreSetupInput({
      shopName,
      whatsappNumber,
      region,
      category,
    });

    if (!validation.ok) {
      setError(validation.error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopName: validation.payload.shopName,
          whatsappNumber: validation.payload.whatsappNumber,
          region: validation.payload.region,
          category: validation.payload.category,
          isPublic: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not save store setup. Please try again.");
        setSaving(false);
        return;
      }

      setCompleted(true);
      setSaving(false);
      router.refresh();
    } catch {
      setError("Network error while saving store setup. Please try again.");
      setSaving(false);
    }
  }

  return (
    <section
      aria-label="Store Setup Onboarding"
      className="glass glass-edge rounded-shape-lg border-2 border-brand/40 bg-brand/5 p-6 shadow-sm"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-shape-full bg-brand/15 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
            <Glyph name="sparkle" size={13} /> Action Required · Store Setup
          </div>
          <h2 className="a-title-lg mt-2 text-arctic-900">
            Complete your store setup to go live on the Marketplace
          </h2>
          <p className="a-body-md mt-1 text-arctic-700">
            Add your shop details below so buyers can discover your store on{" "}
            <span className="font-semibold">/marketplace</span> and send you orders on WhatsApp.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="onboarding-shop-name" className="label">
              Shop Name
            </label>
            <input
              id="onboarding-shop-name"
              className="input"
              type="text"
              placeholder="e.g. Amina Boutique Lomé"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="onboarding-whatsapp" className="label">
              WhatsApp Number
            </label>
            <input
              id="onboarding-whatsapp"
              className="input"
              type="tel"
              inputMode="tel"
              placeholder="e.g. +22890123456"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              required
            />
            <p className="mt-1 text-xs text-arctic-600">
              Include country code (e.g. +228 for Togo, +234 for Nigeria).
            </p>
          </div>

          <div>
            <label htmlFor="onboarding-region" className="label">
              Region
            </label>
            <select
              id="onboarding-region"
              className="input"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              required
            >
              <option value="">— Select your region —</option>
              {Object.entries(REGIONS_BY_COUNTRY).map(([country, list]) => (
                <optgroup key={country} label={country}>
                  {list.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="onboarding-category" className="label">
              Category
            </label>
            <select
              id="onboarding-category"
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="">— Select your category —</option>
              {CATEGORIES.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.icon} {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-shape-md border border-red-300 bg-red-50 px-3.5 py-2.5 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <div className="flex items-center justify-end pt-1">
          <button type="submit" className="btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Complete Store Setup"}
          </button>
        </div>
      </form>
    </section>
  );
}
