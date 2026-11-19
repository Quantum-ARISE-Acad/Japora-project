"use client";

import { useEffect, useMemo, useState } from "react";
import { AuroraSlider } from "@/components/aurora";
import {
  DEFAULT_PREFS,
  parseUiPrefs,
  uiPrefsToCssVars,
  type UiPrefs,
} from "@/lib/uiPrefs";
import { usePublicLang } from "@/components/PublicLanguageProvider";

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
  currency: string;
};

export default function AuroraCustomization({ initial, currency }: Props) {
  const { tr } = usePublicLang();
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
      setError(data.error || tr("Impossible d'enregistrer les préférences.", "Could not save preferences."));
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
          <h2 className="a-title-lg text-arctic-900">{tr("Personnaliser l’apparence", "Customize the look")}</h2>
          <p className="a-body-md mt-1 text-arctic-700">
            {tr("Réglez l’animation, la densité et la couleur du tableau de bord. L’aperçu réagit pendant le réglage.", "Adjust the dashboard's animation, density and colour. The preview reacts while you adjust.")}
          </p>
        </div>
        {savedAt && (
          <span className="rounded-shape-full border border-arctic-400/45 bg-arctic-200/70 px-2 py-0.5 a-label-md text-arctic-900 backdrop-blur-glass-thin">
            {tr("✓ Enregistré", "✓ Saved")}
          </span>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr,260px]">
        {/* Sliders */}
        <div className="space-y-5">
          <AuroraSlider
            label={tr("Intensité des animations", "Animation intensity")}
            value={prefs.motion}
            onChange={(e) => update("motion", Number(e.currentTarget.value))}
            formatValue={(v) =>
              v < 25 ? "Calme" : v < 75 ? "Équilibrée" : "Dynamique"
            }
          />
          <AuroraSlider
            label={tr("Densité", "Density")}
            value={prefs.density}
            onChange={(e) => update("density", Number(e.currentTarget.value))}
            formatValue={(v) =>
              v < 35 ? "Compacte" : v < 65 ? "Confortable" : "Aérée"
            }
          />
          <AuroraSlider
            label={tr("Teinte d’accent", "Accent hue")}
            value={prefs.accentShift}
            onChange={(e) => update("accentShift", Number(e.currentTarget.value))}
            formatValue={(v) => {
              const shift = (v - 50) / 50;
              if (shift < -0.5) return "Plus froide";
              if (shift > 0.5) return "Plus chaude";
              return "Neutre";
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
              {saving ? tr("Enregistrement…", "Saving…") : tr("Enregistrer les préférences", "Save preferences")}
            </button>
            <button onClick={reset} disabled={saving} className="btn-ghost">
              {tr("Rétablir les valeurs par défaut", "Restore defaults")}
            </button>
          </div>
        </div>

        {/* Aperçu en direct — exemple fictif */}
        <aside className="glass glass-edge rounded-shape-lg p-4" style={previewStyle}>
          <div className="a-label-md mb-3 text-arctic-700">{tr("Aperçu en direct — exemple fictif", "Live preview — sample data")}</div>
          <div
            className="space-y-3"
            style={{
              filter: "hue-rotate(var(--aurora-accent-hue, 0deg))",
            }}
          >
            <div
              className="rounded-shape-md border border-arctic-400/40 bg-arctic-200/75 backdrop-blur-glass-thin"
              style={{
                padding: `calc(0.9rem * var(--aurora-density, 1))`,
              }}
            >
              <div className="a-label-md text-arctic-800">{tr("Aujourd’hui — exemple", "Today — sample")}</div>
              <div className="a-display-sm text-arctic-900">{currency} 42 000</div>
            </div>
            <button
              className="btn-primary w-full"
              style={{
                transitionDuration: "var(--aurora-dur-short)",
              }}
              onClick={(e) => e.preventDefault()}
            >
              {tr("Action d’exemple", "Sample action")}
            </button>
            <div className="grid grid-cols-3 gap-2">
              {["Nouveau", "Payé", "Envoyé"].map((k, i) => (
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
