# Package page redesign — pricing table

Date: 2026-07-29
Route: `/package`
Status: approved for planning

## Problem

The current `/package` screen was built as a data-administration tool, not as a
pricing screen. Three things cause that:

1. Every row carries a permanent grip handle plus up/down arrows — billing
   cycles, store types, and every feature line. Reordering chrome outweighs the
   content it decorates.
2. The layout is a two-pane file explorer: a navigator column on the left, a
   single package card on the right. Packages that exist to be *compared* are
   shown one at a time.
3. Price is rendered as ordinary body text inside a card, so the most important
   number on the screen has no visual weight.

The result reads as a CRUD list. It should read as a pricing table.

## Goal

An admin opening `/package` sees the same shape a customer would see on a
pricing page: store types side by side, price prominent, features as a checked
list. Creating and editing happen inside that layout instead of beside it.

## Data model

The API exposes two axes plus a collection:

- **Billing cycle** — `GET /packages/billing_cycles`. Currently monthly (1) and
  yearly (12). `billing_cycle_months` drives per-month math.
- **Package method** (store type) — `GET /packages/methods`. Currently small,
  general, large.
- **Plan** — one billing cycle paired with one method
  (`POST /packages/plans/create`). `GET /packages/plans/fetch` returns plans
  grouped by cycle under a `package_methods` array.
- **Package** — belongs to a plan, carries `package_price` and an ordered
  `details` array. `GET /packages/fetch_limit` nests
  cycle → method → `packages[]` → `details[]`.

A plan holds `packages[]`, so a column must render one *or more* cards. Real
data currently has exactly one package per plan; the design supports the array
without building extra affordances for a case the API allows but the data has
not yet produced.

## Layout

Billing cycle becomes a toggle. Store types become columns.

```
┌──────────────────────────────────────────────────────────┐
│ ຈັດການແພັກເກດ   [ລາຍເດືອນ|ລາຍປີ]   [ສະຖານະ▾] [⇅ ຈັດລຳດັບ] [+ ແພັກເກດ] │
├──────────────┬──────────────┬──────────────┬─────────────┤
│ ຮ້ານຂະໜາດນ້ອຍ  │ ຮ້ານທົ່ວໄປ     │ ຮ້ານຂະໜາດໃຫຍ່  │  ┌ ─ ─ ─ ─ ┐│
│ 400,000 ₭    │ 400,000 ₭    │ 400,000 ₭    │  │    +    ││
│ /ເດືອນ        │ /ເດືອນ        │ /ເດືອນ        │  │  ເພີ່ມ   ││
│              │              │              │  │ ປະເພດຮ້ານ ││
│ ✓ 2 ສາຂາ     │ ✓ 2 ສາຂາ     │ ✓ 2 ສາຂາ     │  └ ─ ─ ─ ─ ┘│
│ ✓ 10 ຜູ້ໃຊ້    │ ✓ 10 ຜູ້ໃຊ້    │ ✓ 10 ຜູ້ໃຊ້    │             │
│ ✓ ສຳຮອງຂໍ້ມູນ  │ ✓ ສຳຮອງຂໍ້ມູນ  │ ✓ ສຳຮອງຂໍ້ມູນ  │             │
│              │              │              │             │
│ [ ແກ້ໄຂ ]     │ [ ແກ້ໄຂ ]     │ [ ແກ້ໄຂ ]     │             │
└──────────────┴──────────────┴──────────────┴─────────────┘
```

Columns follow `package_plan_sort_order`. A plan with no package renders a
dashed card whose whole surface opens the create dialog, so an empty slot
advertises the action instead of hiding it. A trailing dashed column creates a
new plan.

## Components

Deleted:

- `package-navigator.tsx` (565 lines). Its three jobs move out: cycle selection
  to the toggle, plan selection to the columns themselves, reordering to
  arrange mode.
- `package-card.tsx` (285 lines), replaced by the pricing card below.

Created:

| File | Responsibility |
| --- | --- |
| `package-cycle-toggle.tsx` | Segmented cycle control and the yearly savings badge. Built on the existing `toggle-group` primitive. |
| `package-pricing-grid.tsx` | Column grid, dashed create-package slot, dashed create-plan column. |
| `package-price-card.tsx` | One package: price hero, names, checked feature list, edit action. |

