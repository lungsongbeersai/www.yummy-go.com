# Design

Supersedes the old `docs/design-system.md` (merged in here; that file has been removed).

## Sources of truth

- `components.json` — shadcn CLI config. Style preset `radix-mira`, base color `mist`, icon library `lucide`, RSC on. `tailwind.config` is intentionally empty — Tailwind v4 is CSS-config only.
- `src/app/globals.css` — every semantic color, radius, and chart token, in `:root` (light) and `.dark`, plus an `@theme inline` block that maps them to Tailwind utilities. This file is the only place a color value may be defined.
- `src/design-system/config.ts` — the two supported theme modes and the approved font variable names.
- `src/design-system/fonts.ts` — the `next/font` declarations the root layout applies.

## Component decision order

1. Use an existing shadcn/ui component and its documented variants/props.
2. Compose existing shadcn/ui components before adding new markup or styles.
3. Use semantic Tailwind utilities only for layout, responsive behavior, or composition shadcn doesn't provide.
4. Add a shared component or a new shadcn variant once a pattern repeats.
5. Add scoped custom CSS only when a platform, print, motion, or browser limitation genuinely requires it.

Feature code must not use raw palette colors (`bg-[#...]`, `text-emerald-500`, etc.), arbitrary font families, or new global CSS. Every one of those is a value the dark-mode theme in `globals.css` doesn't know about.

## Installed primitives (`src/components/ui/`)

accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, chart, checkbox, command, dialog, drawer, dropdown-menu, empty, field, input, input-group, label, pagination, popover, progress, radio-group, select, separator, sheet, sidebar, skeleton, slider, sonner, spinner, switch, table, tabs, textarea, toggle, toggle-group, tooltip.

Check this list before hand-rolling anything — most UI needs are already here. Install more with:

```bash
npx shadcn@latest add <component>   # no args: list what's available
npx shadcn@latest search
npx shadcn@latest docs <component>
```

The CLI writes into `src/components/ui/`. Use `--dry-run --diff` before updating a component that's been locally customized.

## State, empty, loading, error presentation

Verified in active use across `src/features/`:

- **Loading** — `skeleton.tsx`. Skip spinners for content placeholders; skeletons hold layout and avoid content jump.
- **Empty** — `empty.tsx` (used in settings, category picker, cart, table actions). Don't hand-roll a "no data" `<div>`.
- **Inline error / info** — `alert.tsx`.
- **Async success/failure toast** — `sonner.tsx`, dispatched through `src/stores/toast-store.ts` — components call the store, not `sonner` directly, so toast triggering stays testable with the rest of store logic.
- **Destructive confirmation** — `alert-dialog.tsx`, required before any delete/cancel/void action (see CLAUDE.md Non-negotiables). Confirmed real usage: sales credit, cancel-sale, printer form, cart, table actions.

## Typography

Fonts load through `next/font` in `src/design-system/fonts.ts`. `font-sans` is the default typeface; `font-lao` is required wherever Lao text must render explicitly (Lao is the app's primary language — do not assume Latin-only fallback is acceptable).

## Theme tokens

Use semantic tokens: `bg-primary`, `text-muted-foreground`, `border-border`, `bg-destructive`, etc. To change the visual theme, edit the light/dark CSS variables in `globals.css` — never hard-code a color in a feature component. `--warning`, `--success`, `--info`, `--pending` (plus their `-foreground` pairs) exist alongside the standard shadcn palette for POS-specific status states (order/table/print states); prefer them over ad hoc color choices for status badges.

## Responsive breakpoints

No custom breakpoints are defined anywhere in the repo (`components.json` has no `tailwind.config`, and `globals.css`'s `@theme inline` block doesn't override `--breakpoint-*`) — Tailwind v4's default scale (`sm` 40rem, `md` 48rem, `lg` 64rem, `xl` 80rem, `2xl` 96rem) applies as-is. Don't introduce a one-off breakpoint in a feature file; if the default scale genuinely doesn't fit, add it to `globals.css`'s `@theme` block so it's shared.

## Accessibility floor

`TODO(owner): confirm` — no repo-enforced contrast ratio, focus-ring, or touch-target policy was found (no linter rule, no design token comment states one). Until confirmed, hold every new/changed UI to WCAG 2.1 AA as a floor:

- Text contrast ≥ 4.5:1 (≥ 3:1 for text ≥ 24px / 19px bold).
- Every interactive element has a visible focus state — shadcn/ui's `ring` utilities provide this by default; don't suppress `outline`/`ring` without replacing it.
- Full keyboard operability for any flow a mouse/touch user has (this is a POS — a cashier may be using a barcode-scanner keyboard wedge or a hardware keypad).
- Touch targets sized for a tablet/POS terminal, not just desktop — verify by hand on the actual target device class, since no repo token currently encodes this.

## Safe shadcn preset changes

Inspect the current and incoming preset before changing visual foundations:

```bash
pnpm dlx shadcn@latest apply --preset <preset-code> --only theme,font
```

A full `apply` (not `--only theme,font`) can overwrite local component customizations and change their APIs — treat it as an approved migration, not a visual tweak: diff review + a clean `npm run typecheck` required before acceptance.

## Allowed CSS exceptions

Android WebView compatibility, native touch-target behavior, print styles, and reduced-motion support are the accepted reasons for scoped custom CSS outside `globals.css`'s token system. `src/features/public-pos/order/nightfall.css` (imported directly into `globals.css` — see the comment there on why Tailwind v4 requires that) is the current example of a feature-scoped stylesheet; keep any new one equally scoped and document why shadcn/Tailwind couldn't express it.
