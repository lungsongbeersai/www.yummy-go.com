# POS Operational Screens — Motion & Visual Polish

## Problem

The POS operational screens (`src/features/pos/table-selection/`, `src/features/pos/order-customer/`) feel flat and unresponsive: interactive elements have no press feedback on touchscreens, dialogs/sheets fade in too fast to perceive (`duration-100`), and cart/list changes snap instantly with no transition. The rest of the app (landing page, public ordering) already uses `motion` (Framer Motion v13, already a dependency) and `three` for visual polish; the daily-use staff screens have none of it.

## Goals

- Make the two screens staff use all day (table map, counter/cart) feel modern and responsive.
- Never slow staff down — every animation is decorative, layered on top of state that already updated.
- Reuse what's already in the project (`motion/react`, `tw-animate-css`) — no new dependencies.

## Non-goals

- Landing page, public QR ordering, back-office CRUD screens (products/settings/reports) — out of scope for this pass.
- Shared-element "fly to cart" animation from product card to cart dock — too complex for the payoff, especially under fast scrolling during rush hours. Noted as a future idea, not part of this design.
- Editing the shared `components/ui/dialog.tsx` / `sheet.tsx` primitives globally — changes are scoped to the specific POS dialog/sheet instances so other pages (settings, product forms, printer forms) are unaffected.

## Hard constraints (apply to every change in this spec)

1. **Never block a real state update.** Data updates immediately; animation is a visual layer on top, never a gate.
2. **Duration ≤ 250ms** for every animation (press feedback ~100-150ms, panel/badge ~180-250ms).
3. **Every custom animation respects `prefers-reduced-motion`**, using the existing `motion-reduce:` Tailwind variant convention already used in this codebase (see `order-customer-product-card.tsx`).
4. **Interactive elements stay repeatable immediately** — no animation-driven debounce or lock on buttons/cards.

## CSS vs `motion` decision rule

| Use CSS / `tw-animate-css` | Use `motion/react` |
|---|---|
| Hover/press/focus state | List item add/remove needing layout reflow |
| Dialog/Sheet enter-exit (already exists via shadcn + tw-animate-css) | Spring/overshoot physics (badge bump) |
| Existing status ring pulse (`.pos-ring-*` in `globals.css`) | Orchestrated multi-step sequences |

## Changes — Table Selection (`table-selection/`)

CSS only. This is the screen staff switch through most often — no `motion`, no added JS.

1. **Table card press feedback** (`table-list-section.tsx`, `TableCard`) — add `active:scale-[0.97] transition-transform duration-100` to the `Card` element. Today it only has `hover:` styling, which has no effect on a touchscreen tap.
2. **Zone/status toggle chip press feedback** (`ZoneToggleItem`, `StatusToggleItem` in the same file) — same `active:scale-95` treatment.
3. **Dialog/Sheet duration bump, scoped per-instance** — `TableActionsOverlay`, `payment-dialog.tsx`, `table-qr-dialog.tsx`, `customer-display-picker-dialog.tsx`, and the shared `ConfirmDialog` when used from this feature: override the inherited `duration-100` with `duration-200` via `className` on the specific `DialogContent`/`SheetContent` usage in each file, not the shared UI primitive.

**Explicitly not changed:** the existing status-color system and `pos-ring-*` pulse animation (already tuned through several iterations per the comments in `table-list-section.tsx` and `globals.css`); no entrance/cross-fade animation on table-grid reload or table switching — this happens too often during a shift to add any decorative delay, however small.

## Changes — Counter / Cart (`order-customer/`, cart components in `table-selection/`)

1. **Product card "add" action press feedback** (`order-customer-product-card.tsx`, the absolutely-positioned `Button` at line ~159) — `active:scale-95 transition-transform duration-100`. CSS only, same pattern as the table card.
2. **Primary action badge count bump** (`cart-summary-dock.tsx`, the `primaryBadgeCount` `Badge`) — when the count changes, play a short spring scale (1 → 1.3 → 1, ~200ms) using `motion.span` keyed on the count value. This is the highest-visibility "money moment": the badge sits on the button staff look at constantly. The underlying number is already correct/updated before the animation plays.
3. **Cart item list add/remove/reorder** (`cart-items.tsx`, `CartTabItems` and its row rendering) — wrap rows in `AnimatePresence` + `motion.div layout`, matching the existing pattern in `product-list-mobile.tsx` (`motion/react` import, `AnimatePresence initial={false}`). Removed items fade + collapse (~180ms) instead of the list jumping.

**Explicitly not changed:** the existing hover-lift on product cards (`order-customer-product-card.tsx:91`) is already good; no shared-element "fly to cart" animation (see Non-goals).

## Testing

- No dedicated unit tests — these are pure CSS/visual changes plus small `motion` usage on presentational components; existing component tests (if any) should keep passing unchanged since no data-flow or logic changes.
- Verify manually in the browser: press feedback on table cards / product cards / chips, dialog fade duration, badge bump on order count change, cart row add/remove.
- Verify with `prefers-reduced-motion: reduce` emulated (browser devtools / `resize_window` colorScheme-style emulation) that press-scale and list transitions are suppressed via `motion-reduce:` / `motion`'s built-in reduced-motion handling.
- Verify on a narrow/mobile viewport since these are touch-first screens.
