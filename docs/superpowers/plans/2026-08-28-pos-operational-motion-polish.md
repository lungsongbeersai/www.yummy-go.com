# POS Operational Screens Motion & Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add press feedback, tuned dialog transitions, and cart micro-interactions to the two POS operational screens (table selection, counter/cart) without ever slowing staff down.

**Architecture:** Hybrid CSS + `motion` (already a project dependency, imported as `motion/react`). Simple, high-frequency interactions (press states, dialog fade duration) stay pure CSS/Tailwind. Cart badge count changes and cart item list add/remove use `motion` because CSS can't express spring overshoot or layout-aware exit animation cleanly. No new dependencies.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, `motion` v13 (`motion/react`), shadcn/ui.

## Global Constraints

- Never block a real state update — data updates immediately; every animation in this plan is a decorative layer on top, never a gate on interaction.
- Every animation duration is ≤ 250ms (press feedback ~100ms, panel/badge ~180-250ms).
- Every custom `motion` animation must respect reduced motion, using `useReducedMotion()` from `motion/react` (see the existing `detailMotion` pattern in `src/features/product/list/use-product-list-workflow.ts:98,178-184`). Every custom CSS transform animation must use the `motion-safe:`/`motion-reduce:` Tailwind variants (see `src/features/pos/order-customer/order-customer-product-card.tsx:90-93`).
- Interactive elements stay repeatable immediately — never add an animation-driven lock or debounce to a button/card.
- Scope is limited to `src/features/pos/table-selection/` and `src/features/pos/order-customer/` (plus one narrowly-scoped opt-in prop addition to a shared component, see Task 2). Do not modify `src/components/ui/dialog.tsx`, `src/components/ui/sheet.tsx`, or `src/components/ui/alert-dialog.tsx` — those are shared across the whole app and out of scope.
- This codebase does not unit-test components (see `CLAUDE.md`: "Tests are colocated `.test.ts` files... They cover pure logic only — services, store helpers, validators — not components"). Verification for every task in this plan is: `npm run typecheck`, `npm run lint`, and a manual browser check — not an automated test file.

---

## Task 1: Press feedback on table cards and filter chips

