# Capacitor Native Shell Design

**Date:** 2026-08-25

## Objective

Give the Capacitor Android app its own navigation shell — bottom navigation on phone, a side rail on tablet, a native-style top bar — instead of reusing the web's sidebar-based `AppShell`. The web app (browser + Electron) keeps its current sidebar shell unchanged, at every viewport width. This is a platform split (Capacitor vs. everything else), not a viewport-based responsive split.

Scope is shell/navigation chrome only. No feature screen (POS order, tables, products, reports, settings, ...) is redesigned in this pass.

## Prior art check

`docs/superpowers/plans/2026-07-27-responsive-protected-shell-dashboard.md` ("approved scope for `feature-28`") planned a viewport-based (`<768px`, any platform) mobile shell with bottom nav + a "More" drawer. It was never merged: a first fixed-slot nav model (`shell-navigation.ts`) was built and then removed before `feature-28` opened ("ไม่ตรงกับ permission-aware design"), and no trace of the revised plan's files (`mobile-navigation-model.ts`, `mobile-shell-navigation.tsx`) exists in the current tree or git history.

That plan's gating condition (viewport) does not match this task's explicit ask (platform), so it is not reused wholesale. Three platform-agnostic ideas from it are carried into this design because they are real gaps, independent of the gating condition:

- Android hardware back button must be handled explicitly (close open Sheet → route back-fallback → minimize app at root).
- Deterministic back-fallback per route (not just browser history) for reachable-by-deep-link screens.
- A single route-transition loading indicator so Next.js RSC navigation delays are visible.

A separate Flutter proof-of-concept at `.claude/ExampleApp/flutter_application_1/` (read-only reference, never modified) validated the adaptive nav pattern (`NavigationBar` phone / `NavigationRail` tablet), that profile/notification/theme/language belong behind one anchored profile popup rather than separate top-bar icons or a full-screen sheet, and that nav chrome must never disappear on a drill-in screen.

## Scope

### Included

- A new Capacitor-only shell: bottom nav (phone), side rail (tablet), native-style top bar, "More" sheet.
- The switch point at `src/app/(protected)/layout.tsx`, gated by `useIsCapacitorNativeApp()`.
- Extracting `AppShell`'s data logic (permission menu resolution, breadcrumbs, active-route matching) into a hook shared by both shells.
- Android hardware back button handling for the new shell.
- A route-transition loading indicator for the new shell.

### Excluded

- Any redesign of feature screens (POS order/tables, products, reports, settings, sales, etc.) — shell/chrome only.
- Changes to the web `AppShell`'s visual behavior at any viewport width.
- The abandoned viewport-based "mobile web" shell from the `feature-28` plan.
- SSR/User-Agent-based platform detection — unnecessary (see Design Decisions §1).
- Electron: continues to use the web shell unchanged.

## Existing Constraints