Modified:

- `package-toolbar.tsx` — status filter, arrange toggle, refresh, add package.
  The search field is removed.
- `package-workspace.tsx` — reduced to composing toggle, grid, and the
  loading/error/empty states.
- `package-page.tsx` — search state and pagination state removed.

`package-form-dialog.tsx` and `package-plan-dialog.tsx` are untouched. Both were
exercised in the browser and behave correctly, including the plan dialog
disabling save when every method is already linked to the selected cycle.

Neither `src/stores/package-store.ts` nor `src/services/package/` changes. The
store already exposes the three reorder actions, a `sortingScope` flag, and a
single-flight guard that rejects overlapping reorders. This redesign is
presentation-only.

## Arrange mode

A toolbar toggle. Off by default, so the default view carries no reordering
chrome. Turning it on reveals drag handles at all three levels, matching the
three reorder endpoints:

| Default view | Arrange mode | Endpoint |
| --- | --- | --- |
| Cycle toggle, two buttons | The toggle is replaced in place by a draggable row of cycle chips | `PATCH /packages/billing_cycles/reorder` |
| Columns in sort order | Columns gain grip handles | `PATCH /packages/plans/reorder` |
| Features as checked list | Feature rows gain grip handles | `PATCH /packages/price-details/reorder` |

Drag uses the existing `use-reorder-sensors` hook, which already registers
dnd-kit's keyboard sensor, so reordering stays reachable without a pointer.

## Responsive behavior

`/package` is listed in `FIXED_DATA_SCREEN_PATHS`, so the shell locks body
scroll and the page owns its scroll region. The grid scrolls vertically inside
that region; the page never scrolls horizontally.

- Desktop (`lg` and up): all columns on one row. Each column has a minimum
  width so a cycle with many plans scrolls the grid horizontally inside its own
  container rather than squeezing columns past readability.
- Tablet (`md`): two columns per row, wrapping.
- Mobile: one column per row, cycle toggle full width, controls at least 44px
  tall.

## States

| Condition | Treatment |
| --- | --- |
| Loading, first paint | Skeleton columns matching the grid |
| Refreshing | Existing content stays, spinner in toolbar |
| Load failed | `Alert` with retry, as today |
| No billing cycles | `Empty` — cycles cannot be created from this screen; the API offers only reorder |
| Cycle has no plans | Dashed create-plan column alone |
| Plan has no packages | Dashed create-package card inside its column |

## Savings badge

On the yearly view each column may show a savings badge computed against the
same `methodId` in the monthly cycle:

```
savings% = round((monthlyTotal - yearlyPrice) / monthlyTotal * 100)
monthlyTotal = monthlyPrice * yearlyCycleMonths
```

The badge is hidden when the counterpart method is absent from the other cycle
or when the result is zero or negative. Current data prices monthly and yearly
identically (400,000 for both), so the badge stays hidden until prices diverge.

## Testing

Tests cover pure logic only, matching the project convention of testing
services, store helpers, and validators rather than components. New helpers in
`package-ui-utils.ts`, each with cases in `package-ui-utils.test.ts`:

- `monthlyEquivalentPrice(price, months)` — per-month figure shown under a
  yearly price. Guards `months` of zero.
- `cycleSavingsPercent(monthlyPrice, yearlyPrice, months)` — returns `null`
  when inputs are missing or the result is not positive.
- `orderedPlanColumns(group)` — column order from plan sort order, with a
  stable tiebreak so equal sort values do not reshuffle between renders.

`packagesForPlan` and `activePackageNavigation` already exist and keep their
tests.

Any new i18n key must land in both `public/locales/en/common.json` and
`public/locales/la/common.json`; `src/lib/i18n-resources.test.ts` fails on
missing parity.

## Out of scope

- Creating or deleting billing cycles and methods. The API exposes neither.
- Deleting packages or plans. No endpoint exists.
- Search and pagination. Removed by decision: six packages fit one screen, and
  the status filter covers the one case worth narrowing.
- Changes to the package or plan dialogs.
