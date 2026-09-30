"use client";

import { Fragment, useCallback, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppPagination } from "@/components/common/app-pagination";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableReportTableHead } from "@/features/report/report-sort-table-head";
import {
  ReportColumnsMenu,
  useReportColumnVisibility,
  type ReportColumnOption,
} from "@/features/report/shared/report-column-visibility";
import {
  ReportPaginationBar,
  ReportResultArea,
  ReportSummaryToggle,
  ReportToolbar,
} from "@/features/report/shared/report-layout";
import { ReportIndeterminateCheckbox, useReportRowSelection } from "@/features/report/shared/report-row-selection";
import { useLocalTableSort } from "@/features/report/shared/report-sort-utils";
import { STICKY_TABLE_CLASS, useStickyTable } from "@/features/report/shared/report-sticky-table";
import { ReportColumnPinningProvider, ReportRowPinToggle, ReportRowPinningProvider } from "@/features/report/shared/report-column-head";
import { money } from "@/lib/format";
import { pageRange, pageTotalPages } from "@/lib/pagination";
import { cn } from "@/lib/utils";

// The bill table of the full-screen report detail modals (customer sales, employee sales): the
// daily-sales table's features on one list of bills — sticky header, sortable columns, a
// "columns" menu remembered per device, row selection with its total, the sticky totals row,
// search, pagination, and optionally rows that expand to show what the bill contained.

// Money tones follow the report pages: discounts red, service blue, VAT amber, the total in the
// theme colour; a zero is muted whatever its column.
export type DetailColumnTone = "default" | "discount" | "service" | "vat" | "total" | "success" | "pending";

export type DetailColumn<Row> = {
  /** false = the column that names the row or the figure the report is about. */
  hideable?: boolean;
  key: string;
  kind: "date" | "text" | "number" | "money";
  label: string;
  minWidth: string;
  tone?: DetailColumnTone;
  /** Shown and summed for number/money columns; shown and sorted for text/date columns. */
  value: (row: Row) => number | string;
  /** Sort by something other than the displayed value (e.g. a raw timestamp). */
  sortValue?: (row: Row) => unknown;
};

const PAGE_SIZE = 50;

function isNumeric<Row>(column: DetailColumn<Row>) {
  return column.kind === "number" || column.kind === "money";
}

function toneClass(tone: DetailColumnTone | undefined, value: number) {
  if (value === 0) return "text-muted-foreground";
  switch (tone) {
    case "discount":
      return "text-destructive";
    case "service":
      return "text-info-text";
    case "vat":
      return "text-warning-text";
    case "success":
      return "text-success";
    case "pending":
      return "text-pending";
    case "total":
      return "font-medium text-primary-text";
    default:
      return "";
  }
}

function displayNumber(value: number, kind: "number" | "money") {
  return kind === "money" ? money(value) : value.toLocaleString("en-US");
}

// Same look as the daily-sales totals row: solid, stuck to the bottom of the scroll area.
function footerCellClass(align: "left" | "right" = "left") {
  return cn(
    "sticky bottom-0 z-20 border-t border-primary/30 bg-background bg-linear-to-r from-primary/10 to-primary/10 font-medium text-primary-text",
    align === "right" && "text-right tabular-nums",
  );
}

