# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Soko Lumière
**Category:** E-commerce Luxury — "editorial quiet-luxury / the ledger"

> **Canonical source:** the implemented contract lives in this design system (tokens,
> theme-aware ramp, dark mode, signature utilities). This file mirrors it for the
> the design-system hierarchy; on conflict, this document wins.
>
> **Key implementation facts the generic generator gets wrong:**
> - **Primary action = INK** (`bg-arctic-800` / `--aurora-primary`), NOT gold.
>   Gold (`brand` `#A16207`) is the single ACCENT — KPIs, prices, links, active
>   nav, eyebrows, the ledger hairline, focus ring. Spend boldness in one place.
> - **Theme-aware by construction:** the neutral ramp is channel-backed CSS vars
>   that INVERT under `.dark` (index 50↔900), so `arctic-*` utilities flip with
>   no per-component `dark:` variants. Build light + dark together; verify both.
> - **Signature — "the ledger":** money/data uses `.a-num` (tabular figures) on a
>   gold hairline; `.a-eyebrow` = gold tracked section labels.
> - Display/headlines use Playfair (`.a-display-*` / `.a-headline-*`); everything
>   else is Inter. Glass is restrained (not full "Liquid Glass").

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#1C1917` | `--color-primary` |
| On Primary | `#FFFFFF` | `--color-on-primary` |
| Secondary | `#44403C` | `--color-secondary` |
| Accent/CTA | `#A16207` | `--color-accent` |
| Background | `#FAFAF9` | `--color-background` |
| Foreground | `#0C0A09` | `--color-foreground` |
| Muted | `#E8ECF0` | `--color-muted` |
| Border | `#D6D3D1` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| Ring | `#1C1917` | `--color-ring` |

**Color Notes:** Premium dark + gold accent [Accent adjusted from #CA8A04 for WCAG 3:1]

### Typography

- **Heading Font:** Playfair Display
- **Body Font:** Inter
- **Mood:** elegant, luxury, sophisticated, timeless, premium, editorial
- **Google Fonts:** [Playfair Display + Inter](https://fonts.google.com/share?selection.family=Inter:wght@300;400;500;600;700|Playfair+Display:wght@400;500;600;700)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

Use the theme-aware bridge classes (`.btn-primary`, `.btn-ghost`) — these are
the real, dark-mode-correct definitions (see `src/app/globals.css`). The CSS
below shows the *intent*; the implementation uses ramp/semantic tokens, not raw
hex, so it flips under `.dark`.

```css
/* Primary action = INK (quiet-luxury). Inverts to a light pill in dark mode. */
.btn-primary {
  background: rgb(var(--c-800));   /* warm ink */
  color: rgb(var(--c-50));         /* porcelain */
  min-height: 44px;                /* Fitts / WCAG 2.5.5 */
  padding: 0 24px;
  border-radius: 9999px;
  font-weight: 600;
  transition: all 200ms var(--aurora-ease-spring);
}
.btn-primary:hover { background: rgb(var(--c-900)); transform: translateY(-1px); }

/* Accent fill = GOLD (secondary/positive actions). White text is AA (4.9:1). */
.btn-accent { background: rgb(var(--gold)); color: #fff; }

/* Ghost = theme-aware glass surface + warm hairline. */
.btn-ghost {
  background: var(--aurora-surface);
  border: 1px solid rgb(var(--c-400) / 0.5);
  color: rgb(var(--c-900));
}
```

### Cards

```css
.card {
  background: #FAFAF9;
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
  transition: all 200ms ease;
  cursor: pointer;
}

.card:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid #E2E8F0;
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #1C1917;
  outline: none;
  box-shadow: 0 0 0 3px #1C191720;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Editorial quiet-luxury — restrained glass + the ledger.

**Keywords:** warm porcelain canvas, near-black ink, single antique-gold accent
used sparingly, Playfair display + Inter body, tabular ledger figures on gold
hairlines, calm whitespace, "remove one accessory before shipping."

**Best For:** premium commerce, editorial brands, high-end e-commerce.

**Key Effects:** restrained glass (`.glass` + `.glass-edge`, ~18px blur — NOT
heavy "liquid glass"); spring micro-interactions 150–300ms, transform/opacity
only; `prefers-reduced-motion` respected; depth from light + tint, not shadow.

### Page Pattern

**Pattern Name:** Feature-Rich Showcase

- **CTA Placement:** Above fold
- **Section Order:** Hero > Features > CTA

---

## Anti-Patterns (Do NOT Use)

- ❌ Vibrant & Block-based
- ❌ Playful colors

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Text contrast 4.5:1 minimum in BOTH light AND dark (verify independently)
- [ ] No literal `bg-white` / `slate-*` / cool literals — use ramp/semantic tokens
- [ ] Money/data uses `.a-num` (tabular figures); sections use `.a-eyebrow`
- [ ] Visible gold focus-visible ring for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile
