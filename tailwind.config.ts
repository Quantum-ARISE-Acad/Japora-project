import type { Config } from "tailwindcss";

/**
 * Tailwind extended with the Lumière design system (Warm Stone & Gold).
 *
 * The neutral ramp (`arctic` — kept under its legacy name so ~60 files reskin
 * with zero churn) is now CHANNEL-BACKED and THEME-AWARE: each step references
 * an `--c-N` RGB-channel triple defined in src/styles/aurora.css. Under `.dark`
 * the triples are redefined as the inverted warm-charcoal ramp, so every
 * `text-arctic-900` / `bg-arctic-100` / `border-arctic-400/45` flips correctly
 * with no per-component dark: variants. Opacity modifiers keep working because
 * we emit `rgb(var(--c-N) / <alpha-value>)`.
 *
 * `brand` maps to the gold accent. Semantic `aurora-*` roles live as CSS vars
 * so retheming stays a single-file change.
 */
const ramp = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Warm-stone neutral ramp — theme-aware via --c-N channel triples.
        arctic: {
          50:  ramp("--c-50"),
          100: ramp("--c-100"),
          200: ramp("--c-200"),
          300: ramp("--c-300"),
          400: ramp("--c-400"),
          500: ramp("--c-500"),
          600: ramp("--c-600"),
          700: ramp("--c-700"),
          800: ramp("--c-800"),
          900: ramp("--c-900"),
        },
        // Antique-gold accent ramp (also channel-backed for /alpha + dark flips).
        gold: {
          DEFAULT: ramp("--gold"),
          fill:    ramp("--gold-fill"),
          deep:    ramp("--gold-deep"),
          bright:  ramp("--gold-bright"),
        },

        // Semantic roles — backed by CSS vars so they retheme cleanly.
        aurora: {
          bg:                 "var(--aurora-bg)",
          "bg-tint":          "var(--aurora-bg-tint)",
          surface:            "var(--aurora-surface)",
          "surface-strong":   "var(--aurora-surface-strong)",
          "surface-dim":      "var(--aurora-surface-dim)",
          outline:            "var(--aurora-outline)",
          "outline-strong":   "var(--aurora-outline-strong)",
          divider:            "var(--aurora-divider)",
          "on-surface":       "var(--aurora-on-surface)",
          "on-surface-muted": "var(--aurora-on-surface-muted)",
          "on-surface-subtle":"var(--aurora-on-surface-subtle)",
          primary:            "var(--aurora-primary)",
          "on-primary":       "var(--aurora-on-primary)",
          "primary-container":"var(--aurora-primary-container)",
          secondary:          "var(--aurora-secondary)",
          error:              "var(--aurora-error)",
          success:            "var(--aurora-success)",
        },

        // Legacy `brand` — now the antique-gold / café clair accent. `brand.dark` flips to a
        // brighter gold under .dark so `text-brand-dark` stays legible in both
        // themes (the channels are redefined in aurora.css).
        brand: {
          DEFAULT: ramp("--gold"),
          dark:    ramp("--gold-deep"),
          light:   ramp("--gold-bright"),
        },

        // Unified Wataru Palette Aliases
        cafe: {
          DEFAULT: ramp("--gold"),
          fill:    ramp("--gold-fill"),
          deep:    ramp("--gold-deep"),
          bright:  ramp("--gold-bright"),
        },
        soko: {
          DEFAULT: "rgb(21 83 59 / <alpha-value>)",
          deep:    "#0e3d2a",
          bright:  "#1f6e4a",
          soft:    "#e7f0eb",
        },
      },

      // M3 corner system — surfaces this in Tailwind as rounded-* shape tokens.
      borderRadius: {
        "shape-xs": "var(--aurora-shape-xs)",
        "shape-sm": "var(--aurora-shape-sm)",
        "shape-md": "var(--aurora-shape-md)",
        "shape-lg": "var(--aurora-shape-lg)",
        "shape-xl": "var(--aurora-shape-xl)",
      },

      // M3 motion — durations + easings.
      transitionTimingFunction: {
        emphasized:        "var(--aurora-ease-emphasized)",
        "emph-accelerate": "var(--aurora-ease-emph-accelerate)",
        "emph-decelerate": "var(--aurora-ease-emph-decelerate)",
        standard:          "var(--aurora-ease-standard)",
        spring:            "var(--aurora-ease-spring)",
      },
      transitionDuration: {
        instant: "100ms",
        short:   "200ms",
        medium:  "320ms",
        long:    "480ms",
      },

      // Elevation — kept low per the brief; depth comes from glass + blur.
      boxShadow: {
        "elev-0": "none",
        "elev-1": "var(--aurora-elev-1)",
        "elev-2": "var(--aurora-elev-2)",
        "elev-3": "var(--aurora-elev-3)",
      },

      // Backdrop blur intensities used by the glass layers.
      backdropBlur: {
        glass:        "18px",
        "glass-thick":"22px",
        "glass-thin": "14px",
      },

      // Aurora needs finer opacity steps for layered glass tints than the
      // default Tailwind v3 scale offers. We extend rather than replace so
      // existing /50, /60, etc still work.
      opacity: {
        15: "0.15",
        35: "0.35",
        45: "0.45",
        55: "0.55",
        62: "0.62",
        65: "0.65",
        85: "0.85",
      },

      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Editorial display face — used with restraint on display/headline only.
        display: ["var(--font-display)", "Georgia", "Cambria", "serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
