"use client";

import { useEffect, useMemo, useState } from "react";
import { AuroraSlider } from "@/components/aurora";
import {
  DEFAULT_PREFS,
  parseUiPrefs,
  uiPrefsToCssVars,
  type UiPrefs,
} from "@/lib/uiPrefs";

/**
 * Settings sub-card: vendor-controlled Aurora customization.
 *
 * Three sliders + a live preview card whose look reacts to the slider
 * positions in real time (via CSS custom properties — no re-render). Save
 * persists the prefs to Vendor.uiPrefs via PATCH /api/settings.
 *
 * UX notes:
 *  - "Save" is explicit so accidental drags don't pin a bad state.
 *  - "Reset" returns to the M3 baseline (50/50/50).
 *  - The live preview is small but uses the same animations as the rest of
 *    the app so the vendor can FEEL the changes, not just see numbers.
 */

type Props = {
  initial: unknown; // raw vendor.uiPrefs from Prisma
};

export default function AuroraCustomization({ initial }: Props) {
  const initialPrefs = useMemo(() => parseUiPrefs(initial), [initial]);
  const [prefs, setPrefs] = useState(initialPrefs);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState("");

  // Detect drift so the Save button only highlights when meaningful.
  const dirty =
    prefs.motion !== initialPrefs.motion ||
    prefs.density !== initialPrefs.density ||
    prefs.accentShift !== initialPrefs.accentShift;

  // Hide the "Saved" badge after a beat.
  useEffect(() => {
    if (!savedAt) return;
    const t = setTimeout(() => setSavedAt(null), 2000);
    return () => clearTimeout(t);
  }, [savedAt]);

  const previewStyle = uiPrefsToCssVars(prefs) as React.CSSProperties;

  function update<K extends keyof UiPrefs>(key: K, v: number) {
    setPrefs((p) => ({ ...p, [key]: v }));
  }

  async function save() {
    setSaving(true);
    setError("");
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uiPrefs: prefs }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save preferences.");
      return;
    }
    setSavedAt(Date.now());
    // Apply locally so the dashboard updates without a hard refresh.
    Object.entries(uiPrefsToCssVars(prefs)).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v),
    );
  }

  function reset() {
    setPrefs(DEFAULT_PREFS);
  }

  return (
    <div className="glass glass-edge rounded-shape-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="a-title-lg text-arctic-900">Customize the feel</h2>
          <p className="a-body-md mt-1 text-arctic-700">
            Tune the motion, density, and accent of your dashboard. The preview
            below reacts as you drag.
          </p>
        </div>
        {savedAt && (
          <span className="rounded-shape-full border border-arctic-400/45 bg-arctic-200/70 px-2 py-0.5 a-label-md text-arctic-900 backdrop-blur-glass-thin">
            ✓ Saved
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,260px]">
        {/* Sliders */}
        <div className="space-y-5">
          <AuroraSlider
            label="Motion intensity"
            value={prefs.motion}
            onChange={(e) => update("motion", Number(e.currentTarget.value))}
            formatValue={(v) =>
              v < 25 ? "Calm" : v < 75 ? "Balanced" : "Expressive"
            }
          />
          <AuroraSlider
            label="Density"
            value={prefs.density}
            onChange={(e) => update("density", Number(e.currentTarget.value))}
            formatValue={(v) =>
              v < 35 ? "Compact" : v < 65 ? "Comfortable" : "Spacious"
            }
          />
          <AuroraSlider
            label="Accent shift"
            value={prefs.accentShift}
            onChange={(e) => update("accentShift", Number(e.currentTarget.value))}
            formatValue={(v) => {
              const shift = (v - 50) / 50;
              if (shift < -0.5) return "Cooler";
              if (shift > 0.5) return "Warmer";
              return "Base";
            }}
          />

          {error && (
            <p className="rounded-shape-md border border-red-200/70 bg-red-50/80 px-3 py-2 a-body-sm text-red-700 backdrop-blur-glass-thin">
              {error}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving || !dirty}
              className="btn-primary"
            >
              {saving ? "Saving…" : "Save preferences"}
            </button>
            <button onClick={reset} disabled={saving} className="btn-ghost">
              Reset to default
            </button>
          </div>
        </div>

        {/* Live preview */}
        <aside className="glass glass-edge rounded-shape-lg p-4" style={previewStyle}>
          <div className="a-label-md mb-3 text-arctic-700">Live preview</div>
          <div
            className="space-y-3"
            style={{
              // The accent shift translates to a hue rotation on a tinted band.
              filter: "hue-rotate(var(--aurora-accent-hue, 0deg))",
            }}
          >
            <div
              className="rounded-shape-md border border-arctic-400/40 bg-arctic-200/55 backdrop-blur-glass-thin"
              style={{
                padding: `calc(0.9rem * var(--aurora-density, 1))`,
              }}
            >
              <div className="a-label-md text-arctic-700">Today</div>
              <div className="a-display-sm text-arctic-900">₦42,000</div>
            </div>
            <button
              className="btn-primary w-full"
              style={{
                // M3-Expressive duration token — uses the user's chosen multiplier.
                transitionDuration: "var(--aurora-dur-short)",
              }}
              onClick={(e) => e.preventDefault()}
            >
              Sample action
            </button>
            <div className="grid grid-cols-3 gap-2">
              {["New", "Paid", "Sent"].map((k, i) => (
                <span
                  key={k}
                  className={
                    "rounded-shape-sm border px-2 py-1 text-center a-label-md " +
                    (i === 1
                      ? "border-arctic-800 bg-arctic-800 text-arctic-50"
                      : "border-arctic-400/40 bg-white/65 text-arctic-800")
                  }
                >
                  {k}
                </span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
