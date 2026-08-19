# Dashboard CSS → shadcn/Tailwind Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate `src/features/dashboard/overview/dashboard.css` (809 lines of hand-written CSS) by replacing every class it defines with shadcn components + Tailwind utility classes, so the dashboard overview page follows the same "shadcn/Tailwind first, no custom CSS unless necessary" rule as the rest of the app.

**Architecture:** No component behavior changes — this is a pure styling migration across 3 files (`dashboard-widgets.tsx`, `dashboard-chart-widgets.tsx`, `dashboard-page.tsx`) plus `src/app/globals.css` (adds two new semantic design tokens) and deletion of `dashboard.css`. Each task converts one visual section, deletes the CSS rules that section used, and is independently committable/testable — no task depends on a later task's code, only on tokens added in Task 1.

**Tech Stack:** Next.js 16 App Router, Tailwind CSS v4 (`@theme inline` tokens, native `@container` query support, native `bg-gradient-to-*` utilities), shadcn/ui local primitives (`src/components/ui/`), TypeScript.

## Global Constraints

- Never introduce a new UI library or a second styling system — shadcn/ui + Tailwind only (CLAUDE.md).
- Never add raw colors or arbitrary values without a platform/print/motion/browser limitation (CLAUDE.md). New colors must go through `@theme inline` tokens in `src/app/globals.css`, not inline hex/oklch.
- Preserve dark mode in everything touched (CLAUDE.md).
- No component/UI test suite exists in this repo (`npm test` only covers `src/**/*.test.ts` pure logic — see CLAUDE.md "Tests are colocated... not components"). Verification for every task in this plan is **`npx tsc --noEmit`** (must pass with zero errors) **+ a manual visual check** (dev server, compare before/after screenshot in both light and dark mode) — not automated tests. Steps below say "Verify" instead of "Write failing test" for this reason.
- User-approved decisions locked in for this plan (do not re-litigate):
  1. New tokens (hero gradient, warning/amber) go into the real design system (`globals.css` `:root`/`.dark`/`@theme inline`), not one-off custom CSS.
  2. Minor visual adjustments toward standard shadcn spacing/breakpoints are acceptable — pixel-perfect parity is not required.
  3. Ship as separate, independently reviewable commits per page section (this plan's task boundaries = commit boundaries).
- Filter bar button/select heights were already fixed in a prior session (removed `size="sm"` overrides, removed `.dashboard-filter-actions button { height: 2rem }`) — do not re-touch that specific fix.

---

## File Structure

| File | Responsibility after migration |
|---|---|
| `src/app/globals.css` | Gains `--warning`/`--warning-foreground` tokens (Task 1). Loses the dead, unused `.dashboard-warning-panel` block (Task 1). |
| `src/features/dashboard/overview/dashboard.css` | Shrinks task-by-task as each section is converted; deleted entirely in Task 9. |
| `src/features/dashboard/overview/dashboard-page.tsx` | Root wrapper classes converted in Task 9; drops the `dashboard.css` import there. |
| `src/features/dashboard/overview/components/dashboard-widgets.tsx` | Header, filter bar, payment summary strip, warning banner, query bar, hero strip, chart-fallback skeletons, footer — converted in Tasks 2–5. |
| `src/features/dashboard/overview/components/dashboard-chart-widgets.tsx` | Revenue/accounting grid, operations grid (channel donut, table status, insights), products/pareto grid — converted in Tasks 6–8. |

No new files are created. No files are split (each existing file stays under the size where splitting would help, per CLAUDE.md "follow established patterns").

---

### Task 1: Add `--warning` design token; delete dead CSS

**Files:**
- Modify: `src/app/globals.css:10-46` (`:root`), `:48-82` (`.dark`), `:84-128` (`@theme inline`)
- Modify: `src/app/globals.css:1543-1574` (delete dead block)

**Interfaces:**
- Produces: Tailwind utility classes `bg-warning`, `text-warning`, `border-warning`, `text-warning-foreground` (and opacity variants like `bg-warning/10`) usable by every later task that touches an amber/warning-colored element (`DashboardWarningBanner`, `DashboardPaymentSummaryStrip`'s mixed-payment alert, `TableStatusPanel`'s "waiting" tone, `toneClasses.amber` in `dashboard-chart-widgets.tsx`).

- [ ] **Step 1: Confirm the dead CSS is truly unused**

Run: `git grep -n "dashboard-warning-panel\|dashboard-warning-title\|dashboard-warning-description"`
Expected: only matches inside `src/app/globals.css` itself (no `.tsx` usage). This was already confirmed during planning — re-confirm before deleting in case of drift.

- [ ] **Step 2: Add the `--warning` tokens to `:root`**

In `src/app/globals.css`, inside the `:root { ... }` block (starts line 10), add these two lines immediately after `--destructive-foreground: oklch(1 0 0);` (line 24):

```css
  --warning: hsl(38 92% 46%);
  --warning-foreground: hsl(0 0% 100%);
```

- [ ] **Step 3: Add the dark-mode `--warning` overrides**

Inside the `.dark { ... }` block (starts line 48), add these two lines immediately after `--destructive-foreground: oklch(1 0 0);` (line 64):

```css
  --warning: hsl(38 92% 55%);
  --warning-foreground: hsl(26 83% 12%);
```

- [ ] **Step 4: Expose the tokens as Tailwind utilities**

Inside the `@theme inline { ... }` block (starts line 84), add these two lines immediately after `--color-destructive-foreground: var(--destructive-foreground);` (line 100):

```css
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);
```

- [ ] **Step 5: Delete the dead `.dashboard-warning-panel` block**

Delete this entire block from `src/app/globals.css` (currently lines 1543-1574):

```css
.dashboard-warning-panel {
  border-color: hsl(38 92% 50% / 0.55);
  background: hsl(42 100% 94%);
  color: hsl(24 78% 18%);
}

.dashboard-warning-title {
  color: hsl(24 88% 24%);
}

.dashboard-warning-panel > svg {
  color: hsl(32 95% 38%);
}

.dashboard-warning-description {
  color: hsl(24 72% 24%);
}

.dark .dashboard-warning-panel {
  border-color: hsl(38 92% 50% / 0.4);
  background: hsl(38 92% 50% / 0.14);
  color: hsl(43 96% 84%);
}

.dark .dashboard-warning-title {
  color: hsl(43 96% 82%);
}

.dark .dashboard-warning-panel > svg,
.dark .dashboard-warning-description {
  color: hsl(43 96% 82% / 0.9);
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no errors (this task touches no `.tsx` files, so this mainly guards against a stray syntax mistake breaking the build pipeline).

Run: `npx tailwindcss -i src/app/globals.css -o /tmp/dashboard-token-check.css --content src/app/globals.css 2>&1 | head -30` is not available in this project (no standalone Tailwind CLI config) — instead start the dev server and open any existing page; confirm no console error about unknown CSS and that colors elsewhere are unaffected (this task is additive-only for `:root`/`.dark`/`@theme inline`).

- [ ] **Step 7: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(design-system): add warning color token, remove dead dashboard CSS"
```

---

### Task 2: Convert page head + filter bar wrapper (`DashboardHeader`, `DashboardFilterBar` container, `dashboard-page.tsx` filter slot)

**Files:**
- Modify: `src/features/dashboard/overview/components/dashboard-widgets.tsx:217-344`
- Modify: `src/features/dashboard/overview/dashboard-page.tsx:379-400`
- Modify: `src/features/dashboard/overview/dashboard.css` (delete listed rules)

**Interfaces:**
- Consumes: nothing new (uses existing `Card`, `CardContent`, `Field` components already imported).
- Produces: no exported signature changes — `DashboardHeader` and `DashboardFilterBar` keep identical props.

The individual `Select`/`ReportDateInput`/`Button` sizing inside the filter row was already fixed in a prior session — this task only touches the **wrapper/layout** classes (`dashboard-page-head`, `dashboard-filter-card`, `dashboard-filter-content`, `dashboard-filter-selects`, `dashboard-filter-field`, `dashboard-filter-actions`, `dashboard-filter-slot`, `dashboard-filter-lock`).

- [ ] **Step 1: Convert `DashboardHeader`'s `dashboard-page-head` class**

In `dashboard-widgets.tsx`, the CSS rule being retired:

```css
.dashboard-page-head {
  padding-inline: 0.125rem;
}

.dashboard-page-head h1 {
  font-size: clamp(1.55rem, 1.2rem + 1vw, 2rem);
  font-weight: 750;
  letter-spacing: -0.01em;
}
```

The `<h1>` at line 220 already carries `className="text-2xl font-semibold leading-tight tracking-normal md:text-[1.65rem]"` which is a reasonable existing Tailwind approximation of the `clamp()` (font-weight 750 has no Tailwind step between 600/`font-semibold` and 700/`font-bold`; `font-semibold` is the accepted simplification per this plan's Global Constraints).

Change line 218 from:
```tsx
    <div className="dashboard-page-head flex flex-wrap items-end justify-between gap-4">
```
to:
```tsx
    <div className="flex flex-wrap items-end justify-between gap-4 px-0.5">
```
(`padding-inline: 0.125rem` = `px-0.5` in Tailwind's 4px-based scale, since `0.125rem = 2px = 0.5 * 4px`.)

- [ ] **Step 2: Convert the filter `Card`/`CardContent` wrapper classes**

CSS being retired:

```css
.dashboard-filter-card {
  z-index: 15;
  container-name: dashboard-filter;
  container-type: inline-size;
  border-radius: 12px;
  background: hsl(var(--card) / 0.94);
  backdrop-filter: blur(14px);
  box-shadow: var(--dashboard-shadow-md);
}

.dashboard-filter-content {
  display: grid;
  grid-template-columns: minmax(0, 1fr) max-content;
  align-items: end;
  gap: 0.625rem;
  padding: 0.375rem;
}
```

Change line 260 from:
```tsx
    <Card className="dashboard-filter-card border-border bg-card shadow-sm">
```
to:
```tsx
    <Card className="@container/dashboard-filter z-[15] rounded-xl border-border bg-card/94 shadow-md backdrop-blur-md">
```
(`container-type: inline-size` + `container-name: dashboard-filter` → Tailwind v4's `@container/dashboard-filter` utility, which both sets `container-type: inline-size` and names the container in one class. `border-radius: 12px` → `rounded-xl` (Tailwind's `--radius-xl` token in this project is `calc(var(--radius) * 1.4)`; with `--radius: 0.625rem` that's `0.875rem` ≈ 14px, close enough per the "minor adjustment acceptable" constraint — if an exact 12px is required use `rounded-[12px]`, but prefer the token). `box-shadow: var(--dashboard-shadow-md)` → Tailwind's built-in `shadow-md`, replacing the bespoke shadow token per this plan's decision to prefer existing Tailwind primitives over inventing new shadow tokens.)

Change line 261 from:
```tsx
      <CardContent className="dashboard-filter-content">
```
to:
```tsx
      <CardContent className="grid grid-cols-[minmax(0,1fr)_max-content] items-end gap-2.5 p-1.5">
```

- [ ] **Step 3: Convert `dashboard-filter-selects`**

CSS being retired:

```css
.dashboard-filter-selects {
  display: grid;
  grid-template-columns:
    minmax(11rem, 1.25fr)
    minmax(8.5rem, 0.85fr)
    repeat(2, minmax(9.5rem, 1fr));
  align-items: stretch;
  gap: 0.5rem;
  min-width: 0;
}

.dashboard-filter-selects[data-period-type="yearly"] {
  grid-template-columns:
    minmax(11rem, 1.25fr)
    minmax(8.5rem, 0.85fr)
    minmax(8.5rem, 0.85fr);
}
```

Change lines 262-265 from:
```tsx
        <div
          className="dashboard-filter-selects"
          data-period-type={filters.periodType}
        >
```
to:
```tsx
        <div
          className={cn(
            "grid min-w-0 items-stretch gap-2 grid-cols-[minmax(11rem,1.25fr)_minmax(8.5rem,0.85fr)_repeat(2,minmax(9.5rem,1fr))]",
            filters.periodType === "yearly" &&
              "grid-cols-[minmax(11rem,1.25fr)_minmax(8.5rem,0.85fr)_minmax(8.5rem,0.85fr)]",
          )}
          data-period-type={filters.periodType}
        >
```
(This is a genuinely bespoke, non-standard grid track list — no clean named Tailwind scale step matches `11rem`/`8.5rem`/`9.5rem`. Tailwind's arbitrary-value bracket syntax (`grid-cols-[...]`) is the sanctioned mechanism for exactly this case, not a violation of "no arbitrary values" — that constraint targets raw *colors*/fonts, not one-off grid track sizing which Tailwind has no token for. Import `cn` — it is already imported at line 29.)

- [ ] **Step 4: Convert `dashboard-filter-field`**

CSS being retired:

```css
.dashboard-filter-field {
  min-height: 3.4rem;
  min-width: 0;
  flex-direction: column;
  align-items: stretch;
  gap: 0.125rem;
  border: 1px solid var(--dashboard-line);
  border-radius: 0.55rem;
  background: var(--dashboard-surface-2);
  padding: 0.3rem 0.6rem 0.25rem;
}

.dashboard-filter-field:hover {
  border-color: var(--dashboard-line-strong);
}

.dashboard-filter-field label {
  width: auto;
  white-space: normal;
  color: var(--dashboard-muted);
  font-size: 0.65rem;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.dashboard-filter-field [role="combobox"],
.dashboard-filter-field input {
  height: 1.75rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  border-color: transparent;
  background: transparent;
  padding-inline: 0;
  font-family: var(--font-geist-mono, ui-monospace), "Noto Sans Lao", monospace;
  font-size: 0.82rem;
  font-weight: 700;
  box-shadow: none;
}

.dashboard-filter-field input {
  border-radius: 0.35rem;
}
```

This is the "chip" look (bordered box containing a small label + borderless select/input). Both `SelectControl` (line 92) and `DateControl` (line 126) use this class on their `<Field>`. Replace on both:

Line 92, change:
```tsx
    <Field className="dashboard-filter-field min-w-0">
```
to:
```tsx
    <Field className="min-h-[3.4rem] min-w-0 gap-0.5 rounded-[0.55rem] border border-border bg-muted/35 px-2.5 pb-1 pt-1.5 hover:border-border/90 dark:bg-muted/42">
```

Line 126, change (identical class):
```tsx
    <Field className="dashboard-filter-field min-w-0">
```
to:
```tsx
    <Field className="min-h-[3.4rem] min-w-0 gap-0.5 rounded-[0.55rem] border border-border bg-muted/35 px-2.5 pb-1 pt-1.5 hover:border-border/90 dark:bg-muted/42">
```

(`--dashboard-line`/`--dashboard-line-strong` were just `border` / `border/92%` — simplified to plain `border-border` since a hover state that changes opacity by 8% is imperceptible; dropping it is the "minor visual adjustment" this plan is allowed to make. `--dashboard-surface-2` was `hsl(var(--muted) / 0.34)` light / `0.42` dark — expressed directly as `bg-muted/35 dark:bg-muted/42`.)

The `[role="combobox"], input` height/font rule already has a near-duplicate at the call sites: `SelectControl`'s `SelectTrigger` (line 97) already has `className="w-full text-[13px] font-semibold"` and `DateControl`'s `ReportDateInput` (line 138) already has `className="h-7 border-transparent bg-transparent px-0 font-mono text-[13px] font-semibold shadow-none hover:bg-transparent"`. Update both so they fully own their own sizing instead of depending on the CSS rule:

Line 97, change:
```tsx
        <SelectTrigger className="w-full text-[13px] font-semibold">
```
to:
```tsx
        <SelectTrigger className="h-7 w-full min-w-0 border-transparent bg-transparent px-0 font-mono text-[13px] font-semibold shadow-none hover:bg-transparent data-[state=open]:bg-transparent">
```

`DateControl`'s `ReportDateInput` at line 138 already matches (`h-7 border-transparent bg-transparent px-0 font-mono text-[13px] font-semibold shadow-none hover:bg-transparent`) — no change needed there, confirming this section's earlier prior-session fix already anticipated this.

The field `<label>` styling (`font-size: 0.65rem; font-weight: 600`) is already handled by both call sites' own `FieldLabel` className (`text-[11px] font-bold text-muted-foreground` at lines 93 and 128) — leave as-is; `0.65rem`≈`10.4px` vs the existing `text-[11px]` is the kind of sub-pixel difference this plan explicitly allows to drift.

- [ ] **Step 5: Convert `dashboard-filter-actions`**

CSS being retired:

```css
.dashboard-filter-actions {
  display: flex;
  align-self: center;
  gap: 0.5rem;
  justify-content: flex-end;
  min-width: max-content;
}

.dashboard-filter-actions button {
  padding-inline: 0.75rem;
  white-space: nowrap;
}
```

(Recall: the `height`/`min-height: 2rem` half of this rule was already deleted in the prior session's button-height fix — only the padding/self-alignment half remains.)

Change line 320 from:
```tsx
        <div className="dashboard-filter-actions">
```
to:
```tsx
        <div className="flex min-w-max items-center justify-end gap-2 *:px-3 *:whitespace-nowrap">
```
(`*:px-3 *:whitespace-nowrap` applies the former `.dashboard-filter-actions button` rule to direct children via Tailwind v4's `*:` variant, since both buttons already get their padding from the `Button` component's own default size and don't need an override — verify visually in Step 7 whether `*:px-3` is even necessary, since `Button`'s default size already includes `px-2`; if the extra `px-3` is not visually meaningful, drop `*:px-3` and keep only `*:whitespace-nowrap`.)

- [ ] **Step 6: Convert the `dashboard-filter-slot` / `dashboard-filter-lock` wrapper in `dashboard-page.tsx`**

CSS being retired:

```css
@media (min-width: 1024px) {
  .dashboard-filter-slot {
    position: sticky;
    z-index: 35;
    top: calc(var(--app-shell-header-height) + 0.75rem);
  }
}
```

(`.dashboard-filter-lock` has no CSS rule anywhere — confirmed dead during planning; drop the class entirely.)

Change `dashboard-page.tsx` lines 379-400 from:
```tsx
      <div className="dashboard-filter-slot">
        <div className="dashboard-filter-lock">
          <DashboardFilterBar
```
to:
```tsx
      <div className="lg:sticky lg:z-[35] lg:top-[calc(var(--app-shell-header-height)+0.75rem)]">
        <div>
          <DashboardFilterBar
```
and close the matching `</div></div>` at line 399-400 unchanged (still two nested divs — the outer one now carries the sticky classes, the inner one is now a plain wrapper; it may be flattened to one `<div>` — if flattened, remove one closing `</div>` accordingly and re-run Step 8's typecheck to confirm JSX balance).

- [ ] **Step 7: Delete the now-fully-replaced CSS rules from `dashboard.css`**

Delete these blocks from `src/features/dashboard/overview/dashboard.css` (all rules referenced in Steps 1-6 above): `.dashboard-page-head`, `.dashboard-page-head h1`, `.dashboard-filter-card`, `.dashboard-filter-content`, `.dashboard-filter-selects`, `.dashboard-filter-selects[data-period-type="yearly"]`, `.dashboard-filter-field` and all its sub-selectors, `.dashboard-filter-actions`, `.dashboard-filter-actions button`, the `@media (min-width: 1024px) { .dashboard-filter-slot { ... } }` block, and the two responsive overrides for these same classes inside `@media (max-width: 1279px)` (the `.dashboard-filter-content { grid-template-columns: minmax(0, 1fr) max-content; }` re-statement — already the same as the base rule, safe to delete without a Tailwind replacement) and `@media (max-width: 767px)` (`.dashboard-filter-content`, `.dashboard-filter-selects`, `.dashboard-filter-actions`, `.dashboard-filter-actions button`, `.dashboard-filter-card [role="combobox"], .dashboard-filter-card button`) and the two `@container dashboard-filter (...)` blocks at the end of the file.

For the mobile/container-query breakpoints being deleted, add their Tailwind equivalents to the elements touched in Steps 2-5:

- `@media (max-width: 767px) { .dashboard-filter-content { grid-template-columns: minmax(0, 1fr); gap: 0.5rem } }` → on the `CardContent` from Step 2, change the class to add a `max-lg:grid-cols-1 max-lg:gap-2` prefix (full string: `"grid grid-cols-[minmax(0,1fr)_max-content] max-lg:grid-cols-1 items-end gap-2.5 max-lg:gap-2 p-1.5"`). Note: the CSS used a raw `767px` breakpoint (~Tailwind's default `md`, not `lg`) — use `max-md:grid-cols-1 max-md:gap-2` instead to match the original breakpoint exactly.
- `@media (max-width: 767px) { .dashboard-filter-selects { grid-template-columns: minmax(0, 1fr) } }` → on the Step 3 div, add `max-md:grid-cols-1` to the `cn(...)` call's base string.
- `@media (max-width: 767px) { .dashboard-filter-actions { justify-content: stretch } .dashboard-filter-actions button { flex: 1 1 0; width: 100% } }` → on the Step 5 div, change to `"flex min-w-max items-center justify-end gap-2 max-md:justify-stretch *:whitespace-nowrap max-md:*:flex-1 max-md:*:w-full"`.
- `@media (max-width: 767px) { .dashboard-filter-card [role="combobox"], .dashboard-filter-card button { min-height: 2.35rem } }` → this re-grows tap targets on mobile; add `max-md:min-h-[2.35rem]` to the `SelectTrigger` class from Step 4 and confirm the `Button`s in the actions row already clear 2.35rem at their default height (they do — default `Button` height is `h-7`/28px plus the `Field`'s own padding brings the tap target above 2.35rem/37.6px once the surrounding `Field` padding is included; verify visually on a real mobile viewport in Step 8, not just by class inspection).
- The two `@container dashboard-filter (...)` blocks (54rem and 36rem breakpoints) → Tailwind v4 arbitrary container breakpoints on the Steps 3 and 5 elements: add `@[54rem]/dashboard-filter:grid-cols-2` type utilities. Given the added complexity-to-value ratio here (three nested breakpoint systems: viewport `md`, viewport `lg`, AND container `54rem`/`36rem`), and that this plan permits minor adjustment, the pragmatic choice is to **drop the container-query layer** and rely on the `max-md:`/`lg:` viewport breakpoints already ported above — the container query was compensating for the sidebar collapsing/expanding change the available width, which is a real but low-frequency edge case. Flag this simplification explicitly to the user in the task's commit message; if they push back after seeing it live, re-add via `@[54rem]/dashboard-filter:` in a follow-up.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Start the dev server (`npm run dev`), open `/` (dashboard overview), and compare against a screenshot taken before this task's changes:
- Filter bar renders as a bordered/blurred card with the branch/period-type/date selects visually chip-styled (bordered box, small label, bold value).
- Resize the browser to below 768px width — filter fields collapse to one column, action buttons stretch full-width.
- Resize to below 1024px width — filter bar is no longer sticky when scrolling.
- Toggle dark mode — chip backgrounds and borders still readable, no invisible text.

- [ ] **Step 9: Commit**

```bash
git add src/features/dashboard/overview/components/dashboard-widgets.tsx src/features/dashboard/overview/dashboard-page.tsx src/features/dashboard/overview/dashboard.css
git commit -m "refactor(dashboard): convert page head and filter bar to Tailwind utilities"
```

---

### Task 3: Convert payment summary strip, warning banner, query bar

**Files:**
- Modify: `src/features/dashboard/overview/components/dashboard-widgets.tsx:373-540, 542-562`
- Modify: `src/features/dashboard/overview/dashboard.css` (delete listed rules)

**Interfaces:**
- Consumes: `bg-warning`/`text-warning`/`border-warning`/`text-warning-foreground` tokens from Task 1.
- Produces: no signature changes to `DashboardPaymentSummaryStrip`, `DashboardWarningBanner`, `DashboardQueryBar`.

- [ ] **Step 1: Convert `DashboardWarningBanner` off the amber-500 hardcoded triad onto the new `warning` token**

CSS being retired:

```css
.dashboard-warning-banner {
  display: flex;
  align-items: center;
  grid-template-columns: none;
  border-color: hsl(38 92% 48% / 0.45);
  border-radius: 10px;
  background: var(--dashboard-amber-soft);
  color: var(--dashboard-amber);
  padding: 0.75rem 0.95rem;
}

.dashboard-warning-banner [data-slot="alert-title"] {
  min-width: max-content;
  color: var(--dashboard-ink);
}

.dashboard-warning-banner [data-slot="alert-description"] {
  display: flex;
  flex: 1;
  grid-column: auto;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.dashboard-warning-banner [data-slot="alert-description"],
.dashboard-warning-banner .dashboard-warning-body {
  color: var(--dashboard-ink);
}
```

Change lines 552-559 from:
```tsx
    <Alert className="dashboard-warning-banner border-amber-500/30 bg-amber-500/10 text-amber-700">
      <AlertTriangle />
      <AlertTitle className="font-black">{copy.warnings}</AlertTitle>
      <AlertDescription className="dashboard-warning-body flex flex-col gap-1 text-foreground">
        {warnings.map((warning) => (
          <span key={warning.key}>{warningMessage(copy, warning)}</span>
        ))}
      </AlertDescription>
    </Alert>
```
to:
```tsx
    <Alert className="flex grid-cols-none items-center rounded-[10px] border-warning/45 bg-warning/10 px-3.5 py-3 text-warning">
      <AlertTriangle />
      <AlertTitle className="min-w-max font-black text-foreground">{copy.warnings}</AlertTitle>
      <AlertDescription className="flex flex-1 grid-cols-none items-center justify-between gap-4 text-foreground">
        {warnings.map((warning) => (
          <span key={warning.key}>{warningMessage(copy, warning)}</span>
        ))}
      </AlertDescription>
    </Alert>
```
(`grid-template-columns: none` overrides `Alert`'s own default grid layout — check `src/components/ui/alert.tsx` before this step to confirm the base component uses `grid`; if so, `grid-cols-none` is the correct Tailwind utility. `var(--dashboard-ink)` was just `hsl(var(--foreground))` → `text-foreground`.)

- [ ] **Step 2: Convert `DashboardPaymentSummaryStrip`'s card classes**

CSS being retired:

```css
.dashboard-payment-summary-stack {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  margin-top: -0.25rem;
}

.dashboard-payment-card-content {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
}

.dashboard-payment-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  border-radius: 9999px;
  background: hsl(var(--primary) / 0.1);
  color: hsl(var(--primary));
  margin-top: 0.25rem;
}

.dashboard-payment-card-icon svg {
  width: 1.1rem;
  height: 1.1rem;
}

.dashboard-payment-card-total {
  border-color: hsl(var(--primary) / 0.18);
  background: linear-gradient(135deg, var(--dashboard-green-tint), var(--dashboard-surface));
}

.dashboard-payment-card-total .dashboard-payment-card-icon,
.dashboard-payment-card-cash .dashboard-payment-card-icon {
  background: var(--dashboard-green-tint);
  color: var(--dashboard-green);
}

.dashboard-payment-card-transfer .dashboard-payment-card-icon {
  background: var(--dashboard-surface-2);
  color: var(--dashboard-green);
}

.dashboard-payment-card-debt {
  border-color: hsl(var(--destructive) / 0.2);
}

.dashboard-payment-card-debt .dashboard-payment-card-icon {
  background: var(--dashboard-rose-soft);
  color: var(--dashboard-rose);
}

.dashboard-payment-card-debt .dashboard-payment-card-content p:last-child {
  color: var(--dashboard-rose);
}
```

Change line 409 from:
```tsx
      <div className="dashboard-payment-summary-stack">
```
to:
```tsx
      <div className="-mt-1 flex flex-col gap-2.5">
```

Change `paymentSummaryTone` (lines 346-355) to return plain Tailwind class strings instead of the four `dashboard-payment-card-*` class names, since each tone now needs distinct icon-background + border + (for debt) text color that can't be expressed with a single shared class token the way the CSS did:

```tsx
function paymentSummaryTone(card: PaymentSummaryCard) {
  const key = card.key.toLowerCase();

  if (card.important || key.includes("payment_total") || key.includes("total"))
    return {
      card: "border-primary/18 bg-gradient-to-br from-primary/7 to-card",
      icon: "bg-primary/10 text-primary",
    };
  if (key.includes("debt") || key.includes("balance"))
    return {
      card: "border-destructive/20",
      icon: "bg-destructive/10 text-destructive",
      value: "text-destructive",
    };
  if (key.includes("transfer"))
    return { card: "", icon: "bg-muted/34 text-primary" };
  return { card: "", icon: "bg-primary/7 text-primary" };
}
```

Update the two call sites (line 423 and line 430) and the value `<p>` (line 439-446) to consume the new object shape instead of a single class name:

Line 421-427, change:
```tsx
                className={cn(
                  "flex-1 min-w-0",
                  paymentSummaryTone(card),
                  !isLastItem &&
                    "border-b border-border md:border-b-0 md:border-r",
                )}
```
to:
```tsx
                className={cn(
                  "flex-1 min-w-0",
                  paymentSummaryTone(card).card,
                  !isLastItem &&
                    "border-b border-border md:border-b-0 md:border-r",
                )}
```

Line 428-434, change:
```tsx
                <CardContent className="dashboard-payment-card-content">
                  <div
                    className="dashboard-payment-card-icon"
                    aria-hidden="true"
                  >
                    <Icon />
                  </div>
```
to:
```tsx
                <CardContent className="flex flex-row items-start justify-between gap-4 px-6 py-5">
                  <div
                    className={cn(
                      "mt-1 flex size-10 items-center justify-center rounded-full [&>svg]:size-[1.1rem]",
                      paymentSummaryTone(card).icon,
                    )}
                    aria-hidden="true"
                  >
                    <Icon />
                  </div>
```

Line 439-446, change:
```tsx
                    <p
                      className={cn(
                        "mt-1 wrap-break-word font-mono font-semibold leading-tight",
                        card.important ? "text-2xl" : "text-xl",
                      )}
                    >
                      {formatKip(card.value)}
                    </p>
```
to:
```tsx
                    <p
                      className={cn(
                        "mt-1 wrap-break-word font-mono font-semibold leading-tight",
                        card.important ? "text-2xl" : "text-xl",
                        paymentSummaryTone(card).value,
                      )}
                    >
                      {formatKip(card.value)}
                    </p>
```

(`padding: 1.25rem 1.5rem` → `px-6 py-5`. `width/height: 2.5rem` → `size-10`. `var(--dashboard-green-tint)` was `hsl(var(--primary) / 0.07)` → `primary/7`. The transfer tone's `var(--dashboard-surface-2)` → `muted/34`. The gradient on the "total" tone (`linear-gradient(135deg, var(--dashboard-green-tint), var(--dashboard-surface))`) is now `bg-gradient-to-br from-primary/7 to-card`, a native Tailwind gradient utility — no new token needed since both stops already reference existing tokens.)

- [ ] **Step 3: Convert `DashboardQueryBar`'s classes** (currently commented out / unused in `dashboard-page.tsx` line 407 — `<DashboardQueryBar .../>` is commented out, so this component is dead code in practice)

Confirm dead-ness first:
Run: `git grep -n "DashboardQueryBar" src/features/dashboard`
Expected: the export in `dashboard-widgets.tsx` and one commented-out JSX usage in `dashboard-page.tsx:407`.

Since the only call site is commented out, **delete `DashboardQueryBar` entirely** (lines 473-540 of `dashboard-widgets.tsx`, and its now-unused imports `Code2`/`Copy` from `lucide-react` and `useState` if `DashboardQueryBar` was its only remaining user — check `DashboardQueryBar`'s `useState` for the `copied` flag is local to that function, but `dashboard-widgets.tsx` also imports `useState` at the top for other components; verify with `git grep -n "useState" dashboard-widgets.tsx` before removing the import) rather than converting its CSS, per CLAUDE.md "if you are certain that something is unused, delete it completely" — do not carry dead code forward through a migration.

If the team wants to keep `DashboardQueryBar` for future re-enabling instead of deleting it, skip this step's deletion and instead convert its three custom classes (`dashboard-query-card`, `dashboard-query-content`, `dashboard-query-kv`) following the same mechanical pattern as Steps 1-2 (border-radius → `rounded-[10px]`, the `>.inline-flex`/`>.shrink-0:first-child` badge-pill styling → move directly onto the `<Badge>` element's own className instead of a descendant-selector hack). Default to deleting; only keep-and-convert if the user says so when this task comes up for review.

- [ ] **Step 4: Delete the now-replaced CSS rules from `dashboard.css`**

Delete: `.dashboard-warning-banner` and its two sub-selectors, `.dashboard-payment-summary-stack`, `.dashboard-payment-card-content`, `.dashboard-payment-card-icon`, `.dashboard-payment-card-icon svg`, `.dashboard-payment-card-total`, `.dashboard-payment-card-total .dashboard-payment-card-icon, .dashboard-payment-card-cash .dashboard-payment-card-icon`, `.dashboard-payment-card-transfer .dashboard-payment-card-icon`, `.dashboard-payment-card-debt`, `.dashboard-payment-card-debt .dashboard-payment-card-icon`, `.dashboard-payment-card-debt .dashboard-payment-card-content p:last-child`, and the responsive re-statements in the two `@media` blocks near the end of the file (`.dashboard-payment-summary-grid`, `.dashboard-payment-card-total { grid-column: ... }`, `.dashboard-payment-card-content { min-height: 4.6rem }` — note `.dashboard-payment-summary-grid`/`.dashboard-payment-card` 2-column-grid classes referenced in these media queries do not actually appear on any JSX element found in `dashboard-widgets.tsx` in this plan's reading — re-run `git grep -n "dashboard-payment-summary-grid\|dashboard-payment-mixed-alert"` before deleting to confirm they are also dead, and if a real usage turns up, convert it following Steps 1-2's pattern before deleting the CSS).

If `DashboardQueryBar` was deleted in Step 3, also delete `.dashboard-query-card`, `.dashboard-query-content`, `.dashboard-query-content>.inline-flex, .dashboard-query-content>.shrink-0:first-child`, `.dashboard-query-content>.shrink-0:first-child svg`, `.dashboard-query-kv`, `.dashboard-query-kv span:first-child`, `.dashboard-query-kv span:last-child`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors (this will also catch any now-unused import left behind from Step 3's deletion).

Dev server: trigger a state that shows the warning banner and the mixed-payment alert (check `DashboardWarningBanner`'s condition — `warnings.length > 0` — and `dashboard-payment-mixed-alert`'s condition in `paymentSummary.hasMixedSplitColumns`; use test data or temporarily force the condition to confirm styling, then revert the force). Confirm: amber/warning coloring still reads clearly in both light and dark mode, payment summary cards still show the correct icon tint per tone (green for cash/total, red for debt).

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/overview/components/dashboard-widgets.tsx src/features/dashboard/overview/dashboard.css
git commit -m "refactor(dashboard): convert warning banner and payment summary cards to Tailwind"
```

---

### Task 4: Convert hero KPI strip + sparklines

**Files:**
- Modify: `src/features/dashboard/overview/components/dashboard-widgets.tsx:154-192, 564-700`
- Modify: `src/features/dashboard/overview/dashboard.css` (delete listed rules)

**Interfaces:**
- Consumes: `--primary`/`--primary-foreground` tokens (existing — no new token needed; per Task-planning research, the hero gradient is expressed via `bg-gradient-to-br from-primary to-primary/75` instead of inventing new `--hero-*` color tokens, since that reproduces the visual with zero new/unverified colors).
- Produces: no signature changes to `DashboardHeroStrip`, `SparkPreview`.

- [ ] **Step 1: Convert the hero card + grid**

CSS being retired:

```css
.dashboard-hero-card {
  overflow: hidden;
  border-radius: 12px;
}

.dashboard-hero-grid {
  min-height: 8.75rem;
}
```

Change line 649 from:
```tsx
    <Card className="dashboard-hero-card overflow-hidden">
```
to:
```tsx
    <Card className="overflow-hidden rounded-xl">
```

Change line 650 from:
```tsx
      <div className="dashboard-hero-grid grid md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
```
to:
```tsx
      <div className="grid min-h-35 md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
```
(`8.75rem` = `140px` = `min-h-35` in Tailwind's 4px scale.)

- [ ] **Step 2: Convert the per-metric `.dashboard-hero-kpi` cell, including its responsive border logic**

CSS being retired:

```css
.dashboard-screen .dashboard-hero-kpi {
  border-top: 1px solid hsl(var(--border));
  padding: 1.125rem 1.125rem 1rem;
}

.dashboard-hero-kpi:first-child {
  border-top: 0;
}

.dashboard-hero-kpi-primary {
  background: var(--dashboard-hero-bg) !important;
  color: var(--dashboard-hero-fg);
}

.dashboard-hero-kpi-primary::before {
  position: absolute;
  top: -2.5rem;
  right: -2.5rem;
  width: 11.25rem;
  height: 11.25rem;
  border-radius: 999px;
  background: radial-gradient(circle, hsl(0 0% 100% / 0.14) 0%, hsl(0 0% 100% / 0) 70%);
  content: "";
}

.dashboard-hero-kpi p:first-child {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.12em;
}

.dashboard-hero-kpi p:nth-child(2) {
  margin-top: 0.625rem;
  font-size: clamp(1.45rem, 1.1rem + 0.85vw, 2rem);
  line-height: 1.08;
  letter-spacing: -0.01em;
}

.dashboard-hero-kpi p:nth-child(3) {
  margin-top: 0.5rem;
  color: var(--dashboard-muted);
  font-size: 0.72rem;
}

.dashboard-hero-kpi-primary p:first-child,
.dashboard-hero-kpi-primary p:nth-child(3) {
  color: var(--dashboard-hero-fg-muted) !important;
}

.dashboard-hero-kpi-primary span {
  background: hsl(0 0% 100% / 0.55) !important;
}

@media (min-width: 768px) and (max-width: 1279px) {
  .dashboard-hero-kpi {
    border-top: 0;
  }

  .dashboard-hero-kpi:nth-child(n + 3) {
    border-top: 1px solid hsl(var(--border));
  }

  .dashboard-hero-kpi:nth-child(2n) {
    border-left: 1px solid hsl(var(--border));
  }
}

@media (min-width: 1280px) {
  .dashboard-hero-kpi {
    border-top: 0;
  }

  .dashboard-hero-kpi:nth-child(n + 2) {
    border-left: 1px solid hsl(var(--border));
  }

  .dashboard-hero-kpi:nth-child(n + 5) {
    border-top: 1px solid hsl(var(--border));
  }
}
```

`metrics.map()` at line 651 already has `index` available implicitly via `Array.prototype.map` — change it to be explicit and compute per-index border classes:

Change lines 648-698 (the whole `return (...)` block) from:
```tsx
  return (
    <Card className="dashboard-hero-card overflow-hidden">
      <div className="dashboard-hero-grid grid md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className={cn(
              "dashboard-hero-kpi min-w-0 p-4",
              metric.primary &&
                "dashboard-hero-kpi-primary relative overflow-hidden bg-primary text-primary-foreground xl:row-span-2",
              !metric.primary && "bg-card",
            )}
          >
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.12em]",
                metric.primary
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground",
              )}
            >
              {metric.label}
            </p>
            <p
              className={cn(
                "mt-2 truncate font-mono text-2xl font-semibold",
                metric.rose && "text-destructive",
              )}
            >
              {metric.value}
            </p>
            <p
              className={cn(
                "mt-2 truncate text-xs",
                metric.primary
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground",
              )}
            >
              {metric.detail}
            </p>
            {metric.sparkValues ? (
              <SparkPreview
                primary={metric.primary}
                values={metric.sparkValues}
              />
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
```
to:
```tsx
  return (
    <Card className="overflow-hidden rounded-xl">
      <div className="grid min-h-35 md:grid-cols-2 xl:grid-cols-[1.45fr_repeat(3,minmax(0,1fr))]">
        {metrics.map((metric, index) => (
          <div
            key={metric.label}
            className={cn(
              "min-w-0 p-4.5 pb-4 border-border",
              index === 0 ? "border-t-0" : "border-t",
              "md:border-t md:[&:nth-child(-n+2)]:border-t-0 md:[&:nth-child(2n)]:border-l",
              "xl:border-t-0 xl:[&:nth-child(n+2)]:border-l xl:[&:nth-child(n+5)]:border-t",
              metric.primary &&
                "relative overflow-hidden bg-gradient-to-br from-primary to-primary/80 text-primary-foreground xl:row-span-2",
              !metric.primary && "bg-card",
            )}
          >
            <p
              className={cn(
                "text-[11px] font-semibold uppercase tracking-[0.12em]",
                metric.primary
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground",
              )}
            >
              {metric.label}
            </p>
            <p className="mt-2.5 truncate font-mono text-2xl leading-tight font-semibold tracking-tight md:text-[1.7rem]">
              <span className={cn(metric.rose && "text-destructive")}>{metric.value}</span>
            </p>
            <p
              className={cn(
                "mt-2 truncate text-xs",
                metric.primary
                  ? "text-primary-foreground/75"
                  : "text-muted-foreground",
              )}
            >
              {metric.detail}
            </p>
            {metric.sparkValues ? (
              <SparkPreview
                primary={metric.primary}
                values={metric.sparkValues}
              />
            ) : null}
          </div>
        ))}
      </div>
    </Card>
  );
```

Notes on this conversion:
- `1.125rem 1.125rem 1rem` padding → `p-4.5 pb-4` (Tailwind's 4px scale has a `4.5` step = 18px = `1.125rem`; `pb-4` = 16px = `1rem`).
- The `clamp(1.45rem, 1.1rem + 0.85vw, 2rem)` fluid type is simplified to a fixed `text-2xl` (24px) with an `md:text-[1.7rem]` step-up — a "minor visual adjustment" per this plan's constraints, since Tailwind has no native `clamp()` utility and reproducing one via arbitrary value (`text-[clamp(1.45rem,1.1rem+0.85vw,2rem)]`) is technically possible but adds one-off complexity for a font-size difference under 2px at any breakpoint; use the arbitrary-clamp version instead if the user wants exact fluid sizing when reviewing this task.
- The decorative `::before` radial-gradient corner glow on the primary tile is **dropped** (pure decoration, no information value — the "accept minor simplification toward shadcn patterns" constraint explicitly covers this).
- `dashboard-hero-kpi-primary span { background: hsl(0 0% 100% / 0.55) !important }` targeted the `<span>` inside `SparkPreview`'s dot/bar variants (`dashboard-spark-bars span`, `dashboard-spark-dots span`) when rendered inside the primary tile — re-verify in Step 4 whether `SparkPreview`'s primary variant actually renders `<span>` elements needing this override; from the component read during planning, `SparkPreview` only renders an `<svg><polyline>` (no `<span>`), so this CSS is currently unreachable/dead for the hero strip specifically — do not port it; it may target a different consumer of `dashboard-spark-bars`/`dashboard-spark-dots` (grep before deleting; see Step 3 of `SparkPreview`'s own conversion below).
- The nested `nth-child` responsive border logic is reproduced with Tailwind's arbitrary-selector variant syntax (`md:[&:nth-child(-n+2)]:border-t-0` etc.) — this is the one part of this task genuinely worth a careful side-by-side visual diff at all three breakpoints (mobile/`md`–`xl`/`xl`+) since nth-child math is easy to get subtly wrong; budget extra time in Step 4 for this specifically.

- [ ] **Step 3: Convert `SparkPreview`**

CSS being retired:

```css
.dashboard-spark {
  margin-top: 0.9rem;
  height: 2.2rem;
  color: var(--dashboard-green);
}

.dashboard-spark-line {
  width: 100%;
}

.dashboard-spark-line-primary {
  color: hsl(var(--primary-foreground) / 0.72);
}

.dashboard-spark-bars {
  display: flex;
  align-items: end;
  gap: 0.35rem;
}

.dashboard-spark-bars span {
  width: 0.5rem;
  border-radius: 2px 2px 0 0;
  background: linear-gradient(180deg, hsl(30 54% 56%), hsl(30 58% 70%));
}

.dashboard-spark-dots {
  display: flex;
  align-items: end;
  justify-content: center;
  gap: 1rem;
  border-bottom: 1px dashed var(--dashboard-line);
}

.dashboard-spark-dots span {
  width: 0.45rem;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--dashboard-rose);
}

.dashboard-spark-empty {
  height: 2.2rem;
}
```

First confirm which of `dashboard-spark-bars`/`dashboard-spark-dots` are actually rendered anywhere (they were not found in `dashboard-widgets.tsx` or `dashboard-chart-widgets.tsx` during this plan's file reads — only `dashboard-spark`, `dashboard-spark-line`, `dashboard-spark-line-primary`, and `dashboard-spark-empty` are used, by `SparkPreview` itself):

Run: `git grep -n "dashboard-spark-bars\|dashboard-spark-dots"`
Expected: only the two CSS rule definitions themselves, no `.tsx` usage anywhere in the repo — confirms dead code.

Change lines 161 and 173-191 from:
```tsx
  if (!values.length) return <div className="dashboard-spark-empty" />;
```
to:
```tsx
  if (!values.length) return <div className="h-8.5" />;
```

and:
```tsx
  return (
    <svg
      aria-hidden
      className={cn(
        "dashboard-spark dashboard-spark-line",
        primary && "dashboard-spark-line-primary",
      )}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
```
to:
```tsx
  return (
    <svg
      aria-hidden
      className={cn(
        "mt-3.5 h-8.5 w-full text-primary",
        primary && "text-primary-foreground/72",
      )}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
    >
```
(`2.2rem` = `35.2px`; Tailwind's `h-8.5` = `34px` is the nearest 2px-scale step — close enough per this plan's tolerance. `var(--dashboard-green)` was just `hsl(var(--primary))` → `text-primary` since the SVG's `stroke="currentColor"`.)

Delete the unused `dashboard-spark-bars`/`dashboard-spark-dots` rules as dead code (do not port them — nothing renders them).

- [ ] **Step 4: Delete the now-replaced CSS rules from `dashboard.css`**

Delete: `.dashboard-hero-card`, `.dashboard-hero-grid`, `.dashboard-hero-kpi` and all its pseudo/nth-child/media-query variants, `.dashboard-hero-kpi-primary` and its variants, `.dashboard-spark`, `.dashboard-spark-line`, `.dashboard-spark-line-primary`, `.dashboard-spark-bars` (+ `span`), `.dashboard-spark-dots` (+ `span`), `.dashboard-spark-empty`, and the `.dashboard-hero-grid { min-height: auto }` re-statement inside the `@media (max-width: 1279px)` block near the end of the file.

Also delete the now-fully-unused custom properties from `.dashboard-screen`/`.dark .dashboard-screen` at the top of `dashboard.css` once **all** of Tasks 2-4 are done and nothing references them anymore: `--dashboard-hero-bg`, `--dashboard-hero-fg`, `--dashboard-hero-fg-muted`. (Leave `--dashboard-green`, `--dashboard-rose`, etc. in place until Task 9 — other not-yet-converted sections still reference them; Task 9's final cleanup removes the whole `.dashboard-screen` custom-property block at once.)

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Dev server: view the hero strip at three widths — under 768px (single column, every tile has a top border except the first), 768-1279px (2 columns, `nth-child` border pattern matches the original: tiles 3+ get a top border, even tiles get a left border), 1280px+ (4-ish column layout with the primary tile spanning 2 rows — tiles 2+ get a left border, tiles 5+ get a top border). Confirm the primary (first) tile shows the green gradient and the sparkline is visible and colored correctly against it. Confirm dark mode.

- [ ] **Step 6: Commit**

```bash
git add src/features/dashboard/overview/components/dashboard-widgets.tsx src/features/dashboard/overview/dashboard.css
git commit -m "refactor(dashboard): convert hero KPI strip and sparklines to Tailwind"
```

---

### Task 5: Convert chart-fallback skeleton cards + shared `dashboard-card`/`dashboard-card-header` classes

**Files:**
- Modify: `src/features/dashboard/overview/components/dashboard-widgets.tsx:702-771`
- Modify: `src/features/dashboard/overview/dashboard.css` (delete listed rules)

**Interfaces:**
- Produces: a `dashboardCardHeaderClass` string constant other tasks (6-8) will reuse verbatim on every `CardHeader` in `dashboard-chart-widgets.tsx` that currently carries `className="dashboard-card-header ..."` — defining it once here keeps Tasks 6-8 consistent instead of each hand-rolling the same utility string.

This task must land **before** Tasks 6-8, since `dashboard-card`/`dashboard-card-header` are used pervasively across every chart panel in `dashboard-chart-widgets.tsx`.

- [ ] **Step 1: Convert the shared `.dashboard-card`/`.dashboard-card-header` rules**

CSS being retired:

```css
.dashboard-screen .dashboard-card {
  box-shadow: var(--dashboard-shadow-sm);
}

.dashboard-screen .dashboard-card-header {
  min-height: 3.75rem;
  border-color: var(--dashboard-line);
  background: hsl(var(--card) / 0.82);
  padding: 0.875rem 1rem;
}

.dashboard-screen .dashboard-card-header h2 {
  letter-spacing: 0.01em;
}
```

`h2` inside a `dashboard-card-header` is never used — every header in this codebase uses `<CardTitle>` which renders a `<div>` (see `card.tsx:36-44`), not an `<h2>`; confirm with:

Run: `git grep -n "dashboard-card-header" src/features/dashboard | grep -c "h2"`
Expected: `0` — safe to drop the `h2` sub-rule without porting it.

Since `dashboard-card` is applied as `className="dashboard-card overflow-hidden"` (and variants like `dashboard-card dashboard-chart-card overflow-hidden`) on every `<Card>` in `dashboard-chart-widgets.tsx`, and `Card`'s own base class already includes `ring-1 ring-foreground/10` (see `src/components/ui/card.tsx:15`) which is visually very close to a `shadow-sm`, replace `dashboard-card` with Tailwind's built-in `shadow-sm` utility rather than defining a new shadow token (per this plan's "prefer existing Tailwind primitives" decision, mirrors Task 2 Step 2's `shadow-md` choice for the filter card).

Define the shared header class as a module-level constant right after the `moneyUnits` constant (after line 57) in `dashboard-widgets.tsx`, and export it so `dashboard-chart-widgets.tsx` can import it:

```tsx
export const dashboardCardHeaderClass =
  "min-h-15 border-border bg-card/82 px-4 py-3.5";
```

(`min-height: 3.75rem` = `60px` = `min-h-15`. `padding: 0.875rem 1rem` = `py-3.5 px-4`.)

- [ ] **Step 2: Convert `DashboardChartFallbackCard`**

Change lines 704-725 from:
```tsx
function DashboardChartFallbackCard({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <Card className={cn("dashboard-card overflow-hidden", className)}>
      <CardHeader className="dashboard-card-header border-b px-4 py-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-3 w-48" />
      </CardHeader>
      <CardContent className="flex min-h-64 flex-col gap-3 p-4">
        <Skeleton className="h-40 w-full" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
```
to:
```tsx
function DashboardChartFallbackCard({
  className,
  rows = 4,
}: {
  className?: string;
  rows?: number;
}) {
  return (
    <Card className={cn("overflow-hidden shadow-sm", className)}>
      <CardHeader className={cn(dashboardCardHeaderClass, "border-b")}>
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-2 h-3 w-48" />
      </CardHeader>
      <CardContent className="flex min-h-64 flex-col gap-3 p-4">
        <Skeleton className="h-40 w-full" />
        {Array.from({ length: rows }).map((_, index) => (
          <Skeleton key={index} className="h-3 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
```
(Note this JSX already had its own `px-4 py-3` before the CSS override — dropping the CSS override in favor of the shared constant changes vertical padding from `py-3`/12px to `py-3.5`/14px, matching what the CSS was actually forcing all along; this is intentional, not a regression.)

- [ ] **Step 3: Delete the replaced CSS rules from `dashboard.css`**

Delete: `.dashboard-screen .dashboard-card`, `.dashboard-screen .dashboard-card-header`, `.dashboard-screen .dashboard-card-header h2`.

Do **not** yet delete `.dashboard-screen` itself or its custom-property block — Tasks 6-8 still transitively depend on some of those properties being defined until they're converted too; Task 9 removes the block once nothing references it.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Dev server: force the loading state (throttle network or temporarily return the fallback unconditionally) and confirm the skeleton cards still render with a header band and shadow matching the pre-change look closely enough per this plan's tolerance.

- [ ] **Step 5: Commit**

```bash
git add src/features/dashboard/overview/components/dashboard-widgets.tsx src/features/dashboard/overview/dashboard.css
git commit -m "refactor(dashboard): convert shared card/card-header classes and chart skeleton fallback to Tailwind"
```

---

### Task 6: Convert `DashboardRevenueAccountingGrid` (daily sales chart card + accounting ledger card)

**Files:**
- Modify: `src/features/dashboard/overview/components/dashboard-chart-widgets.tsx:159-312`
- Modify: `src/features/dashboard/overview/dashboard.css` (delete listed rules)

**Interfaces:**
- Consumes: `dashboardCardHeaderClass` from Task 5 (`import { dashboardCardHeaderClass } from "./dashboard-widgets"` — add to the existing `import type { DashboardCopy } from "./dashboard-widgets"` import, converting it to a mixed type+value import: `import { type DashboardCopy, dashboardCardHeaderClass } from "./dashboard-widgets";`).

- [ ] **Step 1: Convert the grid wrapper and both cards' shared classes**

CSS being retired (the grid + `dashboard-card`/`dashboard-card-header` already handled by Task 5's constant, minus the two card-specific classes and `dashboard-chart-body`/`dashboard-chart-tools`/`dashboard-chart-tabs`/`dashboard-chart-legend`/`dashboard-ledger-*`):

```css
.dashboard-revenue-grid,
.dashboard-operations-grid,
.dashboard-products-grid {
  gap: 1rem;
}

.dashboard-chart-body {
  padding: 0.5rem 0.75rem 0.875rem;
}

.dashboard-chart-tools {
  justify-content: flex-end;
}

.dashboard-chart-tabs {
  display: inline-flex;
  gap: 0.125rem;
  border-radius: 0.5rem;
  background: var(--dashboard-surface-2);
  padding: 0.2rem;
}

.dashboard-chart-tabs button {
  height: 2rem;
  border-color: transparent;
  border-radius: 0.4rem;
  background: transparent;
  box-shadow: none;
  color: var(--dashboard-ink);
  font-weight: 500;
}

.dashboard-chart-tabs button[class*="border"] {
  border-color: var(--dashboard-line);
  background: var(--dashboard-surface);
  color: var(--dashboard-green);
  box-shadow: var(--dashboard-shadow-sm);
}

.dashboard-main-chart,
.dashboard-pareto-chart {
  overflow: visible;
}

.dashboard-screen .recharts-cartesian-grid line {
  stroke: var(--dashboard-line);
  stroke-dasharray: 2 4;
}

.dashboard-screen .recharts-cartesian-axis-tick text {
  fill: var(--dashboard-muted);
  font-size: 0.68rem;
}

.dashboard-screen .recharts-tooltip-wrapper {
  filter: drop-shadow(0 10px 24px hsl(var(--foreground) / 0.12));
}

.dashboard-ledger-row {
  border-color: var(--dashboard-line);
  padding-block: 0.58rem;
}

.dashboard-ledger-total {
  margin-inline: -0.25rem;
  border-color: hsl(var(--primary) / 0.14);
  background: var(--dashboard-green-tint) !important;
}
```

`.dashboard-revenue-grid, .dashboard-operations-grid, .dashboard-products-grid { gap: 1rem }` is redundant — every one of the three grids already has Tailwind's `gap-4` (16px = `1rem`) directly in its className (`"dashboard-revenue-grid grid gap-4 ..."` etc.) — this CSS rule was fighting nothing; just drop the custom class token from the three grid `<div>`s across this file and `dashboard-widgets.tsx` (`DashboardChartGridFallback`'s three variants) with no other change needed.

The recharts SVG-internal selectors (`.recharts-cartesian-grid line`, `.recharts-cartesian-axis-tick text`, `.recharts-tooltip-wrapper`) style third-party SVG internals that recharts renders — Tailwind utility classes cannot target these (they're not elements you control the className of; recharts renders its own `<line>`/`<text>`/`<g>` nodes with library-fixed classNames). This is a legitimate "Tailwind cannot express this" case per CLAUDE.md's own carve-out ("without a platform, print, motion, or browser limitation" — a third-party SVG charting library's internal DOM is exactly this kind of limitation). **Keep these three rules**, but move them out of the dashboard-specific `dashboard.css` file that's being deleted and into `globals.css` scoped under a stable, intentional selector, since recharts is used elsewhere in the app too (e.g. any other report charts) and this styling should apply globally, not be re-invented per page:

Add to `src/app/globals.css`, immediately after the `.pos-grid { ... }` rule near the end of the file (before the `@layer base` block):

```css
.recharts-cartesian-grid line {
  stroke: hsl(var(--border));
  stroke-dasharray: 2 4;
}

.recharts-cartesian-axis-tick text {
  fill: hsl(var(--muted-foreground));
  font-size: 0.68rem;
}

.recharts-tooltip-wrapper {
  filter: drop-shadow(0 10px 24px hsl(var(--foreground) / 0.12));
}
```
(Dropped the `.dashboard-screen` scoping prefix since this is now a global, reusable rule, not dashboard-specific — check whether any other recharts usage in the app relies on *not* having this styling before landing this change; `git grep -rn "recharts" src/features --include=*.tsx -l` to enumerate other chart consumers and eyeball them in Step 4.)

Everything else in this CSS block converts to plain Tailwind on the JSX:

Line 236, change:
```tsx
    <div className="dashboard-revenue-grid grid gap-4 xl:grid-cols-[1.7fr_1fr]">
```
to:
```tsx
    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
```

Line 237, change:
```tsx
      <Card className="dashboard-card dashboard-chart-card overflow-hidden">
```
to:
```tsx
      <Card className="overflow-hidden shadow-sm">
```
(`dashboard-chart-card` has no CSS rule anywhere — confirmed dead, drop silently.)

Line 238, change:
```tsx
        <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
```
to:
```tsx
        <CardHeader className={cn(dashboardCardHeaderClass, "flex-row items-center justify-between border-b")}>
```
(Need `cn` — already imported at line 25.)

Line 243, change:
```tsx
          <div className="dashboard-chart-tools flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
```
to:
```tsx
          <div className="flex flex-wrap items-center justify-end gap-3 text-xs text-muted-foreground">
```

Line 244, change:
```tsx
            <div className="dashboard-chart-legend flex flex-wrap items-center gap-3">
```
to:
```tsx
            <div className="flex flex-wrap items-center gap-3">
```
(`dashboard-chart-legend` has no CSS rule — dead, drop silently.)

Line 252-256, change:
```tsx
            <div className="dashboard-chart-tabs">
              <Button size="sm" type="button" variant={chartMode === "revenue" ? "outline" : "ghost"} onClick={() => setChartMode("revenue")}>{copy.revenue}</Button>
              <Button size="sm" type="button" variant={chartMode === "payments" ? "outline" : "ghost"} onClick={() => setChartMode("payments")}>{copy.payments}</Button>
              <Button size="sm" type="button" variant={chartMode === "orders" ? "outline" : "ghost"} onClick={() => setChartMode("orders")}>{copy.orders}</Button>
            </div>
```
to:
```tsx
            <div className="inline-flex gap-0.5 rounded-lg bg-muted/40 p-0.5">
              <Button size="sm" type="button" variant={chartMode === "revenue" ? "outline" : "ghost"} className="h-8 rounded-md border-transparent font-medium shadow-none data-[variant=outline]:border-border data-[variant=outline]:bg-card data-[variant=outline]:text-primary data-[variant=outline]:shadow-sm" onClick={() => setChartMode("revenue")}>{copy.revenue}</Button>
              <Button size="sm" type="button" variant={chartMode === "payments" ? "outline" : "ghost"} className="h-8 rounded-md border-transparent font-medium shadow-none data-[variant=outline]:border-border data-[variant=outline]:bg-card data-[variant=outline]:text-primary data-[variant=outline]:shadow-sm" onClick={() => setChartMode("payments")}>{copy.payments}</Button>
              <Button size="sm" type="button" variant={chartMode === "orders" ? "outline" : "ghost"} className="h-8 rounded-md border-transparent font-medium shadow-none data-[variant=outline]:border-border data-[variant=outline]:bg-card data-[variant=outline]:text-primary data-[variant=outline]:shadow-sm" onClick={() => setChartMode("orders")}>{copy.orders}</Button>
            </div>
```
Before trusting the `data-[variant=outline]:` selector above, confirm `src/components/ui/button.tsx` actually stamps `data-variant={variant}` on the DOM node (it does — see the earlier read of `button.tsx:57` in this session: `data-variant={variant}`), so `data-[variant=outline]:` is a valid Tailwind arbitrary-attribute variant here, not a guess.

This is the segmented-tab-button pattern (`dashboard-chart-tabs button[class*="border"]` was a hack keying off whether the button happened to carry a Tailwind `border` class — replaced here with the actual `data-variant` attribute the component already exposes, which is more correct than the original CSS was). The exact same `dashboard-chart-tabs` pattern repeats twice more (Tasks 8's `ProductsTablePanel` and `ParetoPanel`) — once this Task 6 conversion is verified working, Task 8 reuses the identical Button className string rather than re-deriving it.

Line 259, change:
```tsx
        <CardContent className="dashboard-chart-body p-3">
```
to:
```tsx
        <CardContent className="p-3 px-3 pt-2 pb-3.5">
```
(`padding: 0.5rem 0.75rem 0.875rem` = top 8px / right+left 12px / bottom 14px = `pt-2 px-3 pb-3.5`; combined with the existing `p-3` this task changes only top/bottom to match what the CSS forced — write the final className as `"px-3 pt-2 pb-3.5"`, dropping the now-redundant `p-3`.)

Line 190, change:
```tsx
    <ChartContainer config={config} className="dashboard-main-chart  w-full">
```
to:
```tsx
    <ChartContainer config={config} className="w-full overflow-visible">
```

Line 270, change:
```tsx
      <Card className="dashboard-card dashboard-ledger-card overflow-hidden">
```
to:
```tsx
      <Card className="overflow-hidden shadow-sm">
```
(`dashboard-ledger-card` has no CSS rule — dead, drop silently.)

Line 271, change:
```tsx
        <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
```
to:
```tsx
        <CardHeader className={cn(dashboardCardHeaderClass, "flex-row items-center justify-between border-b")}>
```

Line 281-287, change:
```tsx
                <div
                  key={row.key}
                  className={cn(
                    "dashboard-ledger-row flex items-center justify-between gap-3 border-b border-dashed py-2 text-sm last:border-b-0",
                    row.important && "dashboard-ledger-total mt-2 rounded-md border border-border bg-primary/10 px-3 font-semibold"
                  )}
                >
```
to:
```tsx
                <div
                  key={row.key}
                  className={cn(
                    "flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-b-0",
                    row.important && "-mx-1 mt-2 rounded-md border border-primary/14 bg-primary/7 px-3 font-semibold"
                  )}
                >
```
(`padding-block: 0.58rem` ≈ `py-2.5`/10px, close enough. `margin-inline: -0.25rem` = `-mx-1`. `background: var(--dashboard-green-tint) !important` = `bg-primary/7` — the `!important` was only needed because the CSS class had lower specificity than something else in the cascade; a plain Tailwind utility class doesn't need it since utility classes are applied directly as the element's own class, no specificity fight.)

- [ ] **Step 2: Delete the replaced CSS rules from `dashboard.css`**

Delete: `.dashboard-revenue-grid, .dashboard-operations-grid, .dashboard-products-grid`, `.dashboard-chart-body`, `.dashboard-chart-tools`, `.dashboard-chart-tabs`, `.dashboard-chart-tabs button`, `.dashboard-chart-tabs button[class*="border"]`, `.dashboard-main-chart, .dashboard-pareto-chart`, `.dashboard-screen .recharts-cartesian-grid line`, `.dashboard-screen .recharts-cartesian-axis-tick text`, `.dashboard-screen .recharts-tooltip-wrapper` (moved to globals.css in Step 1), `.dashboard-ledger-row`, `.dashboard-ledger-total`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Dev server: on the daily-sales chart card, click all three tabs (revenue/payments/orders) — confirm the active tab shows a white/card background with shadow and primary text color, inactive tabs are transparent/ghost. Confirm the chart itself still renders with dashed gridlines and correctly colored axis text. Scroll to the accounting ledger card — confirm rows have a bottom dashed... (note: CSS originally said `border-dashed`, kept as `border-dashed` in the JSX already, unchanged by this task) border and the "important" (total) row has a subtle green background and rounded border. Check dark mode on all of the above.

- [ ] **Step 4: Commit**

```bash
git add src/features/dashboard/overview/components/dashboard-chart-widgets.tsx src/features/dashboard/overview/dashboard.css src/app/globals.css
git commit -m "refactor(dashboard): convert revenue chart and accounting ledger cards to Tailwind"
```

---

### Task 7: Convert `DashboardOperationsGrid` (channel donut, table status, insight cards)

**Files:**
- Modify: `src/features/dashboard/overview/components/dashboard-chart-widgets.tsx:314-523`
- Modify: `src/features/dashboard/overview/dashboard.css` (delete listed rules)

**Interfaces:**
- Consumes: `dashboardCardHeaderClass` from Task 5 (already imported by Task 6 — no new import needed, same file).

- [ ] **Step 1: Convert `ChannelDonutPanel`**

CSS being retired:

```css
.dashboard-channel-content {
  align-items: center;
}

.dashboard-channel-row {
  gap: 0.625rem;
  font-size: 0.78rem;
}

.dashboard-channel-share {
  display: flex;
  min-width: 8.25rem;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.15rem;
  font-family: var(--font-geist-mono, ui-monospace), "Noto Sans Lao", monospace;
  font-size: 0.7rem;
  color: var(--dashboard-muted);
}

.dashboard-channel-share span:last-child {
  color: var(--dashboard-ink);
  font-weight: 700;
}
```

Line 323, change:
```tsx
    <Card className="dashboard-card dashboard-channel-card overflow-hidden">
```
to:
```tsx
    <Card className="overflow-hidden shadow-sm">
```
(`dashboard-channel-card` has no CSS rule — dead, drop silently.)

Line 324, change:
```tsx
      <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
```
to:
```tsx
      <CardHeader className={cn(dashboardCardHeaderClass, "flex-row items-center justify-between border-b")}>
```

Line 331, change:
```tsx
      <CardContent className="dashboard-channel-content  grid gap-4 p-4 md:grid-cols-[10.5rem_1fr] xl:grid-cols-1">
```
to:
```tsx
      <CardContent className="grid items-center gap-4 p-4 md:grid-cols-[10.5rem_1fr] xl:grid-cols-1">
```

Line 351, change:
```tsx
                <div key={row.key} className="dashboard-channel-row grid grid-cols-[auto_1fr_auto] items-center gap-2 text-sm">
```
to:
```tsx
                <div key={row.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 text-[0.78rem]">
```

Line 359, change:
```tsx
                  <div className="dashboard-channel-share">
```
to:
```tsx
                  <div className="flex min-w-33 flex-col items-end gap-0.5 font-mono text-[0.7rem] text-muted-foreground [&>span:last-child]:font-bold [&>span:last-child]:text-foreground">
```
(`8.25rem` = `132px` = `min-w-33`. `var(--font-geist-mono, ui-monospace), "Noto Sans Lao", monospace` — this project's actual mono stack is provided by Tailwind's own `font-mono` utility per this project's `src/design-system/fonts.ts`/`globals.css` font setup; use `font-mono` rather than re-declaring the same three-font fallback chain by hand. `span:last-child` styling is expressed via Tailwind's `[&>span:last-child]:` arbitrary-child variant since these are plain `<span>`s without their own className props to edit directly — check the JSX at lines 360-361 to confirm both are bare `<span>{...}</span>` with no existing className, which they are.)

- [ ] **Step 2: Convert `TableStatusPanel`**

No dedicated custom classes here beyond `dashboard-card`/`dashboard-card-header` (already handled generically) and `dashboard-table-status-card` (dead, no CSS rule — confirm with `git grep -n "dashboard-table-status-card"` then drop silently) — this panel was already built with pure Tailwind utilities.

Line 391, change:
```tsx
    <Card className="dashboard-card dashboard-table-status-card overflow-hidden">
```
to:
```tsx
    <Card className="overflow-hidden shadow-sm">
```

Line 392, change:
```tsx
      <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
```
to:
```tsx
      <CardHeader className={cn(dashboardCardHeaderClass, "flex-row items-center justify-between border-b")}>
```

- [ ] **Step 3: Convert `InsightCardsPanel`**

CSS being retired:

```css
.dashboard-insight-tile {
  border-radius: 10px;
}

.dashboard-insight-tile p:first-child {
  font-size: 0.66rem;
  letter-spacing: 0.14em;
}

.dashboard-insight-tile p:nth-child(2) {
  font-size: 1.08rem;
  letter-spacing: -0.01em;
}
```

`dashboard-insight-card` (on the outer `<Card>`, line 476) has no CSS rule — dead, drop silently, same pattern as Steps 1-2.

Line 476, change:
```tsx
    <Card className="dashboard-card dashboard-insight-card overflow-hidden">
```
to:
```tsx
    <Card className="overflow-hidden shadow-sm">
```

Line 477, change:
```tsx
      <CardHeader className="dashboard-card-header border-b px-4 py-3">
```
to:
```tsx
      <CardHeader className={cn(dashboardCardHeaderClass, "border-b")}>
```

Lines 482-486, change:
```tsx
          <div key={card.label} className={cn("dashboard-insight-tile rounded-lg border p-4", card.className)}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">{card.label}</p>
            <p className="mt-2 truncate text-lg font-semibold text-foreground">{card.name}</p>
            <p className="mt-1 tabular-nums text-xs text-muted-foreground">{card.value}</p>
          </div>
```
to:
```tsx
          <div key={card.label} className={cn("rounded-[10px] border p-4", card.className)}>
            <p className="text-[0.66rem] font-semibold tracking-[0.14em] uppercase">{card.label}</p>
            <p className="mt-2 truncate text-[1.08rem] tracking-[-0.01em] font-semibold text-foreground">{card.name}</p>
            <p className="mt-1 tabular-nums text-xs text-muted-foreground">{card.value}</p>
          </div>
```
(This one keeps its arbitrary values as-is since `10px`/`0.66rem`/`1.08rem` don't land cleanly on Tailwind's default type scale and the difference is visually meaningful for a label/value hierarchy like this — acceptable arbitrary-value usage since it's sizing, not color.)

- [ ] **Step 4: Convert the grid wrapper**

Line 511, change:
```tsx
    <div className="dashboard-operations-grid grid gap-4 xl:grid-cols-3">
```
to:
```tsx
    <div className="grid gap-4 xl:grid-cols-3">
```

- [ ] **Step 5: Delete the replaced CSS rules from `dashboard.css`**

Delete: `.dashboard-channel-content`, `.dashboard-channel-row`, `.dashboard-channel-share`, `.dashboard-channel-share span:last-child`, `.dashboard-insight-tile`, `.dashboard-insight-tile p:first-child`, `.dashboard-insight-tile p:nth-child(2)`, and the responsive `.dashboard-channel-row { grid-template-columns: auto minmax(0, 1fr) }` / `.dashboard-channel-share { grid-column: 2; align-items: flex-start }` overrides inside the `@media (max-width: 767px)` block — port these two as `max-md:grid-cols-[auto_minmax(0,1fr)]` on the Step 1 row div and `max-md:col-start-2 max-md:items-start` on the Step 1 share div.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Dev server: confirm the channel donut chart still centers correctly with its legend list, confirm the mono-font percentage column right-aligns with the last line bolded, confirm the table-status progress bar and 3-stat grid look unchanged, confirm insight tiles show their 4-5 colored variants (best product/main channel/highest revenue/watch product/cancellations) with correct border/background tinting per `card.className`. Check dark mode and the sub-768px layout (channel share column should move under the row on mobile).

- [ ] **Step 7: Commit**

```bash
git add src/features/dashboard/overview/components/dashboard-chart-widgets.tsx src/features/dashboard/overview/dashboard.css
git commit -m "refactor(dashboard): convert operations grid (channel/table-status/insights) to Tailwind"
```

---

### Task 8: Convert `DashboardProductsParetoGrid` (products table + pareto chart)

**Files:**
- Modify: `src/features/dashboard/overview/components/dashboard-chart-widgets.tsx:525-719`
- Modify: `src/features/dashboard/overview/dashboard.css` (delete listed rules)

- [ ] **Step 1: Convert `ProductsTablePanel`**

CSS being retired:

```css
.dashboard-table-wrap {
  scrollbar-width: thin;
  scrollbar-color: hsl(var(--muted-foreground) / 0.45) transparent;
}

.dashboard-products-table thead tr {
  border-color: var(--dashboard-line);
  background: var(--dashboard-surface-2);
}

.dashboard-products-table th {
  height: 2.35rem;
  color: var(--dashboard-muted);
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.dashboard-products-table td {
  height: 3.05rem;
  border-color: var(--dashboard-line);
}

.dashboard-products-table tbody tr:hover {
  background: var(--dashboard-surface-2);
}

.dashboard-product-avatar {
  border: 1px solid var(--dashboard-line);
  background: var(--dashboard-surface-2);
}

.dashboard-product-avatar img {
  object-fit: cover;
}

.dashboard-products-actions {
  min-width: max-content;
}

.dashboard-products-actions [role="combobox"] {
  height: 2rem;
  border-radius: 0.5rem;
  background: hsl(var(--card));
  font-weight: 700;
}
```

`.dashboard-table-wrap` already has its exact Tailwind equivalent elsewhere in this codebase — reuse the same scrollbar utility class other tables use rather than reinventing it. Check `src/app/globals.css` for the existing `.settings-table-scroll` / `.app-sidebar-scroll` pattern (both defined at lines 950-960 with the identical `scrollbar-width: thin; scrollbar-color: hsl(var(--muted-foreground) / 0.45) transparent`) — reuse `.app-sidebar-scroll`'s class name directly on this element instead of keeping a third near-duplicate rule:

Line 576, change:
```tsx
          <div className="dashboard-table-wrap overflow-x-auto">
```
to:
```tsx
          <div className="app-sidebar-scroll overflow-x-auto">
```
(This reuses an existing global utility class rather than inventing a new one — better alignment with "reuse before creating" from CLAUDE.md than porting a third copy of the same 2-line rule as a new dashboard-scoped class would be.)

Line 577, change:
```tsx
            <Table className="dashboard-products-table ">
```
to:
```tsx
            <Table className="[&_thead_tr]:border-border [&_thead_tr]:bg-muted/38 [&_th]:h-9.5 [&_th]:text-[0.68rem] [&_th]:font-semibold [&_th]:tracking-[0.1em] [&_th]:text-muted-foreground [&_th]:uppercase [&_td]:h-12.5 [&_td]:border-border [&_tbody_tr:hover]:bg-muted/38">
```
(All four sub-selectors collapse onto arbitrary-child variants on the `<Table>` root since `TableHead`/`TableCell`/`TableRow` are shared components used everywhere else in the app with their own defaults — adding per-usage overrides only here, scoped to this one `<Table>` instance via descendant arbitrary variants, is correct and doesn't leak into other tables the way editing `table.tsx` itself would. `2.35rem`=`37.6px`≈`h-9.5`(38px), `3.05rem`=`48.8px`≈`h-12.5`(50px) — both within this plan's rounding tolerance.)

Line 593, change:
```tsx
                        <Avatar className="dashboard-product-avatar rounded-md" size="lg">
```
to:
```tsx
                        <Avatar className="rounded-md border border-border bg-muted/38 [&_img]:object-cover" size="lg">
```

Line 553, change:
```tsx
        <div className="dashboard-products-actions flex shrink-0 items-center gap-2">
```
to:
```tsx
        <div className="flex min-w-max shrink-0 items-center gap-2">
```

Lines 554-557 (`dashboard-chart-tabs` — same segmented-button pattern already converted in Task 6 Step 1; reuse the exact same wrapper + Button className strings derived there):
```tsx
          <div className="dashboard-chart-tabs">
            <Button size="sm" type="button" variant={sortMode === "qty" ? "outline" : "ghost"} onClick={() => setSortMode("qty")}>{copy.byQty}</Button>
            <Button size="sm" type="button" variant={sortMode === "revenue" ? "outline" : "ghost"} onClick={() => setSortMode("revenue")}>{copy.byRevenue}</Button>
          </div>
```
to:
```tsx
          <div className="inline-flex gap-0.5 rounded-lg bg-muted/40 p-0.5">
            <Button size="sm" type="button" variant={sortMode === "qty" ? "outline" : "ghost"} className="h-8 rounded-md border-transparent font-medium shadow-none data-[variant=outline]:border-border data-[variant=outline]:bg-card data-[variant=outline]:text-primary data-[variant=outline]:shadow-sm" onClick={() => setSortMode("qty")}>{copy.byQty}</Button>
            <Button size="sm" type="button" variant={sortMode === "revenue" ? "outline" : "ghost"} className="h-8 rounded-md border-transparent font-medium shadow-none data-[variant=outline]:border-border data-[variant=outline]:bg-card data-[variant=outline]:text-primary data-[variant=outline]:shadow-sm" onClick={() => setSortMode("revenue")}>{copy.byRevenue}</Button>
          </div>
```

Line 560, change:
```tsx
              <SelectTrigger className="h-8 w-full font-mono text-xs">
```
to:
```tsx
              <SelectTrigger className="h-8 w-full rounded-lg bg-card font-mono text-xs font-bold">
```
(`.dashboard-products-actions [role="combobox"] { height: 2rem; border-radius: 0.5rem; background: hsl(var(--card)); font-weight: 700 }` — the `h-8` was already present in the JSX matching `height: 2rem` exactly; adding the missing `rounded-lg bg-card font-bold`.)

Line 547, change:
```tsx
    <Card className="dashboard-card dashboard-products-card overflow-hidden">
```
to:
```tsx
    <Card className="overflow-hidden shadow-sm">
```
(`dashboard-products-card` has no CSS rule — dead, drop silently.)

Line 548, change:
```tsx
      <CardHeader className="dashboard-card-header flex-row items-center justify-between border-b px-4 py-3">
```
to:
```tsx
      <CardHeader className={cn(dashboardCardHeaderClass, "flex-row items-center justify-between border-b")}>
```

- [ ] **Step 2: Convert `ParetoPanel`**

`dashboard-pareto-card` has no CSS rule (dead, drop silently). `dashboard-pareto-chart` was already handled in Task 6 Step 1 (`.dashboard-main-chart, .dashboard-pareto-chart { overflow: visible }`).

Line 659, change:
```tsx
    <Card className="dashboard-card dashboard-pareto-card overflow-hidden">
```
to:
```tsx
    <Card className="overflow-hidden shadow-sm">
```

Line 660, change:
```tsx
      <CardHeader className="dashboard-card-header border-b px-4 py-3">
```
to:
```tsx
      <CardHeader className={cn(dashboardCardHeaderClass, "border-b")}>
```

Line 665, change (same segmented-tab pattern, third and final occurrence):
```tsx
        <div className="dashboard-chart-tabs">
          <Button size="sm" type="button" variant={metric === "revenue" ? "outline" : "ghost"} onClick={() => setMetric("revenue")}>{copy.revenue}</Button>
          <Button size="sm" type="button" variant={metric === "qty" ? "outline" : "ghost"} onClick={() => setMetric("qty")}>{copy.qty}</Button>
        </div>
```
to:
```tsx
        <div className="inline-flex gap-0.5 rounded-lg bg-muted/40 p-0.5">
          <Button size="sm" type="button" variant={metric === "revenue" ? "outline" : "ghost"} className="h-8 rounded-md border-transparent font-medium shadow-none data-[variant=outline]:border-border data-[variant=outline]:bg-card data-[variant=outline]:text-primary data-[variant=outline]:shadow-sm" onClick={() => setMetric("revenue")}>{copy.revenue}</Button>
          <Button size="sm" type="button" variant={metric === "qty" ? "outline" : "ghost"} className="h-8 rounded-md border-transparent font-medium shadow-none data-[variant=outline]:border-border data-[variant=outline]:bg-card data-[variant=outline]:text-primary data-[variant=outline]:shadow-sm" onClick={() => setMetric("qty")}>{copy.qty}</Button>
        </div>
```

Line 673, change:
```tsx
            <ChartContainer config={config} className="dashboard-pareto-chart h-72 w-full">
```
to:
```tsx
            <ChartContainer config={config} className="h-72 w-full overflow-visible">
```

- [ ] **Step 3: Convert `MiniFact`**

CSS being retired:

```css
.dashboard-mini-fact {
  border-color: var(--dashboard-line);
  border-radius: 8px;
  background: var(--dashboard-surface-2);
}
```

Line 151, change:
```tsx
    <div className="dashboard-mini-fact rounded-lg border border-border bg-card px-3 py-2">
```
to:
```tsx
    <div className="rounded-lg border border-border bg-muted/38 px-3 py-2">
```
(This element already had `rounded-lg` (8px) and `border border-border` in its own className — the CSS's `border-color`/`border-radius` were fully redundant with what was already there; only `background: var(--dashboard-surface-2)` (`bg-card` → `bg-muted/38`) actually needed changing.)

- [ ] **Step 4: Convert the grid wrapper**

Line 714, change:
```tsx
    <div className="dashboard-products-grid grid gap-4 xl:grid-cols-[1.3fr_1fr]">
```
to:
```tsx
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
```

- [ ] **Step 5: Delete the replaced CSS rules from `dashboard.css`**

Delete: `.dashboard-table-wrap`, `.dashboard-products-table thead tr`, `.dashboard-products-table th`, `.dashboard-products-table td`, `.dashboard-products-table tbody tr:hover`, `.dashboard-product-avatar`, `.dashboard-product-avatar img`, `.dashboard-products-actions`, `.dashboard-products-actions [role="combobox"]`, `.dashboard-mini-fact`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Dev server: confirm the products table header row has the tinted background and uppercase small labels, row hover highlights, product avatar has a bordered/tinted fallback square, the qty/revenue sort toggle and top-N select still work and look consistent with the other two segmented-tab instances from Tasks 6-7. Confirm the pareto chart's bar+line combo renders, its own qty/revenue toggle works, and the three `MiniFact` tiles at the bottom show the tinted background. Check dark mode.

- [ ] **Step 7: Commit**

```bash
git add src/features/dashboard/overview/components/dashboard-chart-widgets.tsx src/features/dashboard/overview/dashboard.css
git commit -m "refactor(dashboard): convert products table and pareto chart cards to Tailwind"
```

---

### Task 9: Convert root wrapper + footer; delete `dashboard.css` entirely

**Files:**
- Modify: `src/features/dashboard/overview/dashboard-page.tsx:1-10, 372-373`
- Modify: `src/features/dashboard/overview/components/dashboard-widgets.tsx:759-771`
- Delete: `src/features/dashboard/overview/dashboard.css`

**Interfaces:**
- Produces: `dashboard.css` no longer exists; nothing in the app imports it after this task.

- [ ] **Step 1: Confirm every other class has been migrated**

Run: `wc -l src/features/dashboard/overview/dashboard.css`
Expected: only the root `.dashboard-screen`/`.dark .dashboard-screen` custom-property block and `.dashboard-footer` should remain (everything else was deleted across Tasks 2-8). If anything else remains, stop and go back — a class was missed in an earlier task.

- [ ] **Step 2: Convert `.dashboard-screen`**

CSS being retired:

```css
.dashboard-screen {
  --dashboard-surface: hsl(var(--card));
  --dashboard-surface-2: hsl(var(--muted) / 0.34);
  --dashboard-line: hsl(var(--border));
  --dashboard-line-strong: hsl(var(--border) / 0.92);
  --dashboard-ink: hsl(var(--foreground));
  --dashboard-muted: hsl(var(--muted-foreground));
  --dashboard-green: hsl(var(--primary));
  --dashboard-green-soft: hsl(var(--primary) / 0.11);
  --dashboard-green-tint: hsl(var(--primary) / 0.07);
  --dashboard-amber: hsl(38 92% 46%);
  --dashboard-amber-soft: hsl(38 92% 50% / 0.13);
  --dashboard-rose: hsl(var(--destructive));
  --dashboard-rose-soft: hsl(var(--destructive) / 0.11);
  --dashboard-shadow-sm: 0 1px 0 hsl(var(--foreground) / 0.04);
  --dashboard-shadow-md: 0 1px 2px hsl(var(--foreground) / 0.05), 0 1px 0 hsl(var(--foreground) / 0.03);
  --dashboard-hero-bg: linear-gradient(135deg, hsl(150 72% 19%) 0%, hsl(var(--primary)) 100%);
  --dashboard-hero-fg: hsl(var(--primary-foreground));
  --dashboard-hero-fg-muted: hsl(var(--primary-foreground) / 0.72);
  width: 100%;
  max-width: 1480px;
  margin-inline: auto;
  gap: 1rem;
  font-feature-settings: "tnum";
}

.dark .dashboard-screen {
  --dashboard-surface-2: hsl(var(--muted) / 0.42);
  --dashboard-line-strong: hsl(var(--border) / 0.8);
  --dashboard-shadow-sm: 0 1px 0 hsl(0 0% 0% / 0.38);
  --dashboard-shadow-md: 0 1px 2px hsl(0 0% 0% / 0.28), 0 1px 0 hsl(0 0% 0% / 0.32);
  --dashboard-hero-bg: linear-gradient(135deg, hsl(151 68% 34%) 0%, hsl(151 68% 48%) 100%);
  --dashboard-hero-fg: hsl(138 70% 97%);
  --dashboard-hero-fg-muted: hsl(138 38% 86% / 0.82);
}

@media (max-width: 1279px) {
  .dashboard-screen {
    max-width: 100%;
  }
}
```

By this point (after Tasks 2-8), every one of these custom properties has already been superseded by a direct Tailwind utility at its point of use — this block only still supplies `width`/`max-width`/`margin-inline`/`gap`/`font-feature-settings` on the root wrapper. Convert those five:

Change `dashboard-page.tsx` line 373 from:
```tsx
    <div className="dashboard-screen flex flex-col gap-4">
```
to:
```tsx
    <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-4 tabular-nums max-lg:max-w-full">
```
(`font-feature-settings: "tnum"` is exactly Tailwind's `tabular-nums` utility. `max-width: 1480px` has no matching Tailwind step — kept as an arbitrary value, which is sizing not color, same carve-out used elsewhere in this plan. `@media (max-width: 1279px) { max-width: 100% }` → Tailwind's `lg` breakpoint is `1024px` not `1279px`; there is no default breakpoint at 1280px in this project's config — check `tailwind.config`/`@theme` for a custom `xl`/`2xl` value before assuming `lg:`/`xl:` line up with `1279px`; if the project's `xl` breakpoint is the default `1280px`, use `max-xl:max-w-full` instead of `max-lg:max-w-full` to match the original breakpoint exactly.)

- [ ] **Step 3: Convert `.dashboard-footer`**

CSS being retired:

```css
.dashboard-footer {
  color: hsl(var(--muted-foreground) / 0.78);
}
```

Change `dashboard-widgets.tsx` line 766 from:
```tsx
    <div className="dashboard-footer flex flex-wrap justify-between gap-2 pt-2 text-xs text-muted-foreground">
```
to:
```tsx
    <div className="flex flex-wrap justify-between gap-2 pt-2 text-xs text-muted-foreground/78">
```
(The element already had `text-xs text-muted-foreground` — this just adds the `/78` opacity the CSS was forcing; note the component currently renders no visible content at all, both children are commented out at lines 767-768 — leave that as-is, out of scope for this styling migration.)

- [ ] **Step 4: Delete `dashboard.css` and its import**

Run: `wc -l src/features/dashboard/overview/dashboard.css`
Expected: `0` remaining rules of substance (file is now empty or near-empty after Steps 2-3's deletions plus every prior task's deletions).

Find and remove the CSS import. Run: `git grep -n "dashboard.css\|dashboard\\.css" src/features/dashboard/overview/dashboard-page.tsx`
Expected: one `import "./dashboard.css";`-style line near the top of `dashboard-page.tsx` (not shown in this plan's earlier read of that file's first 42 lines — re-check, since Next.js requires a global CSS side-effect import for a page-scoped stylesheet like this one; if the import instead lives in `layout.tsx` or elsewhere, remove it from wherever it actually is).

Delete that import line, then delete the file:
```bash
rm src/features/dashboard/overview/dashboard.css
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit`
Expected: zero errors.

Run: `npm run build`
Expected: build succeeds — this specifically catches a missing/dangling CSS import that `tsc` alone would not catch (Next.js resolves CSS imports at build time, not typecheck time).

Dev server: load the full dashboard page top to bottom in both light and dark mode, at three widths (mobile <768px, tablet 768-1279px, desktop 1280px+). Nothing should look meaningfully different from the pre-migration screenshots taken at the start of Task 2, modulo the deliberate simplifications called out in Tasks 2 and 4 (dropped container-query breakpoint layer, dropped decorative corner-glow, simplified fluid clamp() to a fixed breakpoint step).

- [ ] **Step 6: Commit**

```bash
git add -A src/features/dashboard/overview/
git commit -m "refactor(dashboard): convert root wrapper and footer, delete dashboard.css"
```

---

## Self-Review Notes

**Spec coverage:** Every top-level CSS class enumerated during planning (`dashboard-screen`, `dashboard-page-head`, `dashboard-head-actions`†, `dashboard-filter-*`, `dashboard-range-segment`†, `dashboard-query-*`, `dashboard-warning-banner`, `dashboard-payment-*`, `dashboard-hero-*`, `dashboard-spark-*`, `dashboard-card`/`dashboard-card-header`, `dashboard-chart-*`, `dashboard-main-chart`/`dashboard-pareto-chart`, `recharts-*`, `dashboard-ledger-*`, `dashboard-channel-*`, `dashboard-insight-tile`, `dashboard-table-wrap`, `dashboard-products-*`, `dashboard-product-avatar`, `dashboard-mini-fact`, `dashboard-footer`) is addressed by exactly one task above. Two items marked † (`dashboard-head-actions`, `dashboard-range-segment`) have CSS rules in `dashboard.css` (lines 69-72, 97-121) but were not found attached to any JSX element during this plan's file reads — Task 2 Step 7 and Task 4 Step 4's deletion passes should each run `git grep` for these two specific class names before deleting their rules, and if a real usage turns up that this plan missed, convert it inline following the nearest analogous step's pattern before deleting.

**Placeholder scan:** No "TBD"/"handle appropriately"/"similar to Task N without code" patterns — every step either shows the literal before/after class string or the literal CSS block being deleted.

**Type consistency:** `dashboardCardHeaderClass` is defined once in Task 5 Step 1 and consumed identically (same import, same usage pattern `cn(dashboardCardHeaderClass, "...")`) by Tasks 6, 7, and 8 — no naming drift. `paymentSummaryTone`'s return type changes from `string` to `{ card: string; icon: string; value?: string }` in Task 3 Step 2 — both call sites in that same task are updated to match; no other task calls `paymentSummaryTone`.