- `AppShell` (`src/components/layout/app-shell.tsx`) currently owns menu permission loading, breadcrumb derivation, active-route logic, and both sidebar and header rendering in one ~930-line file.
- `menuItems` shown in the sidebar today come entirely from `usePermissionsSidebarStore` → `sidebarPermissionMenuItemsToMenuItems`, which normalizes the live `GET /api/v1/permission/menu` response (`src/services/permissions/sidebar.ts`). Ordering is server-controlled via `menu_sort`/`sub_sort`, sorted ascending then by label. There is no reliable static fallback list to hard-code against.
- `(protected)/layout.tsx` is `<AuthGuard><AppShell>{children}</AppShell></AuthGuard>`. `AuthGuard` is client-only and renders `LoadingState` until the zustand auth store hydrates and the user is confirmed logged in — the shell itself is never part of the server-rendered HTML. This means there is no wrong-shell flash to solve: nothing shell-shaped paints before the client already knows `Capacitor.isNativePlatform()`.
- `/pos/tables` and `/pos/order` are today's only "immersive" routes (`AppShell` hides its header for them). The new Capacitor shell keeps its nav chrome visible on these routes too (already agreed).
- The project already depends on `motion` (framer-motion successor) and uses per-viewport component variants toggled by Tailwind breakpoints elsewhere (`product-list-mobile.tsx` / `product-list-table.tsx`, switched via `md:hidden`) — reuse both patterns, no new dependency.
- shadcn `sheet.tsx`, `drawer.tsx`, and `progress.tsx` already exist; `accordion` does not yet (`npx shadcn@latest add accordion`, needed for the "More" sheet's grouped items).
- `@capacitor/app` (`^8.1.1`) is **already** a dependency, already used by `src/lib/installed-app-version.ts`, and already synced into both native projects (`android/capacitor.settings.gradle`, `ios/App/Podfile`). The hardware back-button listener (§6) needs no new dependency and no native re-sync.
- `src/hooks/use-mobile.ts` already exports `MOBILE_BREAKPOINT = 768` and a `useSyncExternalStore`-based `useIsMobile()`. Reuse it; do not introduce a second breakpoint source.
- `AppShell` is imported from exactly one place (`src/app/(protected)/layout.tsx`), so moving it under `web/` is a one-line import change with no other call sites to update.
- The only drill-in routes under `(protected)` are `/products/form`, `/printers/form`, and `/pos/order` (which requires `table_uuid` and guards client-side) — §5's back-fallback table is complete as written, not a sample.

## Design Decisions

### 1. Architecture — separate shell, shared data hook, no SSR detection

```
src/components/layout/
  use-app-shell-data.ts        # NEW — extracted from AppShell: menu resolution, breadcrumbs, active-route
  shell-breadcrumbs.ts         # existing, unchanged — reused by the hook
  floating-settings-button.tsx / language-switch.tsx / notification-menu.tsx / theme-toggle.tsx / auth-guard.tsx
                               # existing, unchanged — genuinely shared by both shells
  web/
    app-shell.tsx              # moved from layout/app-shell.tsx, unchanged markup, now reads the shared hook
  capacitor/
    app-shell.tsx              # NEW — NativeAppShell
    bottom-nav.tsx             # NEW — phone, <768px
    side-rail.tsx              # NEW — tablet, >=768px
    top-bar.tsx                # NEW — title + back, profile popup trigger
    more-sheet.tsx             # NEW — remaining menu items
    use-android-back-button.ts # NEW — §6
```

`(protected)/layout.tsx` picks `AppShell` (web) or `NativeAppShell` (capacitor) via `useIsCapacitorNativeApp()`. No SSR/User-Agent detection is added: `AuthGuard` already gates all shell rendering behind client-side auth hydration, so the correct shell is the first shell either platform ever paints — there is nothing to race against.

Rejected: a single `AppShell` with inline branching for both chrome styles (bloats an already-930-line file, couples web and native render paths so a native-only change risks the web sidebar). Rejected: a separate route group (`(native)`) — routes/feature components are already shared; only the wrapping shell differs, which the hook + switch-point already achieves without duplicating every route.

### 2. Navigation content — derived from the live permission menu, not hard-coded

Both `bottom-nav.tsx` and `side-rail.tsx` take the same `menuItems` the web sidebar already computes (via the shared hook): the first 3 items are direct destinations, the rest go under "More". This is deliberately not a curated list of paths — the real `/api/v1/permission/menu` response already carries the intended order via `menu_sort`, and taking it as given keeps the native shell automatically correct per role/company without a second navigation model to maintain (the exact failure mode that sank the earlier `shell-navigation.ts` attempt in `feature-27`).

- Phone and tablet show the same 3 direct destinations + More — only the chrome shape differs (bottom bar vs. side rail). Confirmed over the Flutter reference's asymmetric 3/6 split: consistency was preferred over maximizing tablet density.
- A direct destination with children (e.g. a "Sales" entry whose children are open-table-sale/order-queue/sales-list/cancel-sale/cancel-history) links to its first child's path, mirroring the Flutter reference's same resolution.
- Breakpoint is 768px — Tailwind's existing `md`, and the same value `src/hooks/use-mobile.ts` already exports as `MOBILE_BREAKPOINT`. No new breakpoint value or second source of truth.
- Prefer the project's existing CSS-toggle pattern for the phone/tablet swap (render both, hide one with `md:hidden` / `hidden md:flex`, as `product-list-mobile.tsx` and `product-list-table.tsx` already do) over a JS branch on `useIsMobile()`. CSS avoids a layout flash on first paint and on rotation. Reach for `useIsMobile()` only where behavior — not just layout — must genuinely differ (e.g. whether the "More" sheet or the rail's own overflow owns a given item), and never to duplicate what a class can express.
- If `menuItems.length <= 3`, there is no "More" entry at all — no disabled placeholder is shown for a role with few permitted sections.

