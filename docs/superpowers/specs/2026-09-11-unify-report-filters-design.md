# Unify report filter UI across order-audit, employee-sales, daily-closing

## Problem

Four report pages (`daily-sales`, `payment-methods`, `category-sales`, `best-selling-products`) share one filter shell: `ReportPageShell` + `ReportFilterCard` (inline on `lg+`) + `ReportFilterSheet` (centered dialog on small screens), from `src/features/report/shared/report-page-shell.tsx` and `report-filter-shell.tsx`. These pages have no visible page title/description — the `<h1>` is screen-reader-only and filters start immediately.

Three other report pages predate or fell outside that consolidation and each roll their own filter chrome:

- `order-audit` — visible title/description header, a standalone toolbar with an always-inline search `<Input>`, and a filter `Sheet` (side drawer) that is the *only* way to filter on any screen size.
- `employee-sales` — same shape as order-audit: visible header, standalone toolbar, side-drawer `Sheet` only.
- `daily-closing` — a single ad-hoc `Card` filter form, always visible (no responsive split, no separate mobile sheet).

The user wants all three to look like `payment-methods`/`category-sales`: same filter card/sheet component, same sr-only header, same `AppPagination` placement where applicable.

## Non-goals

- Row-selection, export (Excel/PDF/print), sorting, detail-sheet/row-card layouts: untouched. These aren't part of "the filter section."
- `stuck-orders` and `offline-sync-review`: no date/branch filter exists on these pages (queue-management screens with just a refresh button) — out of scope.
- No backend API changes. `employee-sales`' endpoint (`/api/v1/report_all/user_report`) has no `page`/`limit` params; pagination for it is client-side only (confirmed with the user).

## Design

### order-audit

- Delete `src/features/report/order-audit/order-audit-toolbar.tsx`. Its `search` field moves into the filter card/sheet as a primary field (same pattern `daily-sales` uses — see `daily-sales-report-filters.tsx`'s `DailySalesPrimaryFields`), so search is only applied via the "Apply" button, consistent with every other filter field.
- Replace the always-open `Sheet` in `order-audit-filter-sheet.tsx` with a new `order-audit-filter-bar.tsx`-style pair: `OrderAuditFilterBar` (wraps `ReportFilterCard`, visible `lg+`) and `OrderAuditFilterSheet` (rewritten on top of `ReportFilterSheet`, visible below `lg`). Both reuse the existing `ReportBranchField` / `ReportDateRangeFields` / `ReportSelectField` calls (action/entity selects) essentially unchanged.
- Wrap `order-audit-page.tsx`'s markup in `ReportPageShell`. Drop the visible `<h1>` title, description paragraph, and branch-label line — the shell's `<h1>` is sr-only, matching payment-methods/category-sales exactly.
- Move `AppPagination` into `ReportTableCard`'s `footer` slot (same footer styling — border-top, padding — as the four shell reports) rather than a bare `<AppPagination>` below the table.
- `useReportBranchSelection`, `useOrderAuditReportStore`, `apply`/`refresh`/`paging` state all stay as they are — only the JSX/layout of the filter and outer shell changes.

### employee-sales

- Same toolbar → filter-card/sheet swap as order-audit: delete `employee-sales-toolbar.tsx`, rewrite `employee-sales-filter-sheet.tsx` into `EmployeeSalesFilterBar` (`ReportFilterCard`) + `EmployeeSalesFilterSheet` (`ReportFilterSheet`). The employee combobox and the order-by toggle button become extra fields/actions alongside the shared ones (order-by toggle can live in the `ReportFilterCard`'s `actions` slot next to Apply, matching how `daily-sales`/`category-sales` place their refresh/summary-toggle buttons there).
- Wrap `employee-sales-page.tsx` in `ReportPageShell`; drop its visible title/description/branch-label header.
- **New: client-side pagination.** Add local `page`/`limit` state (default limit from `PAGE_LIMIT_OPTIONS[0]`, exposed via a `ReportPageLimitField` in the filter's secondary fields). Slice `current.user_reports` to the current page before passing rows to `EmployeeSalesTable`/`EmployeeSalesRowCard`. Drive an `AppPagination` in `ReportTableCard`'s footer off this local state (`page`, `totalPages = Math.ceil(user_reports.length / limit)`, `onPageChange` just sets local state — no refetch). Reset to page 1 whenever `applied` filters change.
- To use `ReportTableCard` (which assumes an export menu), pass no `onExportPrint`/disable export — check `ReportTableCard`'s props at implementation time; if export is mandatory (not optional in the type), employee-sales keeps using a plain card wrapper for the table body but still gets `AppPagination` in a footer styled to match (`border-t border-border bg-card px-4 py-3` — copy the exact classes `ReportTableCard` uses internally) rather than forcing an export menu that doesn't apply to this report. This is a call to make during implementation, not before — resolve it by reading `report-table-card.tsx`'s prop types again at that point.

### daily-closing

- Structurally different: one branch/one day, a receipt preview, no row list — nothing to paginate, and "the filter section" is the only thing being unified here.
- Rebuild `daily-closing-report-controls.tsx`'s form as `ReportFilterCard` (desktop, `lg+`) + `ReportFilterSheet` (mobile) instead of the current always-visible single `Card` form. Keep its own branch `Select` + `ReportDateRangeFields`, and keep the Print/Refresh buttons in the `ReportFilterCard`'s `actions` slot (same slot pattern other reports use for refresh/summary toggle).
- Do **not** force `ReportPageShell` or `ReportTableCard` here — those assume a paginated data table and export menu that don't exist on this page. Only the filter card/sheet component is shared; the receipt preview area and print flow stay exactly as they are.

## Verification

- `npm run typecheck` (must pass — non-negotiable per project rules).
- Manually exercise all three pages at `lg+` and `<lg` widths in the browser preview:
  - Filter card appears inline on desktop, sheet opens on mobile, Apply/Refresh work.
  - order-audit: search + action + entity filters and real (backend) pagination still work.
  - employee-sales: employee combobox, order-by toggle, and the new client-side pagination slice correctly against already-loaded data; changing applied filters resets to page 1.
  - daily-closing: branch/date filter + print flow unaffected, only the filter chrome changed.
- No change to `src/lib/offline-routes.ts` / `OFFLINE_*_ROUTES` expected (no route or offline-sync behavior touched) — but confirm nothing in these three pages is in the offline allowlist before finishing, per the project's Non-negotiable #7.
