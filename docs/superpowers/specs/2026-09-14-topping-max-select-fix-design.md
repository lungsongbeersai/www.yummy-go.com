# Fix `prod_topping_max_select` semantics

## Problem

`prod_topping_max_select` is a per-product field the merchant configures in the admin product form. Its name and the admin form's own copy ("Max quantity per topping") led to a misunderstanding: the field was implemented everywhere as a cap on the **quantity of a single topping** (how many of the same topping a customer can add via the +/- stepper).

The field actually means: the maximum number of **distinct toppings** the customer may select for this product. 0/unset = unlimited (naturally capped by how many toppings the product has).

This is wired wrong in two independent ordering flows that each reimplement topping selection:

- Staff POS: `src/features/pos/order-customer/topping-selection.ts` (`toppingQtyCap`) → `src/features/pos/order-customer/order-customer-product-options.tsx`
- Public customer ordering: `src/features/public-pos/order/product-domain.ts` (`toppingMaxQty`) → `src/features/public-pos/order/components/product-order-sheet-content.tsx`

Both flows: a checkbox selects/deselects a topping; once selected, an optional +/- stepper adjusts that one topping's quantity. `prod_topping_max_select` currently caps the stepper instead of the number of checked toppings.

The admin product-form label describing the field is also wrong, compounding the original misunderstanding for future readers.

## Goals

- `prod_topping_max_select` limits how many distinct toppings can be selected, in both ordering flows.
- The user can never select more distinct toppings than `prod_topping_max_select` (when >0) or more than the number of available toppings on the product.
- Per-topping quantity (the +/- stepper) is no longer influenced by `prod_topping_max_select` — it reverts to its prior, correct behavior (capped only by `MAX_ORDER_QTY` / `MAX_OPEN_QTY`-or-1-for-free-toppings).
- Fix the misleading admin-form copy and code comments so the field isn't misunderstood again.

## Non-goals

- No backend/API contract change — `prod_topping_max_select` stays a plain number field on the product, sent/read exactly as today.
- No change to the admin product form's UI structure (dropdown 1-20 + "unlimited") — only its label/hint text.
- No change to free-topping-capped-at-1 behavior, stock/promotion quantity rules, or any pricing logic.
- Not adding a toast/tooltip explaining *why* a checkbox is disabled — matches the existing minimal pattern where the qty-stepper's `+` button is already silently disabled at its cap with no explanatory tooltip.

## Design

### Shared shape (implemented separately in each feature, per existing convention — these two features do not share topping logic)

Two small pure functions per feature:

- `toppingSelectionLimit(availableCount: number, productMaxSelect?: number | string): number` — returns `Math.min(availableCount, configuredMax)` when `productMaxSelect` parses to a positive number, else `availableCount`.
- `canSelectMoreToppings(selectedCount: number, availableCount: number, productMaxSelect?: number | string): boolean` — `selectedCount < toppingSelectionLimit(availableCount, productMaxSelect)`.

### Staff POS (`src/features/pos/order-customer/`)

**`topping-selection.ts`**
- `toggleToppingQty`, `changeToppingQty`, `toppingQtyCap`: remove the `productMaxSelect` parameter entirely. `toppingQtyCap()` takes no arguments and always returns `MAX_ORDER_QTY`.
- Add `toppingSelectionLimit` and `canSelectMoreToppings` as described above.
- Update the Thai comment above `toggleToppingQty` (currently says `productMaxSelect` caps quantity) to describe the new distinct-count semantics instead.

**`order-customer-product-options.tsx`**
- `ProductOptionsForm` computes `selectedCount = selectedToppings.length` and `availableCount = toppings.length` once, passes them (or a precomputed `canSelectMore` boolean) down to each `ToppingOptionRow`.
- `ToppingOptionRow`'s `Checkbox` gets `disabled={!selected && !canSelectMoreToppings(selectedCount, availableCount, productMaxSelect)}`. An already-selected row (`selected === true`) is never disabled — deselecting is always allowed.
- The qty stepper's `+` button drops the `productMaxSelect` argument: `disabled={qty >= toppingQtyCap()}`.
- `productMaxSelect` prop stays on `ToppingOptionRow` only if still needed for the checkbox's disabled calc — thread `canSelectMore` down as a plain boolean instead to keep the row component's props minimal (it doesn't need to know about counts, just whether it's allowed to add more).

**`order-selection-validation.ts`**
- Add a new `OrderSelectionIssue` member `"topping-limit-exceeded"` in `menu-structure.ts`.
- In `getOrderSelectionIssue`, after the existing topping-invalid check, add: compute `availableCount` from `(product?.toppings ?? []).filter(isToppingAvailable).length`, and if `toppings.length > toppingSelectionLimit(availableCount, product?.prodToppingMaxSelect)`, return `"topping-limit-exceeded"`. This is a defense-in-depth check — the UI already prevents over-selection via the disabled checkbox, but this catches any state that reaches submission anyway.
- `orderSelectionIssueLabel`: add a branch for `"topping-limit-exceeded"` returning a new i18n key `pos.toppingLimitExceeded` (interpolated with the max count).

