# Order audit page redesign

Date: 2026-09-09
Route: `/report/order-audit`
Status: approved for planning

## Problem

`order-audit-page.tsx` was built as a raw admin filter form + table:

1. All six filter controls (branch, date-from, date-to, search, action,
   entity) plus two buttons sit in one `grid-cols-2 lg:grid-cols-4` block that
   takes up to 55dvh on a phone/tablet before any data is visible.
2. Every action badge renders as the same `variant="secondary"` regardless of
   whether it was a CREATE, an EDIT, or a VOID — the row most likely to matter
   (a void/cancel) has no more visual weight than a routine create.
3. The compare dialog lists every field in the same plain row style; a cashier
   has to read every before/after pair to find what actually changed.
4. Below `md` the table wraps or scrolls awkwardly — there is no dedicated
   mobile presentation.

This is a UI/UX-only redesign. Store logic (`src/stores/report-store/order-audit.ts`),
service calls, API params, and pagination/snapshot behavior do not change.

## Goal

A cashier or manager opens the page, sees a compact toolbar, scans a table
where severity is color-coded, and opens a side panel to see exactly what
changed — on both desktop and a POS tablet/phone.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ກວດສອບອໍເດີ (ສາຂາ ຫຼັກ)                                          │
│ [🔍 ຄົ້ນຫາ...........................] [ໂຕກອງ (2) ▾] [⟳]        │
├──────────────────────────────────────────────────────────────┤
│ ⓘ ປະຫວັດຍ້ອນຫຼັງ 90 ວັນ                                          │
│ 128 ລາຍການ · ໜ້າ 1/7                                            │
├──────────────────────────────────────────────────────────────┤
│ ເວລາ      ໃບບິນ         ຜູ້ໃຊ້      ການກະທຳ    ລາຍລະອຽດ            │
│ 10:42:03  INV-0231     ສົມຊາຍ    ● ຍົກເລີກ    ລາຍການ → ...       │
│ 09:15:40  INV-0230     ລະບົບ     ● ແກ້ໄຂ      ຈຳນວນ → ...        │
│ ...                                                             │
├──────────────────────────────────────────────────────────────┤
│                                    ໜ້າ 1/7  [ກ່ອນໜ້າ] [ຖັດໄປ]    │
└──────────────────────────────────────────────────────────────┘
```

The filter Sheet (opened by the "ໂຕກອງ" button, slides in from the right on
desktop, full-width on mobile) holds branch, date range, action, and entity —
the same fields as today, reusing `ReportBranchField` / `ReportDateRangeFields`
/ `ReportSelectField` from `report-filter-fields.tsx` unchanged. "ຄົ້ນຫາ" moves
out of the Sheet into the always-visible toolbar `Input`, since it is the
highest-frequency filter. The Sheet keeps its own apply button and the
invalid-date message — only the container changes, not the validation logic
(`validAuditDateRange`, `apply()`).

## Components

Created:

| File | Responsibility |
| --- | --- |
| `order-audit-toolbar.tsx` | Search input, active-filter-count badge, "ໂຕກອງ" button opening the filter sheet, refresh button. |
| `order-audit-filter-sheet.tsx` | `Sheet` wrapping the existing branch/date/action/entity fields, apply button, invalid-date message. |
| `order-audit-table.tsx` | Desktop table: colored action badges, tabular-nums time column, whole-row click to open detail. |
| `order-audit-row-card.tsx` | Mobile/`sm`-and-below card representation of one row, same click behavior. |
| `order-audit-detail-sheet.tsx` | Replaces the compare `Dialog`. Same content (actor/time/action/reason + before/after table + reference id) but changed-only cells are highlighted; unchanged fields render muted. |
| `order-audit-action-badge.tsx` | Maps an `ORDER_AUDIT_ACTIONS` value to a semantic badge variant (see Action severity below). |
| `order-audit-skeleton.tsx` | Table-shaped skeleton (header row + N placeholder rows) instead of one full-width block. |

Modified:

- `order-audit-page.tsx` — composes the toolbar, filter sheet, table/card
  switch, pagination footer, detail sheet. Filter draft/applied state,
  `paging` state, `apply()`, and the data-fetch `useEffect` are unchanged;
  only the JSX composition changes.

Unchanged: `order-audit-utils.ts` (`auditChanges`, `auditDateTime`, `auditToday`,
`validAuditDateRange`), `src/stores/report-store/order-audit.ts`,
`src/services/report/order-audit.ts`, `src/config/order-audit.ts`.

`auditChanges` already returns `{ field, label, before, after }` per changed
field — the detail sheet's "changed" highlight only needs `before !== after`
on values already provided; no new computation is added to that helper.

## Action severity

The real `ORDER_AUDIT_ACTIONS` set (`src/config/order-audit.ts`) is `CREATE,
DISCOUNT, PRICE, QUANTITY, CANCEL, DELETE, MOVE, PAYMENT, UPDATE` — no `VOID`
or `EDIT` exist today. Each maps to an existing semantic token from
`globals.css`, applied the same way `cancel-sale-status.tsx` already applies
them — as a `className` override on `Badge` (`border-x/25 bg-x/10 text-x`),
not a new `Badge` variant:

| Action | Badge classes |
| --- | --- |
| `CANCEL`, `DELETE` | `border-destructive/25 bg-destructive/10 text-destructive` |
| `DISCOUNT`, `PRICE`, `QUANTITY`, `MOVE`, `UPDATE` | `border-warning/25 bg-warning/10 text-warning` |
| `CREATE` | `border-success/25 bg-success/10 text-success` |
| `PAYMENT` | `border-info/25 bg-info/10 text-info` |
| any future/unlisted value (fallback) | `variant="secondary"` (today's behavior) |

The mapping lives in `order-audit-action-badge.tsx` as a small lookup table
keyed by `OrderAuditAction`, not a switch scattered across the row/card
components, so table and card views render identical badges from one source.

## Responsive behavior

- `md` and up: toolbar in one row, `order-audit-table.tsx` renders.
- Below `md`: toolbar wraps to two rows (search full width, filter+refresh
  second row), `order-audit-row-card.tsx` renders instead of the table.
- The filter Sheet and detail Sheet both go full-width below `sm` (shadcn
  `Sheet` supports this via its existing responsive width classes).
- All interactive targets keep the current `min-h-10` floor; whole-row/card
  click targets make this easier to hit on a tablet, not harder.

## States

Unchanged patterns, per `docs/Design.md`: `Skeleton` for loading (now
table-shaped), `EmptyState` for no rows, `Alert` for the 90-day history notice
and for errors. No new state-presentation pattern is introduced.

## Testing

No new pure-logic helpers are introduced — `auditChanges`, `auditDateTime`,
`auditToday`, and `validAuditDateRange` keep their existing tests in
`order-audit-utils.test.ts` unchanged. The action-severity lookup table in
`order-audit-action-badge.tsx` is a static object, not a function with
branches worth unit-testing on its own; it's covered by the store/service
tests already passing data through `ORDER_AUDIT_ACTIONS`.

Manual verification (this is a UI-only change, no new business logic):
`npm run dev`, open `/report/order-audit`, confirm at desktop and mobile
viewport: filter sheet open/apply, search, action badges colored correctly,
row/card click opens detail sheet with changed-field highlighting, pagination,
loading skeleton shape, empty state, error state (branch load failure).

## Out of scope

- Any change to filter semantics, API params, pagination/snapshot behavior.
- Grouping by order or by day (rejected timeline/hybrid approaches — see
  brainstorming discussion; audit logs need scan/filter, not narrative).
- New i18n keys — all existing `orderAudit.*` keys are reused as-is; no
  wording changes.
