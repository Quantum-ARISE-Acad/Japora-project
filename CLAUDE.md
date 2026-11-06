# Japora — project guide for Claude

WhatsApp-first commerce OS for African micro-vendors (Togo-first). Next.js 15 (App
Router) · React 19 · TS strict · Tailwind v3 · Prisma 6 / Postgres. Stub-first
integrations (work with no external keys; flip live when env present).

Run: `pnpm dev` (port 5174) · DB: docker `wcatalog-db` (colima). Tests:
`node --import tsx --test tests/*.test.ts`. Migrations are hand-written
(`prisma/migrations/<ts>_name/migration.sql` → `pnpm exec prisma migrate deploy`).

---

# Design system — "Lumière" (Warm Stone & Gold)

The house style is **editorial quiet-luxury**: warm porcelain canvas, near-black
ink, a single antique-gold accent used with restraint, Playfair Display for
display/headlines, Inter for everything else. Signature device: **the ledger** —
money/ERP figures sit in tabular figures on a gold hairline, commerce rendered as
a refined account book.

This section is installed from and governed by these design skills — **use them**:
`ui-ux-pro-max`, `frontend-design`, plus the synthesized rules from
`jiji262/claude-design-skill` and `wilwaldon/Claude-Code-Frontend-Design-Toolkit`.
When doing any UI work, invoke `ui-ux-pro-max` and `frontend-design` first.

## Non-negotiable rules (from the skills)

1. **Tokens, never hardcode.** No raw hex in components. Use the neutral ramp
   (`arctic-50…900` — kept under the legacy name; it is the warm-stone ramp) and
   the gold accent (`brand` / `gold`). Both are channel-backed CSS vars in
   `src/styles/aurora.css`, so opacity modifiers (`/45`) and dark mode work.
2. **One source of truth.** Retheme by editing `--c-*` / `--gold*` / `--aurora-*`
   in `aurora.css` and the Tailwind map in `tailwind.config.ts` — nowhere else.
3. **Theme-aware by construction.** The ramp INVERTS under `.dark` (index 50↔900),
   so `text-arctic-900` / `bg-arctic-100` / `border-arctic-400/45` flip with no
   per-component `dark:` variants. New surfaces must use ramp/semantic tokens (or
   `var(--aurora-surface)` / `var(--glass-border)`), never literal `bg-white`.
4. **Accessibility is priority #1** (ui-ux-pro-max §1): contrast ≥4.5:1 body /
   3:1 large, in BOTH themes; visible focus (we ship a global gold focus-visible
   ring); keyboard nav; labels on icon-only buttons; `color-not-only`.
5. **Touch & targets** (§2, Fitts): interactive targets ≥44px; ≥8px spacing.
6. **No emoji as icons.** SVG only (the shell ships an inline stroke set). Emoji
   in legacy copy is being removed — don't add more.
7. **Motion is information** (§7): 150–300ms, transform/opacity only, spring
   easing tokens, `prefers-reduced-motion` respected (already global). Animate
   1–2 elements per view; restraint over decoration.
8. **Anti-slop** (claude-design-skill): no aggressive gradients, no gradient
   "AI orbs", no emoji bullets, no fake CSS product silhouettes. Spend boldness
   in ONE place (the ledger); keep everything else quiet (Chanel: remove one
   accessory before shipping).
9. **Aesthetic direction first** (frontend-design / toolkit): commit to the
   declared system before pixels; structure encodes meaning (eyebrows = real
   sections, not decoration); copy is design material — active voice, sentence
   case, name things by what the user controls.
10. **Verify visually**: generate → browser screenshot → a11y/contrast → motion.
    Test 375 / 768 / 1024 / 1440 and dark mode independently.

## Tokens (the contract)

- Neutral ramp: `arctic-50` porcelain `#FAFAF9` → `arctic-900` ink `#1C1917`
  (inverts under `.dark`). Use for surfaces, text, borders.
- Accent (gold): `brand` `#A16207` · `brand-dark` `#7A4E06` (gold text on light;
  brightens in dark) · `gold-fill` `#8B5E0A` (AA white text) · `gold-bright`
  `#D8A24A` (dark-mode accent). Gold is for emphasis ONLY: active nav, links,
  KPIs/prices, eyebrows, the ledger hairline, focus.
- Semantic: `--aurora-primary` = ink (primary action), `--aurora-surface`,
  `--glass-border`, `--aurora-on-surface[-muted|-subtle]`, `--signal-live`
  (WhatsApp-green, used ONLY as a live/online dot — not brand).
- Type: `font-display` (Playfair) on `.a-display-*` / `.a-headline-*` only;
  `font-sans` (Inter) elsewhere. Scale + utilities in `aurora.css`.
- Signature utilities: `.a-num` (tabular figures — use on all money/data),
  `.a-eyebrow` (gold tracked label), `.a-rule-gold` (hairline), `.a-ledger`.

## Component conventions

- Primary CTA = ink: `.btn-primary` (or Aurora `.a-btn--filled`). Accent/positive
  fill = gold: `bg-brand text-white`. Accent text = `text-brand-dark`.
- Cards/inputs/buttons: the bridge classes (`.card .btn .btn-ghost .input
  .label`) are theme-aware — prefer them or the `src/components/aurora/`
  primitives. Glass via `.glass` / `.glass-strong` + `.glass-edge`.
- Money always uses `.a-num` + `formatMoney()` (XOF is zero-decimal — see
  `src/lib/currency.ts`).

## Dashboard (the "orchestrator")

`DashboardShell` is the one shell for every dashboard page. It fixes the classic
ERP pains: **grouped adaptive sidebar** (desktop) / off-canvas drawer (mobile)
with destinations grouped by job (Sell / Money / Grow — Miller's law ≤4/group);
**global command palette** (⌘K) for search-and-jump; one clear gold active rail;
persistent page identity + theme toggle in the top bar. Keep nav stable across
pages; one primary action per screen; skeletons over spinners; empty states
invite action.

## Dark mode

Class strategy (`darkMode: "class"`). No-FOUC script in `layout.tsx` sets `.dark`
before paint from `localStorage('japora-theme')` / cookie / system. `ThemeToggle`
flips + persists. Always check dark contrast independently — don't infer from
light. Bespoke pages (e.g. the marketing landing) need hand-tuned dark variants;
token-driven pages flip automatically.
