# Responsive Protected Shell and Dashboard Design

**Date:** 2026-07-27
**Status:** Superseded on 2026-07-28 by `docs/superpowers/plans/2026-07-27-responsive-protected-shell-dashboard.md`; do not implement this Dashboard-heavy design
**Normative reference:** `Design.md`

## Goal

Introduce one adaptive protected-application shell for mobile, tablet, and desktop, then make Dashboard the first screen whose content is brought into the Quiet Service Ledger design system.

The shell must include:

- a shared responsive header;
- mobile bottom navigation;
- tablet and desktop navigation rails;
- protected POS routes inside the same shell;
- a route-owned refresh action in the header;
- safe-area, keyboard, dark-mode, and fixed-viewport support.

Dashboard refresh must reload dashboard data with the last applied branch and filters while preserving draft filter edits.

## Scope

### Included

- All routes under `src/app/(protected)/`.
- Shared shell structure, navigation, header, responsive geometry, and semantic styling.
- Protected POS routes:
  - `/pos/tables`
  - `/pos/order`
- Dashboard content under `/`.
- Dashboard refresh through `useDashboardStore`.
- Permission-aware navigation sourced from the existing sidebar menu data.
- Light and dark mode.
- Browser, Electron, and Capacitor geometry.

### Excluded

- Layout changes to `/home`, `/login`, `/policy`, public `/pos`, and `/customer-display`.
- A full content redesign of non-Dashboard management screens.
- Migrating every feature's existing refresh button into the shared header during this phase.
- New backend APIs, permissions, production data, or native capabilities.
- New UI frameworks, state managers, or overlapping dependencies.

Global semantic-token corrections may affect shared colors on public surfaces, but this phase must not change their route structure, navigation, or screen composition.

## Existing Constraints

- `src/app/(protected)/layout.tsx` wraps all protected routes in `AuthGuard` and `AppShell`.
- `AppShell` currently owns menu permissions, header, sidebar, breadcrumbs, fixed-screen geometry, and protected POS exceptions in one file.
- `/pos/tables` and `/pos/order` currently suppress the shared header and sidebar.
- `/pos/order` requires `table_uuid`; without it the route redirects to `/pos/tables`.
- `usePosStore` retains the most recently selected table during the client session.
- The app uses Tailwind CSS v4, shadcn-style Radix primitives, Lucide, Zustand, and client-side auth.
- `src/hooks/use-mobile.ts` and Tailwind's `md` breakpoint both use 768px.
- Existing Android compatibility code avoids runtime color behavior that older WebViews cannot render reliably.
- Fixed management screens calculate their usable height from the shell header.
- `SidebarInset` is already a `<main>` element, while `AppShell` currently renders another nested `<main>`.

## Design Decisions

### 1. One adaptive shell

Use a single Shared Adaptive AppShell rather than separate device shells.

`AppShell` remains responsible for:

- resolving route mode;
- loading and filtering permission-aware menu items;
- deriving breadcrumbs;
- providing refresh registration;
- coordinating shell geometry.

Focused components own presentation:

- `AppHeader`
- `AppSidebar`
- `AppBottomNav`
- mobile navigation sheets
- page refresh registration
- pure navigation derivation helpers

The split must preserve the current protected layout and layered application architecture.

### 2. Responsive matrix

Use Tailwind's existing mobile-first breakpoints. Do not introduce a new device breakpoint in this phase.

| Viewport | Shell composition |
|---|---|
| `<768px` | 60px header plus safe-area inset, no sidebar, fixed bottom navigation |
| `768px–1279px` | 64px header, collapsible rail supporting 72px and 210px |
| `>=1280px` | 64px header, collapsible rail supporting 210px and 72px |

Reference validation canvases:

- 393 × 852
- 768px wide
- 1024 × 1366
- 1280px wide
- 1440px wide

Use `100dvh` consistently for shell and fixed-screen height calculations.

Shell dimensions become named CSS variables:

- header height;
- expanded rail width: 210px;
- collapsed rail width: 72px;
- mobile bottom-navigation height;
- top, bottom, left, and right safe-area insets.

Main content must reserve bottom-navigation space on mobile. Fixed-screen pages must subtract both the header and applicable navigation inset without creating document-level horizontal scrolling.

### 3. Protected POS integration

Protected POS routes participate in the shared shell.

On mobile:

- show the compact shared header;
- show the five-item bottom navigation;
- keep POS-local controls;
- move the floating cart summary above the bottom navigation and bottom safe area;
- prevent the nav from covering sheets, cart actions, or scroll sentinels.

On tablet and desktop:

- show the shared header;
- default POS to the effective 72px rail so the split workspace remains usable;
- preserve the user's normal management-screen rail preference;
- leaving POS restores the management-screen preference without mutating it.

POS content remains task-specific. Adding the shared shell must not convert its menu-and-ticket workspace into a management-page layout.

### 4. Mobile bottom navigation

The mobile bottom navigation contains five destinations from `Design.md`:

1. Dashboard
2. Tables
3. POS
4. Reports
5. More

Behavior:

