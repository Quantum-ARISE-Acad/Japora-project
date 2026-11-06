/**
 * Per-vendor UI preferences for the Aurora design system.
 *
 * Stored as JSON on Vendor.uiPrefs. We never throw on parse — bad data
 * just collapses back to defaults. Applied at runtime by setting CSS
 * custom properties on the dashboard root.
 *
 * The three sliders we expose today (each 0–100):
 *   - motion       : 0 = no motion, 50 = M3 default, 100 = double duration
 *   - density      : 0 = compact (0.9×), 50 = comfortable, 100 = spacious (1.1×)
 *   - accentShift  : 0 = cool slate, 50 = base steel-blue, 100 = warm lavender
 *
 * The shape is intentionally extensible — adding a new pref is a one-line
 * default + one new CSS var emission, no migration needed.
 */

export type UiPrefs = {
  motion?: number;
  density?: number;
  accentShift?: number;
};

export const DEFAULT_PREFS: Required<UiPrefs> = {
  motion: 50,
  density: 50,
  accentShift: 50,
};

const KEYS: (keyof UiPrefs)[] = ["motion", "density", "accentShift"];

function clampPct(n: unknown): number {
  const v = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(v)) return 50;
  return Math.max(0, Math.min(100, v));
}

/** Defensive parse: accepts raw JSON value from Prisma, returns sane prefs. */
export function parseUiPrefs(raw: unknown): Required<UiPrefs> {
  const out = { ...DEFAULT_PREFS };
  if (!raw || typeof raw !== "object") return out;
  const obj = raw as Record<string, unknown>;
  for (const k of KEYS) {
    if (k in obj) out[k] = clampPct(obj[k]);
  }
  return out;
}

/** Whitelist-validate a PATCH payload partial. */
export function validateUiPrefsPatch(input: unknown): UiPrefs | null {
  if (!input || typeof input !== "object") return null;
  const obj = input as Record<string, unknown>;
  const out: UiPrefs = {};
  for (const k of KEYS) {
    if (k in obj) out[k] = clampPct(obj[k]);
  }
  return out;
}

/**
 * Build the CSS custom-property style block for a set of prefs. Spread into
 * `style={...}` on the dashboard root container — children inherit.
 */
export function uiPrefsToCssVars(prefs: Required<UiPrefs>): Record<string, string> {
  // Motion: map 0–100 to a 0×–2× multiplier on the standard duration tokens.
  const motionMult = prefs.motion / 50; // 0..2
  // Density: map 0–100 to a 0.85×–1.15× spacing multiplier.
  const densityMult = 0.85 + (prefs.density / 100) * 0.3;
  // Accent shift: map 0–100 to a -25°…+25° hue rotation on the steel-blue accent.
  const hueShift = ((prefs.accentShift - 50) / 50) * 25;

  return {
    ["--aurora-dur-short"]: `${Math.max(1, Math.round(200 * motionMult))}ms`,
    ["--aurora-dur-medium"]: `${Math.max(1, Math.round(320 * motionMult))}ms`,
    ["--aurora-dur-long"]: `${Math.max(1, Math.round(480 * motionMult))}ms`,
    ["--aurora-density"]: `${densityMult}`,
    ["--aurora-accent-hue"]: `${hueShift}deg`,
  } as Record<string, string>;
}
