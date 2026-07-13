"use client";

import { Fragment, useCallback, type ReactNode, type RefObject } from "react";
import {
  ChevronDown,
  Download,
  FileSpreadsheet,
  FolderTree,
  Printer,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "../report-official-layout";
import { DateFilterButton } from "@/components/common/date-filter-button";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import { cn } from "@/lib/utils";
import type { PaymentMethodReportFilter } from "@/config/report-filters";
import type { CategorySalesReportOrder } from "@/services/report";
import type {
  CategorySalesGroup,
  CategorySalesRow,
} from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../report-row-selection";
import {
  reportOrderLabel,
  reportOrderOptions,
  sortRowsLocally,
  useLocalTableSort,
} from "../report-sort-utils";
import type {
  CategorySalesExportAction,
  CategorySalesOption,
  CategorySalesReportFilters,
} from "./category-sales-report-types";
import {
  categorySalesRowMetricConfigs,
  categorySalesRowId,
  categorySalesSummaryMetricConfigs,
  displayMetric,
} from "./category-sales-report-utils";

type CategorySalesSortKey =
  | keyof CategorySalesRow
  | "groupName"
  | "groupSummary";

type FinancialValueTone = "default" | "discount" | "total";

type FilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: CategorySalesOption[];
  canApply: boolean;
  draftFilters: CategorySalesReportFilters;
  loading: boolean;
  methodOptions: CategorySalesOption[];
  onApply: () => void;
  onDraftChange: (filters: CategorySalesReportFilters) => void;
};