**Files:**
- Modify: `src/features/pos/table-selection/table-list-section.tsx:483-489` (`TableCard`'s `Card` className)
- Modify: `src/features/pos/table-selection/table-list-section.tsx:262-267` (`ZoneToggleItem`'s `ToggleGroupItem` className)
- Modify: `src/features/pos/table-selection/table-list-section.tsx:299-303` (`StatusToggleItem`'s `ToggleGroupItem` className)

**Interfaces:** None — pure className changes, no prop/signature changes. Nothing else in the codebase depends on this task.

- [ ] **Step 1: Add press feedback to `TableCard`**

In `src/features/pos/table-selection/table-list-section.tsx`, find the `Card` element inside `TableCard` (around line 483):

```tsx
        className={cn(
          "cursor-pointer overflow-hidden rounded-xl bg-card p-0 shadow-sm outline-none ring-border transition hover:ring-primary/70 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30",
          style.card,
          // ring กะพริบซ้อนทับสีสถานะเดิม — บอกว่ามีออเดอร์ใหม่เข้ามาสด ๆ โดยไม่เปลี่ยนสีการ์ด
          hasOrderAlert && "pos-table-card-alert",
          selected && "bg-primary/10 shadow-lg shadow-primary/15 ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
```

Change the first line to add `motion-safe:active:scale-[0.97]` — the card already has a bare `transition` class, so this reuses the existing transition (no new duration/easing needed, existing default is well under 250ms):

```tsx
        className={cn(
          "cursor-pointer overflow-hidden rounded-xl bg-card p-0 shadow-sm outline-none ring-border transition motion-safe:active:scale-[0.97] hover:ring-primary/70 hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring/30",
          style.card,
          // ring กะพริบซ้อนทับสีสถานะเดิม — บอกว่ามีออเดอร์ใหม่เข้ามาสด ๆ โดยไม่เปลี่ยนสีการ์ด
          hasOrderAlert && "pos-table-card-alert",
          selected && "bg-primary/10 shadow-lg shadow-primary/15 ring-2 ring-primary ring-offset-2 ring-offset-background"
        )}
```

- [ ] **Step 2: Add press feedback to `ZoneToggleItem`**

Find the `ToggleGroupItem` className inside `ZoneToggleItem` (around line 262):

```tsx
      className={cn(
        "h-8 gap-1 rounded-full border border-transparent px-2.5 text-sm font-black shadow-sm transition data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20",
        !active && "border-border bg-card hover:border-primary/30 hover:bg-primary/5",
        hasAlert && "pos-chip-alert-ring"
      )}
```

Add `motion-safe:active:scale-95` next to `transition`:

```tsx
      className={cn(
        "h-8 gap-1 rounded-full border border-transparent px-2.5 text-sm font-black shadow-sm transition motion-safe:active:scale-95 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20",
        !active && "border-border bg-card hover:border-primary/30 hover:bg-primary/5",
        hasAlert && "pos-chip-alert-ring"
      )}
```

- [ ] **Step 3: Add the same press feedback to `StatusToggleItem`**

Find the `ToggleGroupItem` className inside `StatusToggleItem` (around line 299) — it's the same base string as `ZoneToggleItem`:

```tsx
      className={cn(
        "h-8 gap-1 rounded-full border border-transparent px-2.5 text-sm font-black shadow-sm transition data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20",
        !active && "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
      )}
```

Apply the identical change:

```tsx
      className={cn(
        "h-8 gap-1 rounded-full border border-transparent px-2.5 text-sm font-black shadow-sm transition motion-safe:active:scale-95 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-primary/20",
        !active && "border-border bg-card hover:border-primary/30 hover:bg-primary/5"
      )}
```

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors (this task only changes string literals inside existing `cn()` calls, so this should be a formality).

Run: `npx eslint src/features/pos/table-selection/table-list-section.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Start the dev server (`npm run dev`), open `/pos/tables`, and on a touch-emulated viewport (or by holding down the mouse button) confirm: tapping/holding a table card visibly shrinks it slightly (~3%) and springs back on release; tapping/holding a zone or status filter chip does the same (~5% shrink). Confirm existing hover/selection styling (ring, shadow, badge) still looks correct — this task must not change the resting or hover appearance, only add the press state.

- [ ] **Step 6: Commit**

```bash
git add src/features/pos/table-selection/table-list-section.tsx
git commit -m "feat(pos): add press feedback to table cards and filter chips"
```

---

## Task 2: Tune dialog fade/zoom duration on table-selection dialogs

**Files:**
- Modify: `src/features/pos/table-selection/table-actions-overlay.tsx:356` (`DialogContent`, Dialog variant only — the Sheet variant at line 327-331 already uses `duration-200` from the shared `SheetContent` base and needs no change)
- Modify: `src/features/pos/table-selection/table-qr-dialog.tsx:271`
- Modify: `src/features/pos/table-selection/customer-display-picker-dialog.tsx:134`
- Modify: `src/features/pos/table-selection/payment-dialog-content.tsx:263-269`
- Modify: `src/components/common/confirm-dialog.tsx` (add one new optional prop — see Step 5 for why this is the minimal-blast-radius way to scope the change)

**Interfaces:**
- Produces: `ConfirmDialog` gains an optional `contentClassName?: string` prop. Every existing call site that doesn't pass it behaves identically to today (prop is `undefined`, merged into the existing `cn()` call as a no-op).

- [ ] **Step 1: Bump duration on `TableActionsOverlay`'s Dialog variant**

In `src/features/pos/table-selection/table-actions-overlay.tsx`, find the `DialogContent` around line 356:

```tsx
        <Dialog open={open} onOpenChange={updateOpen}>
          <DialogContent className="top-6 flex max-h-[min(820px,calc(100dvh-3rem))] translate-y-0 flex-col gap-0 overflow-hidden p-0 sm:max-w-[960px]">
```

Add `duration-200` to the className:

```tsx
        <Dialog open={open} onOpenChange={updateOpen}>
          <DialogContent className="top-6 flex max-h-[min(820px,calc(100dvh-3rem))] translate-y-0 flex-col gap-0 overflow-hidden p-0 duration-200 sm:max-w-[960px]">
```

Do not change the `Sheet`/`SheetContent` branch above it (lines 326-353) — `SheetContent`'s shared base class already includes `duration-200` (see `src/components/ui/sheet.tsx:65`), so it needs no per-instance override.

- [ ] **Step 2: Bump duration on `table-qr-dialog.tsx`**

In `src/features/pos/table-selection/table-qr-dialog.tsx`, find (around line 271):

```tsx
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 sm:max-w-130">
```

Change to:

```tsx
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-hidden p-0 duration-200 sm:max-w-130">
```

- [ ] **Step 3: Bump duration on `customer-display-picker-dialog.tsx`**

In `src/features/pos/table-selection/customer-display-picker-dialog.tsx`, find (around line 134):

```tsx
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 sm:max-w-2xl">
```

Change to:

```tsx
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-hidden p-0 duration-200 sm:max-w-2xl">
```

- [ ] **Step 4: Bump duration on the payment dialog**

In `src/features/pos/table-selection/payment-dialog-content.tsx`, find the `DialogContent` around line 263:

```tsx
        <DialogContent
          aria-busy={processing}
          showCloseButton={false}
          className="!left-0 !top-0 grid h-[var(--pos-payment-dialog-height)] max-h-[var(--pos-payment-dialog-height)] w-full max-w-[100vw] !translate-x-0 !translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 bg-background p-0 sm:!left-[50%] sm:!top-[50%] sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:max-w-[calc(100vw-1rem)] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg sm:border xl:max-w-7xl"
          style={dialogStyle}
          onKeyDown={handleDialogKeyDown}
        >
```

Add `duration-200` anywhere in the className string (position doesn't matter, `cn`/tailwind-merge resolves it against the base `duration-100`):

```tsx
        <DialogContent
          aria-busy={processing}
          showCloseButton={false}
          className="!left-0 !top-0 grid h-[var(--pos-payment-dialog-height)] max-h-[var(--pos-payment-dialog-height)] w-full max-w-[100vw] !translate-x-0 !translate-y-0 grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 bg-background p-0 duration-200 sm:!left-[50%] sm:!top-[50%] sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:max-w-[calc(100vw-1rem)] sm:!translate-x-[-50%] sm:!translate-y-[-50%] sm:rounded-lg sm:border xl:max-w-7xl"
          style={dialogStyle}
          onKeyDown={handleDialogKeyDown}
        >
```

- [ ] **Step 5: Add an opt-in `contentClassName` prop to the shared `ConfirmDialog`**

`ConfirmDialog` (`src/components/common/confirm-dialog.tsx`) is used app-wide, not just from POS — it currently has no way to pass a className to its `AlertDialogContent`, so it can't be scoped per-caller without a code change. Add an **optional** prop that defaults to `undefined` so every other call site in the app is completely unaffected.

Open `src/components/common/confirm-dialog.tsx`. Current content:

```tsx
interface ConfirmDialogProps {
  cancelLabel: string;
  confirmDisabled?: boolean;
  confirmLabel: string;
  confirmPending?: boolean;
  confirmVariant?: ButtonProps["variant"];
  description: string;
  open: boolean;
  title: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  cancelLabel,
  confirmDisabled = false,
  confirmLabel,
  confirmPending = false,
  confirmVariant = "destructive",
  description,
  open,
  title,
  onConfirm,
  onOpenChange
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
```

Change to:

```tsx
interface ConfirmDialogProps {
  cancelLabel: string;
  confirmDisabled?: boolean;
  confirmLabel: string;
  confirmPending?: boolean;
  confirmVariant?: ButtonProps["variant"];
  // ให้ผู้เรียกเฉพาะจุด override className ของ AlertDialogContent ได้ (เช่น ปรับ duration)
  // โดยไม่กระทบ call site อื่นทั้งแอปที่ไม่ได้ส่งค่านี้มา
  contentClassName?: string;
  description: string;
  open: boolean;
  title: string;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}

export function ConfirmDialog({
  cancelLabel,
  confirmDisabled = false,
  confirmLabel,
  confirmPending = false,
  confirmVariant = "destructive",
  contentClassName,
  description,
  open,
  title,
  onConfirm,
  onOpenChange
}: ConfirmDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className={contentClassName} size="sm">
```

- [ ] **Step 6: Use the new prop from `TableActionsOverlay`**

In `src/features/pos/table-selection/table-actions-overlay.tsx`, find the `ConfirmDialog` usage near the end of the file:

```tsx
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!canSubmit}
        confirmLabel={actionLabel}
        confirmPending={pending}
        confirmVariant="default"
        description={confirmDescription}
        open={confirmOpen}
        title={actionLabel}
        onConfirm={() => void submitTableAction()}
        onOpenChange={(nextOpen) => {
          if (pending) return;
          setConfirmOpen(nextOpen);
        }}
      />
```

Add `contentClassName="duration-200"`:

```tsx
      <ConfirmDialog
        cancelLabel={t("actions.cancel")}
        confirmDisabled={!canSubmit}
        confirmLabel={actionLabel}
        confirmPending={pending}
        confirmVariant="default"
        contentClassName="duration-200"
        description={confirmDescription}
        open={confirmOpen}
        title={actionLabel}
        onConfirm={() => void submitTableAction()}
        onOpenChange={(nextOpen) => {
          if (pending) return;
          setConfirmOpen(nextOpen);
        }}
      />
```

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npx eslint src/features/pos/table-selection/table-actions-overlay.tsx src/features/pos/table-selection/table-qr-dialog.tsx src/features/pos/table-selection/customer-display-picker-dialog.tsx src/features/pos/table-selection/payment-dialog-content.tsx src/components/common/confirm-dialog.tsx`
Expected: no errors.

- [ ] **Step 8: Confirm no other `ConfirmDialog` call site is broken**

Run: `grep -rn "ConfirmDialog" src --include=*.tsx -l`
Expected: every other file in the result list still calls `ConfirmDialog` without `contentClassName` — confirm by eye that none of them need updating (the prop is optional, so this is just a sanity check, not an edit step).

- [ ] **Step 9: Manual verification**

Open `/pos/tables`, select an occupied table, open table actions (move/join) — the dialog (or sheet on mobile width) should now have a perceptible ~200ms fade+zoom instead of the near-instant snap. Trigger the move/join confirm dialog and confirm it also has the slower fade. Open the table QR dialog and the customer-display picker dialog from the table actions menu and confirm the same. Open the payment dialog from the cart summary dock and confirm the same. None of these should feel sluggish — 200ms is still fast, just no longer imperceptible.

- [ ] **Step 10: Commit**

```bash
git add src/features/pos/table-selection/table-actions-overlay.tsx src/features/pos/table-selection/table-qr-dialog.tsx src/features/pos/table-selection/customer-display-picker-dialog.tsx src/features/pos/table-selection/payment-dialog-content.tsx src/components/common/confirm-dialog.tsx
git commit -m "feat(pos): perceptible dialog fade duration on table-selection dialogs"
```

---

## Task 3: Press feedback on the product card "add" hit target

**Files:**
- Modify: `src/features/pos/order-customer/order-customer-product-card.tsx:159-167`

**Interfaces:** None — pure className change.

**Context:** The clickable element covering the whole product card is a fully transparent, absolutely-positioned `Button` (`inset-0`), not the visible `Card` itself. It already has `active:bg-primary/10` as a press cue. A `scale` transform on the *visible* `Card` wouldn't trigger from this child's `:active` state without a `:has()` selector, and adding one would be disproportionate complexity for this task. Instead, strengthen the existing overlay tint and add a small inward shrink to the tinted layer itself, which reads as a natural "press" cue on a full-bleed touch target.

- [ ] **Step 1: Strengthen and animate the existing press overlay**

In `src/features/pos/order-customer/order-customer-product-card.tsx`, find the `Button` around line 159:

```tsx
      <Button
        type="button"
        variant="ghost"
        aria-busy={loading}
        aria-label={accessibleActionLabel}
        className="absolute inset-0 z-20 h-auto w-auto touch-manipulation rounded-lg bg-transparent p-0 shadow-none hover:bg-primary/5 active:bg-primary/10 focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-100"
        disabled={interactionDisabled}
        onClick={() => onAction(entry)}
      />
```

Change the className to strengthen the active tint and add a quick inward scale on press:

```tsx
      <Button
        type="button"
        variant="ghost"
        aria-busy={loading}
        aria-label={accessibleActionLabel}
        className="absolute inset-0 z-20 h-auto w-auto touch-manipulation rounded-lg bg-transparent p-0 shadow-none transition-transform duration-100 hover:bg-primary/5 active:scale-[0.98] active:bg-primary/15 motion-reduce:transition-none focus-visible:bg-primary/5 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-auto disabled:cursor-not-allowed disabled:opacity-100"
        disabled={interactionDisabled}
        onClick={() => onAction(entry)}
      />
```

- [ ] **Step 2: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npx eslint src/features/pos/order-customer/order-customer-product-card.tsx`
Expected: no errors.

- [ ] **Step 3: Manual verification**

Open `/pos/order`, press and hold a product card (not disabled/blocked). Confirm a visible tint appears at the edges and the tinted layer shrinks in very slightly (~2%) while held, and springs back on release. Confirm this doesn't happen on disabled/blocked cards (the `disabled` prop already gates `active:`/`hover:` via `disabled:pointer-events-auto disabled:opacity-100` which is unchanged). Confirm the existing hover lift (`motion-safe:hover:-translate-y-0.5` on the outer `Card`, untouched by this task) still works with mouse hover.

- [ ] **Step 4: Commit**

```bash
git add src/features/pos/order-customer/order-customer-product-card.tsx
git commit -m "feat(pos): stronger press feedback on product card add action"
```

---

## Task 4: Spring bump on the cart summary primary-action badge

**Files:**
- Modify: `src/features/pos/table-selection/cart-summary-dock.tsx`

**Interfaces:**
- Consumes: `motion`, `useReducedMotion` from `motion/react` (already a project dependency, existing pattern in `src/features/product/list/use-product-list-workflow.ts:7,98`).
- Produces: no new exported symbols — internal visual change only to `CartSummaryDock`.

- [ ] **Step 1: Import `motion` and `useReducedMotion`**

In `src/features/pos/table-selection/cart-summary-dock.tsx`, the current imports start:

```tsx
"use client";

import { BadgePercent, Check, CreditCard, Monitor, MoreHorizontal, QrCode, ShoppingCart, Shuffle, SplitSquareHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
```

Add the `motion` import:

```tsx
"use client";

import { BadgePercent, Check, CreditCard, Monitor, MoreHorizontal, QrCode, ShoppingCart, Shuffle, SplitSquareHorizontal } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
```

- [ ] **Step 2: Read `reduceMotion` in the component**

Find the top of `CartSummaryDock`'s body:

```tsx
}) {
  const { t } = useTranslation();
  const primaryIsSplit = splitSelectedCount > 0 && Boolean(onPaySplitSelection);
```

Add the hook call:

```tsx
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const primaryIsSplit = splitSelectedCount > 0 && Boolean(onPaySplitSelection);
```

- [ ] **Step 3: Wrap the badge in a `motion.span` keyed on the count**

Find the badge render (around line 247):

```tsx
          {primaryBadgeCount > 0 ? (
            <Badge
              className={cn(
                "absolute right-1.5 top-1.5 z-10 min-w-6 justify-center rounded-full px-1.5 py-0.5 text-2xs font-black shadow-sm",
                primaryDisabled
                  ? "border-primary/30 bg-primary text-primary-foreground"
                  : "border-primary-foreground/30 bg-primary-foreground text-primary"
              )}
            >
              {primaryBadgeCount}
            </Badge>
          ) : null}
```

Wrap it in a `motion.span` keyed on `primaryBadgeCount` — the `key` change forces a remount every time the count changes, which replays the `initial`→`animate` scale pop each time (this is the same "replay on value change via key" technique, not a new pattern). The parent `Button` (the primary action button) has `overflow-hidden` on it already (for the shine-sweep effect), and the badge sits only `right-1.5 top-1.5` (0.375rem) from its corner, so keep the scale modest (`1.25`, not higher) to avoid the pop clipping against that overflow boundary:

```tsx
          {primaryBadgeCount > 0 ? (
            <motion.span
              key={primaryBadgeCount}
              className="absolute right-1.5 top-1.5 z-10"
              initial={reduceMotion ? { scale: 1 } : { scale: 1.25 }}
              animate={{ scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.2, ease: "easeOut" }}
            >
              <Badge
                className={cn(
                  "min-w-6 justify-center rounded-full px-1.5 py-0.5 text-2xs font-black shadow-sm",
                  primaryDisabled
                    ? "border-primary/30 bg-primary text-primary-foreground"
                    : "border-primary-foreground/30 bg-primary-foreground text-primary"
                )}
              >
                {primaryBadgeCount}
              </Badge>
            </motion.span>
          ) : null}
```

Note the positioning classes (`absolute right-1.5 top-1.5 z-10`) moved from the `Badge` to the wrapping `motion.span` — the `Badge` itself keeps its sizing/color classes. This keeps the badge in the same visual position while the `motion.span` owns the transform.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npx eslint src/features/pos/table-selection/cart-summary-dock.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Open `/pos/tables`, select a table, add items to the cart from the counter/order screen so `newOrderCount` (or the split-selection count) changes. Confirm the badge on the primary action button (confirm/pay) pops (scales up briefly then settles) every time the number changes, and that the number itself is correct at every step — never delayed or wrong during the animation. Emulate `prefers-reduced-motion: reduce` (e.g. via `resize_window` colorScheme-equivalent devtools emulation) and confirm the badge updates with no scale animation, just the new number.

- [ ] **Step 6: Commit**

```bash
git add src/features/pos/table-selection/cart-summary-dock.tsx
git commit -m "feat(pos): spring bump on cart summary badge count change"
```

---

## Task 5: Animate cart item add/remove in the order list

**Files:**
- Modify: `src/features/pos/table-selection/cart-items.tsx`

**Interfaces:**
- Consumes: `motion`, `AnimatePresence`, `useReducedMotion` from `motion/react`.
- Produces: no new exported symbols — internal visual change only to `CartTabItems`.

**Context:** `CartTabItems` maps `items: CartItem[]` to a list of `CartItemRow`. Today, adding/removing/reordering a row snaps instantly. This task wraps each row in `motion.div layout` inside `AnimatePresence`, mirroring the existing pattern in `src/features/product/list/product-list-mobile.tsx:219-301` (`AnimatePresence initial={false}` + `motion.div` with a reduced-motion-aware transition).

Known accepted trade-off: `CartTabItems` early-returns a completely different `<CartPanelEmpty />` tree when `items.length` is `0` (see line 103: `if (!items.length) return <CartPanelEmpty />;`). This means the very last remaining item does not get its own removal animation before the empty state appears — the swap to `CartPanelEmpty` happens on the same render as the array becoming empty. This is intentionally left as-is: solving it would mean keeping `CartPanelEmpty` inside the same `AnimatePresence` and delaying the empty-state swap, which adds real complexity for a single edge case. Every other add/remove/reorder while the cart still has ≥1 item gets the full animation.

- [ ] **Step 1: Import `motion`, `AnimatePresence`, `useReducedMotion`**

In `src/features/pos/table-selection/cart-items.tsx`, current top of file:

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Ban, BadgePercent, ChefHat, ClipboardCheck, Gift, Minus, MoreVertical, Pencil, Plus, ShoppingBag, StickyNote, Tag, Trash2, Utensils } from "lucide-react";
import { useTranslation } from "react-i18next";
```

Add the `motion` import:

```tsx
"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { Ban, BadgePercent, ChefHat, ClipboardCheck, Gift, Minus, MoreVertical, Pencil, Plus, ShoppingBag, StickyNote, Tag, Trash2, Utensils } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslation } from "react-i18next";
```

- [ ] **Step 2: Compute a reduced-motion-aware row transition in `CartTabItems`**

Find the start of `CartTabItems`'s body:

```tsx
}) {
  if (!items.length) return <CartPanelEmpty />;

  return (
    <div className="flex min-h-full flex-col bg-background">
      {items.map((item, index) => {
```

Change to compute the row's `motion` config, mirroring `detailMotion` in `use-product-list-workflow.ts:178-184`:

```tsx
}) {
  const reduceMotion = useReducedMotion();
  const rowMotion = {
    initial: reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 },
    animate: { opacity: 1, height: "auto" },
    exit: reduceMotion ? { opacity: 1, height: "auto" } : { opacity: 0, height: 0 },
    transition: { duration: reduceMotion ? 0 : 0.18, ease: "easeOut" as const }
  };

  if (!items.length) return <CartPanelEmpty />;

  return (
    <div className="flex min-h-full flex-col bg-background">
      <AnimatePresence initial={false}>
      {items.map((item, index) => {
```

- [ ] **Step 3: Wrap each `CartItemRow` in a `motion.div`**

Find the row rendering inside the `.map`:

```tsx
        return (
          <CartItemRow
            key={String(item.order_item_uuid ?? item.order_it_uuid ?? item.prod_uuid ?? item.product_uuid ?? index)}
            editable={editable}
            item={item}
            actionDisabled={actionDisabled}
            acting={itemUuid === actingItemUuid}
            canConfirmKitchen={canConfirmKitchenItem(item)}
            compact={compact}
            splitEligible={splitEligible}
            splitSelectionDisabled={splitSelectionDisabled}
            splitSelected={splitEligible && splitSelectedQty !== undefined}
            splitSelectedQty={splitSelectedQty}
            updating={cartItemUuid(item) === updatingItemUuid}
            onChangeQty={onChangeQty}
            onConfirmKitchen={onConfirmKitchen}
            onConfirmServed={onConfirmServed}
            onEditNote={onEditNote}
            onItemDiscount={onItemDiscount}
            onOpenItemAction={onOpenItemAction}
            onOpenQuantityDialog={onOpenQuantityDialog}
            onSetSplitItemQuantity={onSetSplitItemQuantity}
            onToggleSplitItem={onToggleSplitItem}
          />
        );
      })}
    </div>
  );
}
```

Change to wrap the row in a keyed `motion.div` and close the `AnimatePresence`/outer `div` correctly:

```tsx
        const rowKey = String(item.order_item_uuid ?? item.order_it_uuid ?? item.prod_uuid ?? item.product_uuid ?? index);

        return (
          <motion.div
            key={rowKey}
            layout
            initial={rowMotion.initial}
            animate={rowMotion.animate}
            exit={rowMotion.exit}
            transition={rowMotion.transition}
            style={{ overflow: "hidden" }}
          >
            <CartItemRow
              editable={editable}
              item={item}
              actionDisabled={actionDisabled}
              acting={itemUuid === actingItemUuid}
              canConfirmKitchen={canConfirmKitchenItem(item)}
              compact={compact}
              splitEligible={splitEligible}
              splitSelectionDisabled={splitSelectionDisabled}
              splitSelected={splitEligible && splitSelectedQty !== undefined}
              splitSelectedQty={splitSelectedQty}
              updating={cartItemUuid(item) === updatingItemUuid}
              onChangeQty={onChangeQty}
              onConfirmKitchen={onConfirmKitchen}
              onConfirmServed={onConfirmServed}
              onEditNote={onEditNote}
              onItemDiscount={onItemDiscount}
              onOpenItemAction={onOpenItemAction}
              onOpenQuantityDialog={onOpenQuantityDialog}
              onSetSplitItemQuantity={onSetSplitItemQuantity}
              onToggleSplitItem={onToggleSplitItem}
            />
          </motion.div>
        );
      })}
      </AnimatePresence>
    </div>
  );
}
```

The `style={{ overflow: "hidden" }}` is required so the `height: 0 → auto` animation doesn't briefly show clipped row content spilling out during the transition.

- [ ] **Step 4: Typecheck and lint**

Run: `npm run typecheck`
Expected: no errors — pay attention to the `key` prop having moved from `CartItemRow` to the wrapping `motion.div`; `CartItemRow`'s prop type doesn't include `key` (React strips it), so this is a non-issue, but confirm no other prop was dropped in the move.

Run: `npx eslint src/features/pos/table-selection/cart-items.tsx`
Expected: no errors.

- [ ] **Step 5: Manual verification**

Open `/pos/tables`, select a table with an active order, open the counter/order screen, add an item — confirm the new row fades/expands in (~180ms), not an instant snap. Remove or cancel an item (while ≥2 items remain) — confirm it fades/collapses out smoothly and the rows below it slide up (the `layout` prop). Change a quantity — confirm this does not retrigger enter/exit animation on the row (only add/remove should, since the row's `key` doesn't change on a quantity edit). Emulate `prefers-reduced-motion: reduce` and confirm rows appear/disappear instantly with no animation. Confirm the cart total and badge count (Task 4) are correct immediately, not delayed by this row animation.

- [ ] **Step 6: Commit**

```bash
git add src/features/pos/table-selection/cart-items.tsx
git commit -m "feat(pos): animate cart item add/remove/reorder"
```

---

## Final check across all tasks

- [ ] **Step 1: Full typecheck and lint**

Run: `npm run typecheck`
Expected: no errors.

Run: `npm run lint`
Expected: no new errors introduced by this plan (pre-existing unrelated warnings/errors elsewhere in the repo, if any, are not this plan's concern).

- [ ] **Step 2: Run the existing test suite**

Run: `npm test`
Expected: all tests still pass — this plan touches no `.ts` service/store/validator logic, only presentational `.tsx` components, so no existing test should be affected.