export function ReportDetailOrdersTable<Row>({
  columns,
  countLabel,
  getRowId,
  renderExpanded,
  reportId,
  rows,
  searchPlaceholder,
  searchText,
  summary,
  summaryId,
  title,
  totalsKey,
}: {
  columns: DetailColumn<Row>[];
  /** Label of the bill count in the totals row, e.g. "Bills". */
  countLabel: string;
  getRowId: (row: Row) => string;
  /** When given, each row can expand to show this below it. */
  renderExpanded?: (row: Row) => ReactNode;
  /** Key the column choice is remembered under. */
  reportId: string;
  rows: Row[];
  searchPlaceholder: string;
  searchText: (row: Row) => string;
  /** Stat cards etc. above the table; the eye button hides it. */
  summary?: ReactNode;
  summaryId: string;
  title: string;
  /** The column the selection total adds up (usually the grand total). */
  totalsKey: string;
}) {
  const { t } = useTranslation();
  const columnOptions = useMemo<ReportColumnOption[]>(
    () => columns.map((column) => ({ hideable: column.hideable !== false, id: column.key, label: column.label })),
    [columns],
  );
  const visibility = useReportColumnVisibility(reportId, columnOptions);
  const visibleColumns = useMemo(() => columns.filter((column) => visibility.isVisible(column.key)), [columns, visibility]);
  const stickyRef = useStickyTable(visibility.pinning);

  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [summaryVisible, setSummaryVisible] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => searchText(row).toLowerCase().includes(query));
  }, [rows, search, searchText]);

  const columnByKey = useMemo(() => new Map(columns.map((column) => [column.key, column])), [columns]);
  const getSortValue = useCallback(
    (row: Row, key: string) => {
      const column = columnByKey.get(key);
      return column ? (column.sortValue ?? column.value)(row) : "";
    },
    [columnByKey],
  );
  const { sort, sortedRows, toggleSort } = useLocalTableSort(filtered, getSortValue);

  const selection = useReportRowSelection({ getRowId, rows: sortedRows });
  const totalsColumn = columnByKey.get(totalsKey);
  const selectedTotal = totalsColumn
    ? selection.selectedRows.reduce((sum, row) => sum + (Number(totalsColumn.value(row)) || 0), 0)
    : 0;

  const totalPages = pageTotalPages(0, sortedRows.length, PAGE_SIZE);
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);
  const range = pageRange(pagedRows.length, currentPage, PAGE_SIZE);

  // Totals of what the table shows (every page of the current search), not just this page.
  const totals = useMemo(() => {
    const sums = new Map<string, number>();
    columns.filter(isNumeric).forEach((column) => {
      sums.set(column.key, filtered.reduce((sum, row) => sum + (Number(column.value(row)) || 0), 0));
    });
    return sums;
  }, [columns, filtered]);

  const pageAllSelected = pagedRows.length > 0 && pagedRows.every(selection.isRowSelected);
  const pageSomeSelected = pagedRows.some(selection.isRowSelected);
  // Text columns come first; the totals label spans the checkbox, the number and all of them.
  const firstNumeric = visibleColumns.findIndex(isNumeric);
  const textCount = firstNumeric === -1 ? visibleColumns.length : firstNumeric;
  const allExpanded = pagedRows.length > 0 && pagedRows.every((row) => expanded.has(getRowId(row)));

  function changeSearch(value: string) {
    setSearch(value);
    setPage(1);
  }

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAllExpanded() {
    setExpanded((current) => {
      const next = new Set(current);
      pagedRows.forEach((row) => (allExpanded ? next.delete(getRowId(row)) : next.add(getRowId(row))));
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {summaryVisible && summary ? <div id={summaryId} className="shrink-0">{summary}</div> : null}

      <ReportToolbar
        title={
          <h3 className="font-medium">
            {title}
            <span className="ml-1.5 text-muted-foreground tabular-nums">({filtered.length.toLocaleString("en-US")})</span>
          </h3>
        }
        selectedLabel={
          selection.selectedCount
            ? `${t("report.selectedForExport", { count: selection.selectedCount })} · ${money(selectedTotal)}`
            : null
        }
        onClearSelection={selection.clearSelection}
        actions={
          <>
            <InputGroup className="w-44 sm:w-60">
              <InputGroupAddon>
                <Search />
              </InputGroupAddon>
              <InputGroupInput
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                value={search}
                onChange={(event) => changeSearch(event.target.value)}
              />
              {search ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton size="icon-xs" aria-label={t("actions.clear")} onClick={() => changeSearch("")}>
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
            {renderExpanded ? (
              <Button type="button" variant="outline" disabled={!pagedRows.length} onClick={toggleAllExpanded}>
                {allExpanded ? <ChevronDown data-icon="inline-start" /> : <ChevronRight data-icon="inline-start" />}
                <span className="hidden sm:inline">{allExpanded ? t("actions.collapseAll") : t("actions.expandAll")}</span>
              </Button>
            ) : null}
            {summary ? (
              <ReportSummaryToggle
                controlsId={summaryId}
                visible={summaryVisible}
                onToggle={() => setSummaryVisible((visible) => !visible)}
              />
            ) : null}
            <ReportColumnsMenu options={columnOptions} visibility={visibility} />
          </>
        }
      />

      {pagedRows.length ? (
        <>
          <ReportResultArea framed>
            {/* The table's container scrolls: sticky header on top, sticky totals row below. */}
            <Table containerClassName={cn("min-h-0 flex-1 overflow-auto", STICKY_TABLE_CLASS)} containerRef={stickyRef}>
              <ReportColumnPinningProvider pinning={visibility.pinning}>
              <TableHeader className="sticky top-0 z-30 bg-muted">
                <TableRow>
                  <TableHead className="w-px">
                    <ReportIndeterminateCheckbox
                      aria-label={t("common.selectAll")}
                      checked={pageAllSelected}
                      indeterminate={!pageAllSelected && pageSomeSelected}
                      onCheckedChange={(checked) => selection.toggleRows(pagedRows, checked === true)}
                    />
                  </TableHead>
                  <TableHead className="w-px text-center">{t("fields.no")}</TableHead>
                  {visibleColumns.map((column) => (
                    <SortableReportTableHead
                      key={column.key}
                      align={isNumeric(column) ? "right" : "left"}
                      className={cn(column.minWidth, isNumeric(column) && "text-right")}
                      columnId={column.key}
                      sort={sort}
                      sortKey={column.key}
                      onSort={toggleSort}
                    >
                      {column.label}
                    </SortableReportTableHead>
                  ))}
                </TableRow>
              </TableHeader>
              </ReportColumnPinningProvider>
              <ReportRowPinningProvider>
              <TableBody>
                {pagedRows.map((row, index) => {
                  const id = getRowId(row);
                  const selected = selection.isRowSelected(row);
                  const open = expanded.has(id);
                  return (
                    <Fragment key={id}>
                      <TableRow data-state={selected ? "selected" : undefined} className={cn(open && "bg-muted/40")}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Checkbox
                              aria-label={t("common.selectRow", { name: String(visibleColumns.find((c) => !isNumeric(c))?.value(row) ?? id) })}
                              checked={selected}
                              onCheckedChange={(checked) => selection.toggleRow(row, checked === true)}
                            />
                            <ReportRowPinToggle isDefault={index === 0} label={String(visibleColumns.find((c) => !isNumeric(c))?.value(row) ?? id)} rowId={id} />
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground tabular-nums">
                          <span className="flex items-center justify-center gap-0.5">
                            {renderExpanded ? (
                              <Button
                                type="button"
                                size="icon-sm"
                                variant="ghost"
                                aria-expanded={open}
                                aria-label={open ? t("report.collapseBill") : t("report.expandBill")}
                                onClick={() => toggleExpanded(id)}
                              >
                                {open ? <ChevronDown /> : <ChevronRight />}
                              </Button>
                            ) : null}
                            {pageStart + index + 1}
                          </span>
                        </TableCell>
                        {visibleColumns.map((column) => {
                          const value = column.value(row);
                          if (!isNumeric(column)) {
                            return (
                              <TableCell
                                key={column.key}
                                className={cn(
                                  "whitespace-nowrap",
                                  column.kind === "date" ? "text-muted-foreground tabular-nums" : "font-medium",
                                )}
                                translate={column.kind === "text" ? "no" : undefined}
                              >
                                {value || "-"}
                              </TableCell>
                            );
                          }
                          const numeric = Number(value) || 0;
                          return (
                            <TableCell key={column.key} className={cn("text-right tabular-nums", toneClass(column.tone, numeric))}>
                              {displayNumber(numeric, column.kind === "money" ? "money" : "number")}
                            </TableCell>
                          );
                        })}
                      </TableRow>
                      {open && renderExpanded ? (
                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                          <TableCell colSpan={2 + visibleColumns.length} className="p-0">
                            {renderExpanded(row)}
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
                  );
                })}

                <TableRow className="hover:bg-transparent">
                  <TableCell className={footerCellClass()} colSpan={2 + textCount}>
                    {t("report.summary")}
                    <span className="ml-2 font-normal text-muted-foreground">
                      {countLabel}: {filtered.length.toLocaleString("en-US")}
                    </span>
                  </TableCell>
                  {visibleColumns.slice(textCount).map((column) =>
                    isNumeric(column) ? (
                      <TableCell
                        key={column.key}
                        className={cn(footerCellClass("right"), column.key === totalsKey ? "font-semibold" : "text-foreground")}
                      >
                        {displayNumber(totals.get(column.key) ?? 0, column.kind === "money" ? "money" : "number")}
                      </TableCell>
                    ) : (
                      <TableCell key={column.key} className={footerCellClass()} />
                    ),
                  )}
                </TableRow>
              </TableBody>
              </ReportRowPinningProvider>
            </Table>
          </ReportResultArea>
          <ReportPaginationBar>
            <AppPagination
              page={currentPage}
              totalPages={totalPages}
              rangeLabel={t("common.showingRange", { start: range.start, end: range.end, total: sortedRows.length })}
              onPageChange={setPage}
            />
          </ReportPaginationBar>
        </>
      ) : (
        <EmptyState title={t("common.noData")} />
      )}
    </div>
  );
}