- Dashboard links to `/`.
- Tables links to `/pos/tables`.
- POS resumes the current `usePosStore` table through the existing order URL helper.
- If no table is selected, POS falls back to `/pos/tables`.
- Reports opens a bottom Sheet containing allowed report children because no `/report` index route currently exists.
- More opens a bottom Sheet containing the complete permission-filtered navigation tree.

Navigation must reuse the same permission-filtered `menuItems` as the rail. Do not hard-code visibility separately.

Every link uses `Link` and `internalRoute()` where required. Sheet triggers remain buttons.

Active state:

- 2px green marker at the top;
- quiet text and icon treatment;
- no filled green tile;
- `aria-current="page"` for the active destination;
- an optional non-color POS attention indicator only when backed by real state.

Active matching is destination-specific rather than a shared `/pos` prefix:

- Tables is active only on `/pos/tables`;
- POS is active only on `/pos/order`;
- Reports is active on `/report/*`;
- More is not marked active merely because the current route appears in its Sheet.

Both Sheets require:

- visible title and close affordance;
- focus return to their triggers;
- `overscroll-behavior: contain`;
- bottom safe-area padding;
- disabled items with an explanation rather than silent removal when the item is intentionally discoverable.

### 5. Navigation rail

The tablet and desktop rail uses:

- 210px expanded width;
- 72px collapsed width;
- 44px minimum rows;
- grouped labels;
- 2px green active marker;
- semantic surface, text, and border tokens;
- no filled active tile;
- permission-aware visibility.

Existing collapsed-state persistence remains in `useAppStore`.

Nested groups must expose `aria-expanded` and use an accessible collapsible primitive rather than relying only on local visual state.

Backend-provided Iconify/MDI names remain supported through the existing adapter. New fixed shell icons use Lucide only.

### 6. Header

The shared header is sticky and safe-area aware.

Mobile priority:

1. optional back action;
2. current page title;
3. registered refresh action;
4. notification action;
5. overflow menu for theme, language, and profile actions.

Tablet and desktop priority:

1. branch identity and navigation-rail relationship;
2. breadcrumb;
3. registered refresh action;
4. theme;
5. notifications;
6. language;
7. profile menu.

All icon-only actions require:

- localized `aria-label`;
- Tooltip on pointer-capable layouts;
- visible focus;
- at least a 44px target;
- 48px target in the Android production variant.

The mobile header must not retain the current combination of hamburger, back, title, theme, notifications, language, and profile in one crowded row. `More` replaces the mobile sidebar trigger.

### 7. Page-owned header refresh

The shell provides a small refresh-registration context. Feature components register:

- an async refresh callback;
- current busy state;
- localized accessible label;
- optional disabled state.

Registration is removed on route change or component unmount so the header cannot call a stale feature callback.

The header:

- hides refresh when the route has not registered an action;
- disables duplicate clicks while busy;
- shows `Spinner` in place of the Lucide refresh icon;
- sets `aria-busy`;
- does not animate routine data beyond the restrained icon transition;
- preserves the current page content while refreshing.

Dashboard registers a callback that calls the existing Dashboard load path with:

- the active branch;
- `appliedFilters`;
- the current `top` value;
- the current language.

It must not:

- call `window.location.reload()`;
- call `router.refresh()`;
- reset `filters`;
- apply unsubmitted draft filters;
- refresh the branch list as a side effect.

### 8. Dashboard information architecture

Dashboard content follows the order defined by `Design.md`:

1. page orientation and filter context;
2. revenue total;
3. operating and payment metrics;
4. trend and accounting information;
5. table, payment, and channel status;
6. top products.

Mobile:

- 16px outer margin and 12px common gap;
- filter summary remains visible;
- full filters open in a bottom Drawer;
- primary total appears before secondary metrics;
- metrics become labelled list rows or a two-column grid where values fit;
- charts simplify rather than shrinking desktop geometry;
- long Lao labels wrap without forcing horizontal scroll.

Tablet:

- 24px outer margin and 16px common gap;
- filters remain visible;
- content uses a 12-column rhythm;
- comparison, payment, table, channel, and product data expand progressively.

Desktop:

- 24–32px outer margin;
- filters remain visible;
- wide groups share borders so the screen reads as an operational ledger rather than a wall of cards;
- numeric comparisons use tabular figures and aligned columns.

The existing dynamic chart bundle boundary remains intact.

### 9. Visual language and tokens

Implement the Quiet Service Ledger palette from `Design.md` through semantic variables in `src/app/globals.css`.

Use exact hex-equivalent values in the project's HSL-compatible variable pipeline where required to preserve older Android WebView support. Do not force OKLCH runtime values into the compatibility path.

Required semantic roles:

- canvas/background;
- surface/card/popover;
- ink/foreground;
- muted text and muted surface;
- border/input;
- brand and primary action;
- selected/positive;
- destructive;
- warning;
- focus ring;
- sidebar equivalents.

Register reusable colors through Tailwind v4 `@theme inline`.

Rules:

