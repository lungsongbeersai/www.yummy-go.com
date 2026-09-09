# Employee Sales Report page

Date: 2026-09-09
Route: `/report/employee-sales`
Status: approved for planning

## Problem

There is no page showing sales performance grouped by employee. The backend
already exposes `GET /api/v1/report_all/user_report`, returning, per employee
matching the filter: their bills (`orders[]`), a product-category breakdown
(`groups[]` with nested `items[]`), payment totals, order-channel totals, a
cancellation summary, and a per-employee `summary`, plus a report-wide
`summary`. Nothing in the frontend consumes this endpoint yet.

## Goal

A manager picks a branch, optionally one employee (or leaves it as "all"), a
date range, and a sort direction, then sees one row per employee with their
key totals, and can open a detail panel for any employee to see their bills,
product-category breakdown, payment mix, channel mix, and cancellations.

## Scope decision: no export yet

Unlike `category-sales`/`daily-sales`/`payment-methods` (which use the shared
`ReportPageShell` and ship Excel/PDF/print export), this page follows the
lighter pattern established by `order-audit`: a self-composed page (toolbar +
filter sheet + table/card + detail sheet), `createSimpleReportStore` (the API
returns every matching employee in one response — no pagination), and no
export surface. `ReportPageShell` is not used because its props assume an
export flow (`exportingTitle`, `exportSurface`) this page does not have yet;
adopting it would mean carrying unused plumbing. Export can be added later
as its own increment if requested, following the `category-sales` pattern.

## API

`GET /api/v1/report_all/user_report`

| Param | Meaning | UI source |
| --- | --- | --- |
| `branch_uuid_fk` | required | `ReportBranchField` (existing shared component, existing `useReportBranchSelection`) |
| `login_uuid` | optional; empty = every employee at the branch | `EmployeeCombobox` (new) |
| `date_from` / `date_to` | required | `ReportDateRangeFields` (existing shared component) |
| `lang` | current UI language | `i18n.language`, same as every other report |
| `orderBy` | `asc` \| `desc` | single toggle button, no per-column sort (the API exposes one report-wide sort, not a column key) |

`login_uuid` is always sent as a single value or omitted — never a
comma-separated list. The employee selector is single-select; "every
employee" is expressed by leaving it unset, matching the API's own semantics
(the example response returns an array of `user_reports` and a
`summary.employee_count`, which only makes sense when the filter can match
more than one person).

## Employee selector

`GET /api/v1/register/fetch_all?branch_uuid_fk=<value>&roles_id_fk=1`