export function CategorySalesSummaryCards({
  summary,
}: {
  summary: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const cards = categorySalesSummaryMetricConfigs(t);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
      {cards.map((card) => (
        <Card
          key={card.key}
          className="overflow-hidden border-border bg-card shadow-sm"
        >
          <CardContent className="p-4">
            <p className="truncate text-xs font-black uppercase text-muted-foreground">
              {card.label}
            </p>
            <p className="mt-2 truncate text-xl font-black tabular-nums text-foreground">
              {displayMetric(summary[card.key], card.kind)}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function CategorySalesFilterBar({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  methodOptions,
  onApply,
  onDraftChange,
}: FilterProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-w-0 border-border bg-card shadow-sm">
      <CardContent className="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-4 lg:items-end 2xl:grid-cols-[repeat(6,minmax(0,1fr))_auto]">
        <CategorySalesFilterFields
          branchLoading={branchLoading}
          branchLocked={branchLocked}
          branchOptions={branchOptions}
          draftFilters={draftFilters}
          idPrefix="category-sales"
          methodOptions={methodOptions}
          onDraftChange={onDraftChange}
        />
        <Button
          type="button"
          className="h-9 min-w-28"
          disabled={loading || !canApply}
          onClick={onApply}
        >
          {loading ? (
            <RefreshCcw className="animate-spin" data-icon="inline-start" />
          ) : null}
          {t("report.apply")}
        </Button>
      </CardContent>
    </Card>
  );
}

export function CategorySalesFilterSheet({
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  methodOptions,
  open,
  onApply,
  onDraftChange,
  onOpenChange,
}: FilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <DialogTitle className="text-base font-black">
            {t("report.filters.currentFilters")}
          </DialogTitle>
          <DialogDescription>
            {t("report.categorySales.title")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 lg:grid-cols-3">
            <CategorySalesFilterFields
              branchLoading={branchLoading}
              branchLocked={branchLocked}
              branchOptions={branchOptions}
              draftFilters={draftFilters}
              idPrefix="category-sales-mobile"
              methodOptions={methodOptions}
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        <DialogFooter className="grid grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:flex">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("actions.close")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={loading || !canApply}
            onClick={onApply}
          >
            {loading ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : null}
            {t("report.apply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MobileCategorySalesFilterSummary({
  branchLabel,
  filters,
  methodLabel,
  onOpen,
}: {
  branchLabel: string;
  filters: CategorySalesReportFilters;
  methodLabel: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const limitLabel = isAllPageLimit(filters.limit)
    ? t("common.all")
    : filters.limit;
  const dateRangeLabel = `${filters.dateFrom} - ${filters.dateTo}`;

  return (
    <div className="rounded-md border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <DateFilterButton
            ariaLabel={`${t("report.filters.openFilters")}: ${dateRangeLabel}`}
            className="h-8 max-w-full rounded-md border-border/70 bg-muted/50 px-2 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
            label={dateRangeLabel}
            onClick={onOpen}
          />
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            <Badge className="h-6 max-w-44 truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {branchLabel}
            </Badge>
            <Badge className="h-6 max-w-36 truncate px-2 text-[11px]">
              {methodLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {limitLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {reportOrderLabel(t, filters.orderBy)}
            </Badge>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          className="h-9 shrink-0 px-3"
          onClick={onOpen}
        >
          <SlidersHorizontal data-icon="inline-start" />
          {t("report.filters.openFilters")}
        </Button>
      </div>
    </div>
  );
}

function CategorySalesFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draftFilters,
  idPrefix,
  methodOptions,
  onDraftChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: CategorySalesOption[];
  draftFilters: CategorySalesReportFilters;
  idPrefix: string;
  methodOptions: CategorySalesOption[];
  onDraftChange: (filters: CategorySalesReportFilters) => void;
}) {
  const { t } = useTranslation();
  const orderOptions = reportOrderOptions(t);

  function patch(patch: Partial<CategorySalesReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      <Field className="gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-branch`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("nav.branch")}
        </FieldLabel>
        <Select
          value={draftFilters.branchUuid}
          disabled={branchLoading || branchLocked || branchOptions.length <= 1}
          onValueChange={(value) => patch({ branchUuid: value })}
        >
          <SelectTrigger id={`${idPrefix}-branch`} className="w-full">
            <SelectValue placeholder={t("nav.branch")} />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {branchOptions.map((branch) => (
                <SelectItem key={branch.value} value={branch.value}>
                  {branch.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-date-from`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateFrom")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-from`}
          type="date"
          value={draftFilters.dateFrom}
          onChange={(event) => patch({ dateFrom: event.target.value })}
        />
      </Field>

      <Field className="gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-date-to`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateTo")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-to`}
          type="date"
          value={draftFilters.dateTo}
          onChange={(event) => patch({ dateTo: event.target.value })}
        />
      </Field>

      <Field className="gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-payment-method`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) =>
            patch({ paymentMethod: value as PaymentMethodReportFilter })
          }
        >
          <SelectTrigger id={`${idPrefix}-payment-method`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {methodOptions.map((method) => (
                <SelectItem key={method.value} value={method.value}>
                  {method.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-limit`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) =>
            patch({ limit: value === "All" ? "All" : Number(value) })
          }
        >
          <SelectTrigger id={`${idPrefix}-limit`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {PAGE_LIMIT_OPTIONS.map((limit) => (
                <SelectItem key={String(limit)} value={String(limit)}>
                  {limit === "All" ? t("common.all") : limit}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

      <Field className="gap-1.5">
        <FieldLabel
          htmlFor={`${idPrefix}-order-by`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.orderBy")}
        </FieldLabel>
        <Select
          value={draftFilters.orderBy}
          onValueChange={(value) =>
            patch({ orderBy: value as CategorySalesReportOrder })
          }
        >
          <SelectTrigger id={`${idPrefix}-order-by`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {orderOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>

    </>
  );
}

type TableCardProps = {
  children: ReactNode;
  exportDisabled: boolean;
  exporting: CategorySalesExportAction | null;
  footer: ReactNode;
  loading: boolean;
  methodLabel: string;
  printDisabled: boolean;
  rowsLength: number;
  selectedCount: number;
  title: string;
  onClearSelection: () => void;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onPrintReport: () => void;
  onRefresh: () => void;
};

export function CategorySalesTableCard({
  children,
  exportDisabled,
  exporting,
  footer,
  loading,
  printDisabled,
  rowsLength,
  selectedCount,
  title,
  onClearSelection,
  onExportExcel,
  onExportPdf,
  onPrintReport,
  onRefresh,
}: TableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 min-w-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-3 md:flex md:max-h-[calc(100dvh-var(--app-shell-header-height)-1.5rem)] md:flex-col">
      <CardHeader className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-black">
            <FolderTree className="size-4 shrink-0" />
            <span className="truncate">{title}</span>
          </CardTitle>
          {selectedCount > 0 ? (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge className="h-6 max-w-full truncate border-primary/20 bg-primary/10 px-2 text-xs text-primary">
                {t("report.selectedForExport", { count: selectedCount })}
              </Badge>
              <Button
                type="button"
                size="xs"
                variant="ghost"
                className="h-6 px-2 text-xs text-muted-foreground"
                onClick={onClearSelection}
              >
                {t("report.clearSelection")}
              </Button>
            </div>
          ) : null}
          {/* <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge className="h-7 w-fit px-2 text-xs">{methodLabel}</Badge>
            <span className="text-xs text-muted-foreground">
              {t("report.categorySales.rowsLabel", { count: rowsLength })}
            </span>
          </div> */}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9"
                disabled={exportDisabled}
              >
                {exporting === "excel" || exporting === "pdf" ? (
                  <RefreshCcw
                    className="animate-spin"
                    data-icon="inline-start"
                  />
                ) : (
                  <Download data-icon="inline-start" />
                )}
                {t("common.export")}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem
                  disabled={exportDisabled}
                  onSelect={onExportExcel}
                >
                  <FileSpreadsheet data-icon="inline-start" />
                  {t("report.exportExcel")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={exportDisabled}
                  onSelect={onExportPdf}
                >
                  <Download data-icon="inline-start" />
                  {t("report.exportPdf")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={printDisabled}
            onClick={onPrintReport}
          >
            {exporting === "print" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <Printer data-icon="inline-start" />
            )}
            {t("report.print")}
          </Button> */}

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9"
            disabled={loading || Boolean(exporting)}
            onClick={onRefresh}
          >
            <RefreshCcw
              className={loading ? "animate-spin" : undefined}
              data-icon="inline-start"
            />
            {t("actions.refresh")}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-80">
            <LoadingState
              label={t("report.categorySales.loading")}
              variant="reportTable"
            />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 md:flex-1 md:overflow-auto">{children}</div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-80">
            <EmptyState
              title={t("report.categorySales.noData")}
              description={t("report.categorySales.adjustFilters")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CategorySalesTable({
  groups,
  labelOverrides,
  selectedRowIds,
  onToggleRow,
  onToggleRows,
}: {
  groups: CategorySalesGroup[];
  labelOverrides?: {
    sum_servicecharge?: string;
    sum_vate?: string;
  };
  selectedRowIds: Set<string>;
  onToggleRow: (row: CategorySalesRow, selected: boolean) => void;
  onToggleRows: (rows: CategorySalesRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();

  const getGroupSortValue = useCallback(
    (group: CategorySalesGroup, key: CategorySalesSortKey) => {
      if (key === "groupName") return group.groupName;
      if (key === "groupSummary") return group.summary.grand_total;
      return group.rows[0]?.[key as keyof CategorySalesRow];
    },
    [],
  );

  const {
    sort,
    sortedRows: sortedGroups,
    toggleSort,
  } = useLocalTableSort(groups, getGroupSortValue);
  const visibleRows = sortedGroups.flatMap((group) =>
    sortRowsLocally(
      group.rows,
      sort,
      (row, key) => row[key as keyof CategorySalesRow],
    ),
  );
  const visibleIds = visibleRows.map(categorySalesRowId);
  const { allVisibleSelected, someVisibleSelected } =
    selectionStateForVisibleIds(visibleIds, selectedRowIds);

  return (
    <div className="hidden min-w-0 md:block">
      <Table className="w-max min-w-full table-auto text-[13px]">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-30 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-background [&_th]:px-3 [&_th]:shadow-sm">
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(visibleRows, event.target.checked)
                }
              />
            </TableHead>
            <SortableReportTableHead
              sort={sort}
              sortKey="productName"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.product")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="billCount"
              className="text-right"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.billCount")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="productPriceTotal"
              className="text-right"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.productPriceTotal")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="totalQty"
              className="text-right"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.qtyTotal")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="toppingTotal"
              className="text-right"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.toppingTotal")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="total"
              className="text-right"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.total")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="discountTotal"
              className="text-right"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.discountTotal")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="serviceCharge"
              className="text-right"
              onSort={toggleSort}
            >
              {labelOverrides?.sum_servicecharge ??
                t("report.categorySales.columns.serviceCharge")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="vat"
              className="text-right"
              onSort={toggleSort}
            >
              {labelOverrides?.sum_vate ?? t("report.categorySales.columns.vat")}
            </SortableReportTableHead>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="grandTotal"
              className="text-right"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.grandTotal")}
            </SortableReportTableHead>
          </TableRow>
        </TableHeader>

        <TableBody className="[&_td]:whitespace-nowrap [&_td]:px-3">
          {sortedGroups.map((group) => (
              <Fragment key={group.groupUuid || group.groupName}>
                <TableRow className="border-t-2 border-border bg-muted/50 hover:bg-muted/50">
                  <TableCell className="w-10 text-center">
                    <ReportIndeterminateCheckbox
                      aria-label={t("common.selectRow", {
                        name: group.groupName,
                      })}
                      checked={
                        selectionStateForVisibleIds(
                          group.rows.map(categorySalesRowId),
                          selectedRowIds,
                        ).allVisibleSelected
                      }
                      indeterminate={
                        !selectionStateForVisibleIds(
                          group.rows.map(categorySalesRowId),
                          selectedRowIds,
                        ).allVisibleSelected &&
                        selectionStateForVisibleIds(
                          group.rows.map(categorySalesRowId),
                          selectedRowIds,
                        ).someVisibleSelected
                      }
                      onChange={(event) =>
                        onToggleRows(group.rows, event.target.checked)
                      }
                    />
                  </TableCell>
                  <TableCell colSpan={10} className="py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {group.groupName}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>

                {(() => {
                  const rows = sortRowsLocally(
                    group.rows,
                    sort,
                    (row, key) => row[key as keyof CategorySalesRow],
                  );

                  return (
                    <>
                      {rows.map((row) => (
                        <TableRow
                          key={`${row.groupUuid}-${row.cateUuid}-${row.productUuid}-${row.rank}`}
                          className={cn(
                            "hover:bg-muted/20",
                            selectedRowIds.has(categorySalesRowId(row)) &&
                              "bg-primary/5 hover:bg-primary/10",
                          )}
                        >
                          <TableCell className="w-10 text-center">
                            <Checkbox
                              aria-label={t("common.selectRow", {
                                name: row.productName,
                              })}
                              checked={selectedRowIds.has(categorySalesRowId(row))}
                              onChange={(event) =>
                                onToggleRow(row, event.target.checked)
                              }
                            />
                          </TableCell>
                          <TableCell>
                            <div className="ml-6 min-w-40 border-l border-border/70 pl-3">
                              <p className="truncate font-bold">{row.productName}</p>
                              {row.cateName ? (
                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                  {row.cateName}
                                </p>
                              ) : null}
                            </div>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {displayMetric(row.billCount, "number")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {displayMetric(row.productPriceTotal, "money")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {displayMetric(row.totalQty, "number")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {displayMetric(row.toppingTotal, "money")}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {displayMetric(row.total, "money")}
                          </TableCell>
                          <TableCell className={financialValueClass(row.discountTotal, "discount")}>
                            {displayMetric(row.discountTotal, "money")}
                          </TableCell>
                          <TableCell className={financialValueClass(row.serviceCharge)}>
                            {displayMetric(row.serviceCharge, "money")}
                          </TableCell>
                          <TableCell className={financialValueClass(row.vat)}>
                            {displayMetric(row.vat, "money")}
                          </TableCell>
                          <TableCell className={financialValueClass(row.grandTotal, "total")}>
                            {displayMetric(row.grandTotal, "money")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </>
                  );
                })()}

                <TableRow className="border-b-2 border-border bg-primary/10 hover:bg-primary/10">
                  <TableCell />
                  <TableCell className="font-black text-primary">
                    <span className="sr-only">{t("common.total")}</span>
                  </TableCell>
                  <TableCell className="text-right font-black tabular-nums">
                    {displayMetric(group.summary.bill_count, "number")}
                  </TableCell>
                  <TableCell className="text-right font-black tabular-nums">
                    {displayMetric(group.summary.product_price_total, "money")}
                  </TableCell>
                  <TableCell className="text-right font-black tabular-nums">
                    {displayMetric(group.summary.total_qty, "number")}
                  </TableCell>
                  <TableCell className="text-right font-black tabular-nums">
                    {displayMetric(group.summary.topping_total, "money")}
                  </TableCell>
                  <TableCell className={financialValueClass(group.summary.total, "default", true)}>
                    {displayMetric(group.summary.total, "money")}
                  </TableCell>
                  <TableCell className={financialValueClass(summaryDiscountTotal(group.summary), "discount", true)}>
                    {displayMetric(summaryDiscountTotal(group.summary), "money")}
                  </TableCell>
                  <TableCell className={financialValueClass(group.summary.sum_servicecharge, "default", true)}>
                    {displayMetric(group.summary.sum_servicecharge, "money")}
                  </TableCell>
                  <TableCell className={financialValueClass(group.summary.sum_vate, "default", true)}>
                    {displayMetric(group.summary.sum_vate, "money")}
                  </TableCell>
                  <TableCell className={financialValueClass(group.summary.grand_total, "total", true, "text-primary")}>
                    {displayMetric(group.summary.grand_total, "money")}
                  </TableCell>
                </TableRow>
              </Fragment>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CategorySalesMobileList({
  groups,
  labelOverrides,
  selectedRowIds,
  onToggleRow,
  onToggleRows,
}: {
  groups: CategorySalesGroup[];
  labelOverrides?: {
    sum_servicecharge?: string;
    sum_vate?: string;
  };
  selectedRowIds: Set<string>;
  onToggleRow: (row: CategorySalesRow, selected: boolean) => void;
  onToggleRows: (rows: CategorySalesRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {groups.map((group) => (
        <section
          key={group.groupUuid || group.groupName}
          className="overflow-hidden rounded-md border border-border bg-card shadow-sm"
        >
          <div className="bg-muted/40 px-3 py-3">
            <div className="flex items-start gap-3">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectRow", { name: group.groupName })}
                className="mt-0.5"
                checked={
                  selectionStateForVisibleIds(
                    group.rows.map(categorySalesRowId),
                    selectedRowIds,
                  ).allVisibleSelected
                }
                indeterminate={
                  !selectionStateForVisibleIds(
                    group.rows.map(categorySalesRowId),
                    selectedRowIds,
                  ).allVisibleSelected &&
                  selectionStateForVisibleIds(
                    group.rows.map(categorySalesRowId),
                    selectedRowIds,
                  ).someVisibleSelected
                }
                onChange={(event) =>
                  onToggleRows(group.rows, event.target.checked)
                }
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-black">
                  {group.groupName}
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("report.categorySales.groupSummary", {
                    categories: group.categories.length,
                    qty: group.summary.total_qty ?? 0,
                  })}
                </p>
              </div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {group.rows.map((row) => (
              <div
                key={`${row.groupUuid}-${row.cateUuid}-${row.productUuid}-${row.rank}`}
                className={cn(
                  "py-3 pr-3",
                  selectedRowIds.has(categorySalesRowId(row)) && "bg-primary/5",
                )}
              >
                <div className="ml-3 flex items-start gap-3 border-l border-border/70 pl-3">
                  <Checkbox
                    aria-label={t("common.selectRow", {
                      name: row.productName,
                    })}
                    className="mt-0.5"
                    checked={selectedRowIds.has(categorySalesRowId(row))}
                    onChange={(event) => onToggleRow(row, event.target.checked)}
                  />
                  <div className="min-w-0 flex-1">
                  <div className="min-w-0">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black">
                        {row.productName}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {row.cateName}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("report.categorySales.columns.qtyTotal")}:{" "}
                        {displayMetric(row.totalQty, "number")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[11px] font-bold text-muted-foreground">
                        {t("report.categorySales.columns.grandTotal")}
                      </p>
                      <p className={cn("text-sm tabular-nums", financialValueTextClass(row.grandTotal, "total"))}>
                        {displayMetric(row.grandTotal, "money")}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <MetricTile
                      label={t("report.categorySales.columns.billCount")}
                      value={row.billCount}
                      kind="number"
                    />
                    <MetricTile
                      label={t("report.categorySales.columns.productPriceTotal")}
                      value={row.productPriceTotal}
                      kind="money"
                    />
                    <MetricTile
                      label={t("report.categorySales.columns.total")}
                      value={row.total}
                      kind="money"
                    />
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    <MetricTile
                      label={t("report.categorySales.columns.discountTotal")}
                      value={row.discountTotal}
                      kind="money"
                      tone="discount"
                    />
                    <MetricTile
                      label={
                        labelOverrides?.sum_servicecharge ??
                        t("report.categorySales.columns.serviceCharge")
                      }
                      value={row.serviceCharge}
                      kind="money"
                    />
                    <MetricTile
                      label={labelOverrides?.sum_vate ?? t("report.categorySales.columns.vat")}
                      value={row.vat}
                      kind="money"
                    />
                  </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-primary">
                  {t("common.total")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("report.categorySales.columns.billCount")}:{" "}
                  {displayMetric(group.summary.bill_count, "number")} /{" "}
                  {t("report.categorySales.columns.qtyTotal")}:{" "}
                  {displayMetric(group.summary.total_qty, "number")}
                </p>
              </div>
              <p className="shrink-0 text-sm font-black tabular-nums text-primary">
                {displayMetric(group.summary.grand_total, "money")}
              </p>
            </div>
          </div>
        </section>
      ))}
    </div>
  );
}

function MetricTile({
  kind,
  label,
  tone = "default",
  value,
}: {
  kind: "money" | "number";
  label: string;
  tone?: FinancialValueTone;
  value: unknown;
}) {
  const valueClassName = kind === "money" ? financialValueTextClass(value, tone) : "text-foreground";

  return (
    <div className="min-w-0 rounded-md border border-border bg-muted/20 px-2.5 py-2">
      <p className="truncate text-[10px] font-bold uppercase text-muted-foreground">
        {label}
      </p>
      <p className={cn("truncate text-xs font-black tabular-nums", valueClassName)}>
        {displayMetric(value, kind)}
      </p>
    </div>
  );
}

function financialValueClass(
  value: unknown,
  tone: FinancialValueTone = "default",
  strong = false,
  positiveTotalClass = "text-foreground"
) {
  return cn(
    "text-right tabular-nums",
    financialValueTextClass(value, tone, strong, positiveTotalClass)
  );
}

function financialValueTextClass(
  value: unknown,
  tone: FinancialValueTone = "default",
  strong = false,
  positiveTotalClass = "text-foreground"
) {
  const number = metricNumber(value);

  return cn(
    (strong || tone === "total" || (tone === "discount" && number > 0)) && "font-black",
    number === 0 && "text-muted-foreground",
    tone === "discount" && number > 0 && "text-destructive",
    tone === "total" && number > 0 && positiveTotalClass
  );
}

function metricNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function summaryDiscountTotal(summary: Record<string, unknown>) {
  return (
    metricNumber(summary.discount_total) ||
    metricNumber(summary.sum_discount) ||
    metricNumber(summary.discount_item_amount) + metricNumber(summary.discount_bill)
  );
}

export function CategorySalesExportSurface({
  containerRef,
  dateRange,
  groups,
  labelOverrides,
  methodLabel,
  rowsLabel,
  showSummary,
  summary,
  title,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  groups: CategorySalesGroup[];
  labelOverrides?: {
    sum_servicecharge?: string;
    sum_vate?: string;
  };
  methodLabel: string;
  rowsLabel: string;
  showSummary: boolean;
  summary: Record<string, unknown>;
  title: string;
}) {
  const { t } = useTranslation();
  const rowMetrics = categorySalesRowMetricConfigs(t, labelOverrides);
  const summaryMetrics = categorySalesSummaryMetricConfigs(t, labelOverrides);

  return (
    <div ref={containerRef} className="report-print-surface">
      <ReportOfficialHeader />
      <div className="report-print-header">
        <div>
          <p className="report-print-kicker">{methodLabel}</p>
          <h1>{title}</h1>
        </div>
        <div className="report-print-meta">
          <span>{dateRange}</span>
          <span>{rowsLabel}</span>
        </div>
      </div>

      {showSummary ? (
        <div className="report-print-section">
          <h2>{t("report.summary")}</h2>
          <table className="report-print-table">
            <tbody>
              {summaryMetrics.map((metric) => (
                <tr key={metric.key}>
                  <td>{metric.label}</td>
                  <td className="is-right">
                    {displayMetric(summary[metric.key], metric.kind)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.categorySales.columns.product")}</th>
            <th>{t("report.categorySales.columns.category")}</th>
            {rowMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.groupUuid || group.groupName}>
              {/* แถวกลุ่มถือยอดรวมของกลุ่มไว้ในตัว เหมือนแถวรวมท้ายกลุ่มบนหน้าจอ */}
              <tr className="is-bill">
                <td colSpan={2}>{group.groupName}</td>
                {rowMetrics.map((metric) => (
                  <td key={metric.key} className="is-right">
                    {displayMetric(
                      metric.key === "discount_total"
                        ? summaryDiscountTotal(group.summary)
                        : group.summary[metric.key],
                      metric.kind,
                    )}
                  </td>
                ))}
              </tr>
              {group.rows.map((row) => (
                <tr key={`${row.groupUuid}-${row.cateUuid}-${row.rank}`}>
                  <td>{row.productName}</td>
                  <td>{row.cateName}</td>
                  {rowMetrics.map((metric) => (
                    <td key={metric.key} className="is-right">
                      {displayMetric(row[metric.field], metric.kind)}
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
          <tr className="is-bill">
            <td colSpan={2}>{t("report.summary")}</td>
            {rowMetrics.map((metric) => (
              <td key={metric.key} className="is-right">
                {displayMetric(
                  metric.key === "discount_total"
                    ? summaryDiscountTotal(summary)
                    : summary[metric.key],
                  metric.kind,
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}