- green is a marker and primary action, not a canvas wash;
- normal-size white text never sits on `#16A34A`;
- ordinary panels use borders rather than elevation;
- shared transaction groups may use dotted dividers;
- dark mode uses semantic variables, not call-site `dark:` color patches;
- no terracotta, purple gradients, decorative glass, or generic SaaS card walls.

Global token updates require regression checks on public surfaces even though their composition is outside this phase.

### 10. Landmarks and accessibility

The shell exposes exactly one `<main>` landmark.

Use `SidebarInset` as the main landmark and remove the nested main from `AppShell`, retaining:

- `id="app-main-content"`;
- `tabIndex={-1}`;
- skip-link target behavior.

Additional requirements:

- visible `focus-visible` rings;
- semantic links and buttons;
- labelled navigation regions;
- keyboard-operable Sheets and nested menus;
- `prefers-reduced-motion`;
- 44px general targets and 48px Android targets;
- safe-area support for notches, home indicators, and system bars;
- WCAG AA contrast;
- Lao-first labels;
- no color-only state indication.

### 11. Loading, error, and recovery

Initial Dashboard load:

- use shape-matched Dashboard skeletons;
- do not show an empty white content area.

Dashboard refresh:

- retain current data;
- show busy state only in the header refresh action and affected values where necessary;
- prevent duplicate requests through the existing store/request behavior.

Dashboard request failure:

- retain existing Dashboard data, applied filters, draft filters, and selected branch;
- show a persistent inline Alert near the active context;
- offer retry using the same registered refresh operation;
- do not rely only on a toast.

Navigation-data failure:

- continue using the existing static menu fallback;
- apply the existing static role-status filters;
- do not introduce any fallback destination that is not already present in the current static menu.

### 12. File boundaries

Expected responsibilities:

- `src/components/layout/app-shell.tsx` — orchestration and route mode only.
- `src/components/layout/app-header.tsx` — responsive header presentation.
- `src/components/layout/app-sidebar.tsx` — tablet/desktop rail presentation.
- `src/components/layout/app-bottom-nav.tsx` — mobile destinations and active state.
- `src/components/layout/app-navigation-sheet.tsx` — Reports and More Sheets.
- `src/components/layout/page-refresh-context.tsx` — registration contract and hook.
- `src/components/layout/shell-navigation.ts` — pure permission-aware destination helpers.
- `src/features/dashboard/overview/dashboard-page.tsx` — Dashboard refresh registration and composition.
- Dashboard widget files — responsive filter, metric, and ledger compositions.
- `src/app/globals.css` — semantic tokens and low-level shell geometry only.
- Locale files — new navigation, overflow, and refresh accessibility labels.

Names may be adjusted to match an existing local convention during implementation, but responsibilities must remain separated.

## Testing Strategy

### Pure tests

Add or extend tests for:

- bottom-navigation derivation from permission-filtered menu items;
- active-route matching;
- current-table POS URL and no-table fallback;
- report-child extraction;
- refresh-registration state transitions without stale callbacks;
- Dashboard refresh request parameters preserving draft filters.

Component DOM tests are not introduced because the repository currently tests pure logic only.

### Automated verification

- Targeted Vitest files for new helpers.
- Existing Dashboard view-model and chart-boundary tests.
- Existing POS URL/helper tests.
- `npm run typecheck`.
- `npm run lint`.

### Visual and interaction verification

Check:

- 393 × 852;
- 768px;
- 1024 × 1366;
- 1280px;
- 1440px;
- light and dark mode;
- keyboard-only navigation;
- reduced motion;
- Android/Capacitor safe areas;
- Electron resize behavior;
- Dashboard initial load, refresh, failure, and retry;
- protected POS table selection and order screens;
- fixed management screens;
- public `/pos` visual regression after token changes.

## Acceptance Criteria

- Shared header appears on every protected route, including protected POS.
- Mobile bottom navigation appears on every protected route and never on public routes.
- Tablet and desktop use the approved 210px/72px rail.
- POS remains usable without shell controls covering cart or order actions.
- Dashboard header refresh uses `loadDashboard()` with applied state and preserves draft filters.
- Routes without a registered refresh action do not show a dead refresh icon.
- Bottom navigation and rail use one permission-aware source.
- Mobile active navigation uses a thin marker rather than a filled tile.
- Dashboard information order follows `Design.md`.
- Initial load, refresh, error, and retry states preserve user context.
- One main landmark remains.
- No horizontal document scrolling occurs at the validation widths.
- Light/dark hierarchy, focus, touch targets, safe areas, and Lao labels pass review.
- No new dependency overlaps the current stack.

## Residual Risks

- Shared shell changes affect every protected screen, so fixed-height pages require targeted regression checks even though their content is not redesigned.
- Protected POS loses some vertical space to the shared header and mobile navigation; compact shell geometry and explicit offsets are mandatory.
- Global semantic-token corrections can expose hard-coded colors on public or legacy screens.
- POS and Tables may lead to the same table-selection screen when no current table exists; this is intentional recovery behavior, not two fabricated workflows.
- Reports is a navigation Sheet rather than a route because the application has no protected `/report` index.