- New service function `getEmployeeOptions(branch_uuid_fk, roles_id_fk = EMPLOYEE_SALES_ROLE_ID)` in `src/services/user.ts`, mirroring the existing `getBranchOptions` (same `fetch_all` + `ApiDataResponse<User[]>` shape, no pagination).
- `EMPLOYEE_SALES_ROLE_ID = 1` is a named constant (not a magic number) — the task specifies `roles_id_fk=1` as a fixed filter for this report, not a user-facing choice.
- The combobox mirrors `ProvinceCombobox` (`src/features/settings/location/province-combobox.tsx`): `Popover` + `Command` + `CommandInput` for search, with an explicit "ທັງໝົດ" (all) option pinned first (value `""`).
- The list is scoped to the **draft** branch value inside the filter sheet (not the applied one), so switching branch before applying immediately refetches that branch's employees. If the currently-selected employee isn't in the new branch's list, the draft resets to "all" — same defensive pattern `useReportBranchSelection.normalizeBranchFilters` already uses for branch itself.
- Employee rows render with the existing `UserAvatar` (`src/features/settings/user/user-display.tsx`) and `userInitials` helper — no new avatar component.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ ລາຍງານການຂາຍຕາມພະນັກງານ                                         │
│ [👤 ຄົ້ນຫາພະນັກງານ...] [ໂຕກອງ (1) ▾] [⇅ desc] [⟳]              │
├──────────────────────────────────────────────────────────────┤
│ ພະນັກງານ 3 ຄົນ · ບິນ 18 · Grand Total 12,540,000 ₭              │
├──────────────────────────────────────────────────────────────┤
│ ພະນັກງານ         ບິນ  ລາຍການ  Net Sale   Service  VAT   Grand ▸│
│ [👤] ສົມຊາຍ ...   7    25     4,838,000  65,000   489,000 5,392,000 │
│ ...                                                             │
└──────────────────────────────────────────────────────────────┘
```

The filter Sheet (opened by "ໂຕກອງ") holds branch, employee combobox, date
range; the `orderBy` toggle sits in the always-visible toolbar next to
refresh, since it is a single stateless flip with no invalid state — putting
it behind a sheet tap would cost an extra round trip for the most-used
control after search.

## Main table (one row per employee)

Source: `user_reports[]`. Columns, each already present on the row (no new
computation beyond `money()`/`formatShortDate()` from `src/lib/format.ts`):

| Column | Field |
| --- | --- |
| ພະນັກງານ | `UserAvatar` + `login_email` + `roles_name`. No branch badge — `branch_uuid_fk` is a required filter, so every row on screen always belongs to the one selected branch. |
| ຈຳນວນບິນ | `summary.bill_count` |
| ຈຳນວນລາຍການ | `summary.total_qty` |
| Net Sale | `summary.net_sale` |
| Service Charge | `summary.service_charge` |
| VAT | `summary.vat` |
| Grand Total | `summary.grand_total` (bold — the primary figure) |
| (badge) | shown only when `cancel_summary.cancel_bill_count > 0`: a `warning`-toned badge with the count, same token approach as `order-audit`'s action badges |

Whole row is clickable (opens the detail sheet), matching `order-audit`'s
row-click pattern. Below `md`, a card list (`employee-sales-row-card.tsx`)
replaces the table, mirroring `order-audit-row-card.tsx`.

A one-line summary above the table (not a toggleable card grid, to stay
light): `t("employeeSales.summaryLine", { employee_count, bill_count })` plus
the grand total, built from the report-wide `summary` object.

## Detail sheet (per employee)

Opens right-side (`Sheet`, wider than the default — same
`data-[side=right]:sm:max-w-xl` fix applied in `order-audit-detail-sheet.tsx`,
since the plain override was proven dead CSS against the base `SheetContent`
specificity). Sections, top to bottom:

1. **Header** — `UserAvatar` + `login_email` + `roles_name` + `branch_name`.
2. **Payment summary** — `payment_summary.{cash,transfer,credit,payment_total}` as a small stat row (same visual weight as `order-audit`'s before/after `dl`).
3. **Order channels** — one badge per `order_channels[]` entry: `order_channel_name`, `bill_count`, `grand_total`.
4. **Cancel summary** — rendered only when `cancel_summary.cancel_bill_count > 0`, as a `warning`-variant `Alert` (no destructive-confirmation flow needed — this is read-only reporting, not an action).
5. **Orders table** — one row per `orders[]` entry: `order_invoice`, `sale_date`, `total_qty`, `net_sale`, `service_charge`, `vat`, `grand_total`, and `cash`/`transfer`/`credit`.
6. **Groups** — an `Accordion` (existing primitive), one item per `groups[]` entry (`group_name`, `total_qty`, `gross_amount`, `discount_amount`, `total_amount`), expanding to a small table of `items[]` (`product_full_name`, `unit_price`, `total_qty`, `total_amount`).

All sections render from data already present on the selected `user_reports[]`
entry — no additional API calls when opening the sheet.

## File structure

Created:

| File | Responsibility |
| --- | --- |
| `src/services/report/employee-sales.ts` | Types (`EmployeeSalesRow`, `EmployeeSalesOrder`, `EmployeeSalesGroup`, `EmployeeSalesGroupItem`, `EmployeeSalesParams`, `EmployeeSalesResponse`) + `getEmployeeSalesReport(params)`. |
| `src/stores/report-store/employee-sales.ts` | `createSimpleReportStore`, mirroring `order-audit.ts`. |
| `src/config/employee-sales.ts` | `EMPLOYEE_SALES_ROLE_ID = 1` constant. |
| `src/features/report/employee-sales/employee-sales-utils.ts` (+ `.test.ts`) | Pure helpers: default date range, `employeeSalesFilterCount`-style active-filter count (mirrors `activeAuditFilterCount`), channel/badge tone mapping. |
| `src/features/report/employee-sales/employee-combobox.tsx` | Searchable employee selector. |
| `src/features/report/employee-sales/employee-sales-toolbar.tsx` | Employee-search trigger, filter button (with count badge), `orderBy` toggle, refresh. |
| `src/features/report/employee-sales/employee-sales-filter-sheet.tsx` | Branch / employee / date range / apply. |
| `src/features/report/employee-sales/employee-sales-table.tsx` | Desktop table. |
| `src/features/report/employee-sales/employee-sales-row-card.tsx` | Mobile card list. |
| `src/features/report/employee-sales/employee-sales-detail-sheet.tsx` | Per-employee detail (payment/channels/cancel/orders/groups). |
| `src/features/report/employee-sales/employee-sales-skeleton.tsx` | Table-shaped loading skeleton. |
| `src/features/report/employee-sales/employee-sales-page.tsx` | Composition. |
| `src/app/(protected)/report/employee-sales/page.tsx` | Thin route file. |

Modified:

| File | Change |
| --- | --- |
| `src/services/user.ts` | Add `getEmployeeOptions(branch_uuid_fk, roles_id_fk)`. |
| `src/services/report/index.ts` | Re-export `./employee-sales`. |
| `src/stores/report-store.ts` | Re-export `useEmployeeSalesReportStore`. |
| `public/locales/en/common.json`, `public/locales/la/common.json` | New `employeeSales.*` namespace (column labels, filter labels, empty/error copy, action names). No dynamic use of the API's own `labels` object — the project's i18n stays in the local JSON files, per existing convention across every other report page. |

## Responsive behavior

Same as `order-audit`: `hidden md:block` table / `md:hidden` card list;
filter sheet and detail sheet go full-width below `sm` using the
`data-[side=right]:` prefixed override (the specificity fix already proven
in the order-audit work); every interactive element keeps the `min-h-10`
floor and a visible `focus-visible` ring where a non-native element (e.g. a
mobile card, if one is later made clickable as a whole surface like
`order-audit-row-card.tsx`) needs one.

## States

Same patterns as every other report page, per `docs/Design.md`: `Skeleton`
(table-shaped) for loading, `EmptyState` for no employees matching the
filter, `Alert` for branch/load errors. No new state-presentation pattern.

## Testing

Pure logic only, in `employee-sales-utils.test.ts`:

- Default date range / today calculation (reuse or mirror `auditToday`-style logic if a business-day helper is needed — otherwise reuse `src/lib/format.ts`'s existing date helpers directly, no duplication).
- The active-filter-count helper (branch is always required and excluded from the count, same rule `activeAuditFilterCount` already applies to dates/action/entity).
- Any pure formatting/derivation specific to this report (e.g. deriving the cancel-badge visibility, deriving the report-wide summary line's interpolation values) — only if there is real branching logic worth a test; a straight passthrough of an API field needs no test.

No component tests, matching project convention.

## Out of scope

- Excel/PDF/print export (explicitly deferred; see Scope decision above).
- Multi-employee selection (`login_uuid` stays single-value-or-empty).
- Per-column server-side sort (the API exposes one report-wide `orderBy`).
- Any change to `src/features/settings/location/province-combobox.tsx` or `src/features/settings/user/user-display.tsx` — both are reused read-only as reference/imports.