### 3. "More" sheet

A shadcn `Sheet` (`side="bottom"`, near full height) lists `menuItems.slice(3)`. Items with children render as an `Accordion` group (new shadcn component to add) rather than navigating to a group with no page of its own. Tapping a leaf navigates via `Link`/`internalRoute()` and closes the sheet.

### 4. Top bar

- Left: back button, shown only on non-root/drill-in routes (deterministic parent per route — see §5), absent on the 3 direct destinations and "More".
- Center: page title, derived from the same `resolveShellBreadcrumbs` the web shell already uses (last breadcrumb item's label) — no breadcrumb trail rendered, native apps show one title, not a trail.
- Right: notification bell (`NotificationMenu`, reused as-is) + one profile button opening a `DropdownMenu` containing avatar/email/store name, language switch, theme toggle, then sign-out last. Theme and language move out of separate top-bar icons into this one entry point, per the validated Flutter iteration (freed top-bar space, one iteration already fought this out with a live user).

### 5. Back navigation

- Deterministic parent per drill-in route, not just browser history: `/pos/order → /pos/tables`, `/products/form → /products`, `/printers/form → /printers`, and equivalent for any other `.../form` route. A direct deep link into a drill-in route must still resolve a sensible back target.
- Root destinations (the 3 direct tabs, and "More") show no back button.

### 6. Android hardware back button

Listen for `@capacitor/app`'s `backButton` event in the Capacitor shell only (`use-android-back-button.ts`, mounted from `capacitor/app-shell.tsx`). The plugin is already installed and synced — this is new listener code, not a new dependency. Priority order per press:

1. If the "More" sheet (or any open Sheet/Dialog) is open, close it.
2. Otherwise, apply the same resolution as the top bar's back button (§5's deterministic parent, or browser history if no parent rule applies).
3. At a root destination with nothing to close or resolve, minimize the app (do not call `history.back()` past the app's own root, and do not exit/kill the process).

### 7. Route-transition feedback

A single thin progress line under the Capacitor top bar, shown only once a navigation exceeds ~120ms (avoids flashing on instant transitions), covering the gap between tapping a link and the RSC route commit. No blocking overlay, no per-route skeleton beyond what features already render.

### 8. Motion

Tab switches and drill-in/back transitions use the existing `motion` dependency (already used in `product-list-mobile.tsx`) for a light fade/slide — no new animation dependency, and no attempt to build a full native page-stack; Next.js App Router already owns real routing/back behavior.

## Testing

Per project convention, only pure logic gets colocated `.test.ts` coverage:

- Core/More derivation (`menuItems.slice(0, 3)` / rest, and first-child resolution for a destination with children).
- Deterministic back-fallback resolution per route (§5).
- Android back-button priority resolution logic (§6), independent of the actual `@capacitor/app` listener wiring.

Visual/interaction behavior of the bottom nav, side rail, "More" sheet, and top bar is verified manually in the browser/device per the project's existing verification approach — not unit-tested.

## Open follow-ups (explicitly out of scope for this pass)

- Redesigning individual feature screens (POS order/tables as native-style card lists instead of data tables) — a separate, later spec if wanted.
- iOS: this spec targets the Android Capacitor build in place today; the same shell should work for iOS once/if that platform is added, but hasn't been verified against it.
