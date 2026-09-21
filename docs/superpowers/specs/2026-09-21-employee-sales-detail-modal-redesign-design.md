# Employee Sales Detail Modal — Split Layout Redesign

Date: 2026-09-21
Route: `/report/employee-sales` (detail dialog only)
Status: approved for planning

## Problem

`EmployeeSalesDetailSheet` (`src/features/report/employee-sales/employee-sales-detail-sheet.tsx`)
renders every order for the selected employee as a vertically stacked
`Accordion`. To see one bill's items, the user must scroll past every other
section, expand its accordion item, and lose sight of which bill they're
looking at once it's open. `/sales/sales-list` solves the equivalent problem
(pick one bill, see its detail) with a two-column split: a scrollable bill
list on the left, the selected bill's full detail on the right, always
visible together. The user asked for the same split, reusing that page's
list/detail pattern, applied to this modal.

## Goal

Open the same employee detail dialog from `employee-sales-page.tsx` as
today, but replace the orders accordion with a left/right split: an order
list on the left, the selected order's metrics + item breakdown on the
right — so switching between bills no longer costs a scroll-and-re-find.
Everything not explicitly redesigned (header, stat tiles, payment summary,
channels, cancel warning) is kept, just relocated into a collapsible strip
above the split so it doesn't compete with the split for height by default.

## Non-goals

- No change to `EmployeeSalesRow`/`EmployeeSalesOrder`/`EmployeeSalesGroupItem`
  or the API call — this is presentation-only, same data already loaded by
  `employee-sales-page.tsx`.
- No pagination for the order list — `row.orders` is already fully loaded
  client-side (same as today's accordion), just needs to scroll.
- No changes to `sales-list` itself; it's a reference pattern only, not a
  shared component to extract (its panels are bill-list/bill-detail shaped,
  this modal's are order-list/order-detail shaped, with different fields).

## Layout

Inside `DialogContent`, top to bottom:

1. **Header** (unchanged) — avatar, `login_email`, `roles_name` · `branch_name`.
2. **Collapsible summary strip** — the existing stat tiles section, payment
   summary, order-channel breakdown, and cancel warning, wrapped in one
   collapsible region defaulting to **expanded**, with a toggle button next
   to a small "summary" label in its own row. Collapsing it maximizes height
   for the split below. State (`summaryVisible`) lives in the same local
   `useState` group as `selectedOrderUuid`, reset per `row` like the rest of
   the sheet's state already is (dialog re-opens fresh per employee).
3. **Split panel**, replacing the current `Accordion type="multiple"`:
   - **Left — order list** (`w-72` fixed column on `md:` and up): one row per
     `order.order_invoice`. Top line: invoice number (bold) + `grand_total`
     (tabular-nums, right-aligned). Second line: `sale_date_time` formatted
     via the existing `formatShortDate` + `total_qty` with a `Package` icon,
     mirroring `BillListItem` from `sales-bill-list.tsx`. Selected row gets
     `bg-primary/10` + a `bg-primary` left accent bar, same treatment as
     `sales-bill-list`'s selected state (no "needs payment attention" warning
     variant here — employee orders carry no debt/status field). List scrolls
     independently (`overflow-y-auto`) inside a fixed-height split.
   - **Right — order detail**: the existing `OrderMetric` 4-tile grid (net
     sale / service charge / vat / grand total) for the selected order,
     followed by its category breakdown tables — exactly the content
     currently inside `AccordionContent`, unchanged in content and markup,
     just rendered for the selected order instead of behind an expand
     toggle. Uses the existing `groupBreakdownsByOrder` map, keyed by
     `selectedOrderUuid` instead of iterating all orders.
   - Selection state: `selectedOrderUuid`, auto-set to `row.orders[0]?.order_uuid`
     whenever `row` changes (new employee opened) — mirrors
     `useResetOnChange(bills, ...)` in `use-sales-list-page.ts`. If
     `row.orders.length === 0`, the right panel shows the same
     `t("common.noData")` message the accordion shows today for empty
     breakdowns.
4. **Modal width**: `sm:max-w-4xl` → `sm:max-w-6xl`, giving the split enough
   horizontal room; height constraint (`max-h-[calc(100dvh-...)]`) unchanged.
5. **Responsive breakpoint**: split activates at `md:` (768px), not `xl:`
   like `sales-list` — this is a dialog constrained by `max-w-6xl`, not a
   full-viewport page, so `xl:` would rarely engage even on desktop. Below
   `md:`, the dialog shows one view at a time via local state
   (`mobileView: "list" | "detail"`), not a nested `Drawer` (nesting a
   `Drawer` inside a `Dialog` is unsupported by the existing primitives and
   adds a second overlay/animation layer for no benefit here — the dialog
   itself already is the "sheet"):
   - `mobileView` starts at `"list"` whenever `row` changes.
   - Tapping an order sets `selectedOrderUuid` and `mobileView = "detail"`
     (`md:` and up ignore `mobileView`, both panels always visible).
   - The detail view gets a small back button (`ArrowLeft` icon + order
     invoice number) above the `OrderMetric` grid, visible only below `md:`,
     that sets `mobileView = "list"`.

## Component changes

- `employee-sales-detail-sheet.tsx`: restructured into
  - `EmployeeSalesDetailSheet` (dialog shell, header, summary-toggle button,
    owns `selectedOrderUuid`/`mobileView`/`summaryVisible` state)
  - `EmployeeSalesSummaryStrip` (extracted from the current inline JSX:
    stat tiles + payment tiles + channels + cancel warning, collapsible)
  - `EmployeeOrderList` (new, left panel)
  - `EmployeeOrderDetail` (new, right panel — the current `AccordionContent`
    body, minus the accordion trigger/wrapper)
  - `groupBreakdownsByOrder`, `StatTile`, `PaymentTile`, `OrderMetric`,
    `SectionHeading` helpers are kept as-is (still used, same signatures).
- No new files outside this one; no service/store changes.

## Out of scope questions resolved during brainstorming

- Summary placement: collapsible strip above the split, default expanded.
- Modal width: expand to near-full (`max-w-6xl`).
- Mobile behavior: list first, tap-through to detail (in-dialog view swap,
  not a nested drawer).