### Public customer ordering (`src/features/public-pos/order/`)

**`product-domain.ts`**
- `toppingMaxQty`: remove the `productMaxSelect` parameter. Keeps only the free-topping-capped-at-1 vs. paid-topping-`MAX_OPEN_QTY` distinction.
- Add `toppingSelectionLimit` and `canSelectMoreToppings` (same shape as staff POS).
- Update the Thai comment above `toppingMaxQty` to drop the now-incorrect mention of `prod_topping_max_select` capping quantity.
- `changePublicToppingQty`/`togglePublicToppingQty` signatures are unchanged (they already take a plain `maxQty` number) — only their callers stop passing `productMaxSelect` through `toppingMaxQty`.

**`use-product-order-sheet-workflow.ts`**
- `handleToppingToggle`: before calling `togglePublicToppingQty`, if the topping is not currently selected and `!canSelectMoreToppings(selectedToppings.length, toppings.filter(isToppingAvailable).length, product?.prodToppingMaxSelect)`, return without changing state (no-op). This flow has no separate submit-time issue list the way staff POS does, so the handler itself is the defense-in-depth layer.
- Expose a `canSelectMoreToppings` boolean (computed each render from current `selectedToppings`/`toppings`/`product`) in the hook's return value for the UI to use.

**`components/product-order-sheet-content.tsx`**
- `ProductToppingFieldset`/`ProductToppingRow`: checkbox `disabled` becomes `!selected && !canSelectMoreToppings` (prop threaded from the hook), replacing any prior `productMaxSelect`-based disabling (there was none for the checkbox before — this is new).
- Qty stepper's `+` button drops `productMaxSelect` from its `toppingMaxQty(topping, productMaxSelect)` call → `toppingMaxQty(topping)`.

### Admin form copy + docs (no logic change)

- `public/locales/en/common.json`: `product.toppingMaxSelect` → "Max toppings selectable"; `product.toppingMaxSelectHint` → "The most different toppings a customer can pick. 0 = unlimited."
- `public/locales/la/common.json`: equivalent Lao correction for both keys.
- `src/services/product/types.ts:118` doc comment: replace "Max quantity of any single topping the customer can add" with "Max number of distinct toppings the customer can select; 0 = unlimited (capped by how many toppings the product has)."
- Any other inline Thai/Lao comments in the two logic files referencing the old (wrong) semantics get corrected as part of the same edits (see per-file notes above).

## Testing

No new test framework — this codebase's convention is pure-logic `.test.ts` files (Vitest), no component tests (per CLAUDE.md).

- `src/features/pos/order-customer/order-customer-utils.test.ts`: remove/replace the existing assertions that `toppingQtyCap`/`toggleToppingQty`/`changeToppingQty` are capped by a `productMaxSelect` argument (these tested the old, wrong behavior) with assertions that they always cap at `MAX_ORDER_QTY` regardless of any such argument. Add new tests for `toppingSelectionLimit` and `canSelectMoreToppings` covering: 0/unset → unlimited (equals available count), configured max below available count, configured max above available count (clamped to available), and `canSelectMoreToppings` at/under/over the limit.
- `src/features/pos/order-customer/order-customer-utils.test.ts` (or wherever `getOrderSelectionIssue` is tested): add a case where selected distinct toppings exceed the limit → `"topping-limit-exceeded"`.
- `src/features/public-pos/order/utils.test.ts`: remove/replace the "caps topping qty at the product's prod_topping_max_select" test (tests old wrong behavior) with a test that `toppingMaxQty` is unaffected by any max-select-like argument (or simply drop the argument from its signature and assert the free/paid distinction alone). Add new tests for `toppingSelectionLimit`/`canSelectMoreToppings` mirroring the staff-POS cases.
- `src/features/product\form\product-form-utils.test.ts`, `src/services/offline-menu.test.ts`: no changes needed — neither tests the *meaning* of the field, only that the raw number round-trips through the save payload / offline cache, which is unaffected.
- Verification bar for this change: `npm run typecheck`, `npm run lint`, and the specific updated/added test files run directly (e.g. `npx vitest run src/features/pos/order-customer/order-customer-utils.test.ts src/features/public-pos/order/utils.test.ts`) — not the full `npm test` suite, per standing preference. A manual browser check of the disabled-checkbox behavior in both flows is worthwhile if an authenticated session is reachable, but is not a hard gate given it wasn't reachable in this environment for prior work in this repo.
