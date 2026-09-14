# Web AppHeader — Modern/Minimal/Premium Redesign

## Problem

`AppHeader` (in [app-shell.tsx:164](../../../src/components/layout/web/app-shell.tsx)) — the persistent top header for the web/Electron app shell — looks visually flat and utilitarian: a solid `bg-background` surface with a hard `border-b`, a hard vertical `Separator` splitting brand from navigation, square-edged icon buttons spread out with no visual grouping, and breadcrumb text with no clear hierarchy between the trail and the current page. The rest of the app has been getting design passes (public-pos nightfall redesign, POS motion polish); the header — visible on every screen, at all times — has not.

## Goals

- Make the header read as modern, minimal, clean, elegant, and premium (glass-like depth, soft groupings, clear typographic hierarchy) without changing any behavior, route, or data flow.
- Reuse existing semantic tokens only (`bg-muted`, `bg-background`, `border-border`, `text-muted-foreground`, etc.) — no raw colors, per [Design.md](../../Design.md).
- Keep `--app-shell-header-height` and all responsive breakpoints (mobile/`sm`/`md`/`lg`/`xl`) exactly as-is — nothing else in the shell (sidebar `top` offset, main content sizing) should need to change.

## Non-goals

- `capacitor/top-bar.tsx` (native Android header) — separate component, out of scope for this pass.
- Any change to breadcrumb overflow logic, sidebar collapse logic, auth/menu data flow, or the `useAppShellData`/`shell-breadcrumbs` computation — visual only.
- Scroll-position-aware shadow ("shadow appears only after scrolling") — would need a scroll listener + state; a static soft shadow + backdrop blur (see below) gets the same "depth" feel with zero added JS/complexity.
- Two-tier (stacked) header layout — considered and rejected: it would change `--app-shell-header-height`, which `AppSidebar`'s `top-(--app-shell-header-height)` and other layout math depend on. Out of scope for this pass.

## Changes — all within `AppHeader` / `AppBreadcrumb` in `app-shell.tsx`

### 1. Header surface

`<header>`: replace `bg-background` (implicit) + `border-b border-border` with `bg-background/80 backdrop-blur-md` + `shadow-sm` (soft depth instead of a hard line). Sticky positioning, height variable, and z-index unchanged.

### 2. Brand block (logo + branch name + address)

- Remove the vertical `Separator` between the brand link and the nav/breadcrumb area; rely on `gap` spacing instead.
- `Avatar`: `rounded-md` → `rounded-xl`; add `ring-1 ring-border/50` that strengthens on hover/focus (`hover:ring-primary/30 focus-visible:ring-primary/30`) instead of a static heavy border.
- `branchTitle` span: add `tracking-tight` alongside the existing `font-black` for a tighter, more premium wordmark feel.
- Address span, tooltip behavior, `Link` href/title — unchanged.

### 3. Navigation (back button) + Breadcrumb

- Icon-only back button (mobile, `SidebarTrigger` and the `ChevronLeft` button): add `rounded-full hover:bg-muted` so hover reads as a soft pill instead of a square ghost-button hover.
- Text back button (desktop): same `rounded-full hover:bg-muted` treatment, keep icon+text content and `router.back()` behavior.
- `AppBreadcrumb`: non-current trail items (`BreadcrumbLink`/disabled `BreadcrumbPage` in the middle/first slot) get `text-muted-foreground/70`; the current page (`renderItem(..., current=true)`) becomes `font-semibold text-foreground` (currently `font-semibold` without an explicit color, which already resolves to foreground — make it explicit for clarity); `BreadcrumbSeparator` icon gets `opacity-50`. Overflow ellipsis dropdown, `internalRoute()` usage, and item click behavior unchanged.

### 4. Right action toolbar + profile

- Wrap the existing button group — conditional `RefreshCw` (Capacitor only), `ThemeToggle`, `NotificationMenu`, `LanguageSwitch` — in a single pill container: `bg-muted/40 rounded-full p-1 flex items-center gap-0.5`.
- Each button inside keeps its existing size (`size-11 sm:size-9`) and `aria-label`/tooltip; change hover from the default ghost-button hover to `hover:bg-background` so each button appears to "lift" out of the pill on hover/focus. No separators between buttons inside the pill (kept minimal).
- Profile `DropdownMenuTrigger` `Button` stays **outside** the pill (it's the primary right-side action, kept visually distinct) but gets the same `rounded-full hover:bg-muted` treatment as the nav buttons, so the whole right-hand cluster reads as one consistent family. Avatar, email, chevron, dropdown content/items (edit profile, policy, sign out) unchanged.

## Explicitly not changed

- All `aria-label`s, `Tooltip` content/behavior, i18n keys, `data-icon` attributes.
- `AppSidebar`, `SidebarInset`, `main` content sizing, `FloatingSettingsButton`.
- Breadcrumb data computation (`useAppShellData`, `shell-breadcrumbs.ts`), `menuItemLabel`, `userInitials`.
- Mobile/tablet page-title `span`s (md:hidden / lg:hidden variants) — no visual change beyond what cascades from parent spacing.

## Testing

- No new unit-testable logic — purely Tailwind class changes on existing JSX. Existing tests (`shell-breadcrumbs.test.ts`, `shell-menu-helpers.test.ts`, `native-navigation-model.test.ts`) should keep passing unchanged.
- `npm run typecheck` and `npm run lint` after the edit.
- Manual verification in the browser preview:
  - Desktop width: brand block, breadcrumb hierarchy (current page vs. trail), right-side pill toolbar hover states, profile dropdown hover + open state.
  - Mobile/tablet width (`sm`/`md` breakpoints): sidebar trigger + back icon button pill hover, page-title fallback, collapsed brand block.
  - Light and dark theme (`ThemeToggle`) — confirm `bg-background/80 backdrop-blur-md`, `ring-border/50`, `bg-muted/40` all resolve sensibly in both, since these are the first semi-transparent/opacity-suffixed token usages in this component.
  - Keyboard focus states on back button, toolbar buttons, and profile trigger remain visible (`focus-visible:ring`) per [Design.md](../../Design.md) accessibility floor.
