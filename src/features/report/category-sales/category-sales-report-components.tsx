"use client";

import { Fragment, useCallback, type ReactNode, type RefObject } from "react";
import {
  CalendarDays,
  ChevronDown,
  Download,
  FileSpreadsheet,
  Filter,
  FolderTree,
  Printer,
  RefreshCcw,
  SlidersHorizontal
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "@/components/common/empty-state";
import { LoadingState } from "@/components/common/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import type { CategorySalesReportOrder, PaymentMethodReportFilter } from "@/services/report";
import type { CategorySalesGroup, CategorySalesRow } from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  reportOrderOptions,
  sortRowsLocally,
  useLocalTableSort
} from "../report-sort-utils";
import type { CategorySalesExportAction, CategorySalesOption, CategorySalesReportFilters } from "./category-sales-report-types";
import {
  categorySalesRowMetricConfigs,
  categorySalesSummaryMetricConfigs,
  displayMetric
} from "./category-sales-report-utils";

type CategorySalesSortKey = keyof CategorySalesRow | "groupSummary";

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

export function CategorySalesSummaryCards({ summary }: { summary: Record<string, unknown> }) {
  const { t } = useTranslation();
  const cards = categorySalesSummaryMetricConfigs(t).slice(0, 8);

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      {cards.map((card) => (
        <Card key={card.key} className="overflow-hidden border-border bg-card shadow-sm">
          <CardContent className="p-4">
            <p className="truncate text-xs font-black uppercase text-muted-foreground">{card.label}</p>
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
  onDraftChange
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
        <Button type="button" className="h-9 min-w-28" disabled={loading || !canApply} onClick={onApply}>
          {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
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
  onOpenChange
}: FilterProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="shrink-0 border-b border-border px-4 py-3 pr-12 text-left">
          <DialogTitle className="text-base font-black">{t("report.filters.currentFilters")}</DialogTitle>
          <DialogDescription>{t("report.categorySales.title")}</DialogDescription>
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
          <Button type="button" disabled={loading || !canApply} onClick={onApply}>
            {loading ? <RefreshCcw className="animate-spin" data-icon="inline-start" /> : null}
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
  onOpen
}: {
  branchLabel: string;
  filters: CategorySalesReportFilters;
  methodLabel: string;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const limitLabel = isAllPageLimit(filters.limit) ? t("common.all") : filters.limit;

  return (
    <div className="rounded-md border border-border bg-card p-2 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1 text-xs font-bold text-muted-foreground">
            <CalendarDays className="size-3.5 shrink-0" />
            <span className="truncate">
              {filters.dateFrom} - {filters.dateTo}
            </span>
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap gap-1">
            <Badge className="h-6 max-w-[11rem] truncate border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {branchLabel}
            </Badge>
            <Badge className="h-6 max-w-[9rem] truncate px-2 text-[11px]">{methodLabel}</Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {limitLabel}
            </Badge>
            <Badge className="h-6 border-border bg-muted px-2 text-[11px] text-muted-foreground">
              {filters.orderBy}
            </Badge>
          </div>
        </div>
        <Button type="button" size="sm" className="h-9 shrink-0 px-3" onClick={onOpen}>
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
  onDraftChange
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
        <FieldLabel htmlFor={`${idPrefix}-branch`} className="text-xs font-bold text-muted-foreground">
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
        <FieldLabel htmlFor={`${idPrefix}-date-from`} className="text-xs font-bold text-muted-foreground">
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
        <FieldLabel htmlFor={`${idPrefix}-date-to`} className="text-xs font-bold text-muted-foreground">
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
        <FieldLabel htmlFor={`${idPrefix}-payment-method`} className="text-xs font-bold text-muted-foreground">
          {t("report.filters.paymentMethod")}
        </FieldLabel>
        <Select
          value={draftFilters.paymentMethod}
          onValueChange={(value) => patch({ paymentMethod: value as PaymentMethodReportFilter })}
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
        <FieldLabel htmlFor={`${idPrefix}-limit`} className="text-xs font-bold text-muted-foreground">
          {t("common.rowsPerPage")}
        </FieldLabel>
        <Select
          value={String(draftFilters.limit)}
          onValueChange={(value) => patch({ limit: value === "All" ? "All" : Number(value) })}
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
        <FieldLabel htmlFor={`${idPrefix}-order`} className="text-xs font-bold text-muted-foreground">
          {t("report.filters.orderBy")}
        </FieldLabel>
        <Select value={draftFilters.orderBy} onValueChange={(value) => patch({ orderBy: value as CategorySalesReportOrder })}>
          <SelectTrigger id={`${idPrefix}-order`} className="w-full">
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
  rowsLength: number;
  title: string;
  onExportExcel: () => void;
  onExportPdf: () => void;
  onOpenFilters: () => void;
  onPrintReport: () => void;
  onRefresh: () => void;
};

export function CategorySalesTableCard({
  children,
  exportDisabled,
  exporting,
  footer,
  loading,
  methodLabel,
  rowsLength,
  title,
  onExportExcel,
  onExportPdf,
  onOpenFilters,
  onPrintReport,
  onRefresh
}: TableCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="min-h-0 min-w-0 overflow-hidden border-border bg-card shadow-sm md:sticky md:top-3 md:flex md:max-h-[calc(100dvh-var(--app-shell-header-height)-1.5rem)] md:flex-col">
      <CardHeader className="flex shrink-0 flex-col gap-2 border-b border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <CardTitle className="flex min-w-0 items-center gap-2 text-base font-black">
            <FolderTree />
            <span className="truncate">{title}</span>
          </CardTitle>
          <Badge className="mt-2 h-7 w-fit px-2 text-xs">{methodLabel}</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="h-9" onClick={onOpenFilters}>
            <Filter data-icon="inline-start" />
            {t("report.filters.openFilters")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="h-9" disabled={exportDisabled}>
                {exporting === "excel" || exporting === "pdf" ? (
                  <RefreshCcw className="animate-spin" data-icon="inline-start" />
                ) : (
                  <Download data-icon="inline-start" />
                )}
                {t("common.export")}
                <ChevronDown data-icon="inline-end" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuGroup>
                <DropdownMenuItem disabled={exportDisabled} onSelect={onExportExcel}>
                  <FileSpreadsheet data-icon="inline-start" />
                  {t("report.exportExcel")}
                </DropdownMenuItem>
                <DropdownMenuItem disabled={exportDisabled} onSelect={onExportPdf}>
                  <Download data-icon="inline-start" />
                  {t("report.exportPdf")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={exportDisabled} onClick={onPrintReport}>
            {exporting === "print" ? (
              <RefreshCcw className="animate-spin" data-icon="inline-start" />
            ) : (
              <Printer data-icon="inline-start" />
            )}
            {t("report.print")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-9" disabled={loading || Boolean(exporting)} onClick={onRefresh}>
            <RefreshCcw className={loading ? "animate-spin" : undefined} data-icon="inline-start" />
            {t("actions.refresh")}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col p-0">
        {loading ? (
          <div className="p-4 md:min-h-[320px]">
            <LoadingState label={t("report.categorySales.loading")} variant="table" />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-h-0 md:flex-1 md:overflow-auto md:overscroll-x-contain md:overscroll-y-auto">
              {children}
            </div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-[320px]">
            <EmptyState title={t("report.categorySales.noData")} description={t("report.categorySales.adjustFilters")} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function CategorySalesTable({ groups }: { groups: CategorySalesGroup[] }) {
  const { t } = useTranslation();
  const metrics = categorySalesRowMetricConfigs(t);
  const getGroupSortValue = useCallback(
    (group: CategorySalesGroup, key: CategorySalesSortKey) => {
      if (key === "groupName") return group.groupName;
      if (key === "groupSummary") return group.summary.total;
      return group.rows[0]?.[key as keyof CategorySalesRow];
    },
    []
  );
  const { sort, sortedRows: sortedGroups, toggleSort } = useLocalTableSort(groups, getGroupSortValue);

  return (
    <div className="hidden min-w-0 md:block">
      <Table className="min-w-[1500px] text-[13px]">
        <TableHeader className="sticky top-0 z-20 bg-background/95 shadow-sm backdrop-blur">
          <TableRow>
            <SortableReportTableHead
              align="right"
              sort={sort}
              sortKey="rank"
              className="w-[70px] whitespace-nowrap bg-background/95 text-center"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.rank")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={sort}
              sortKey="groupName"
              className="min-w-[180px] whitespace-nowrap bg-background/95"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.group")}
            </SortableReportTableHead>
            <SortableReportTableHead
              sort={sort}
              sortKey="cateName"
              className="min-w-[180px] whitespace-nowrap bg-background/95"
              onSort={toggleSort}
            >
              {t("report.categorySales.columns.category")}
            </SortableReportTableHead>
            {metrics.map((metric) => (
              <SortableReportTableHead
                key={metric.key}
                align="right"
                sort={sort}
                sortKey={metric.field}
                className="min-w-[120px] whitespace-nowrap bg-background/95 text-right text-[12px]"
                onSort={toggleSort}
              >
                {metric.label}
              </SortableReportTableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedGroups.map((group) => (
            <Fragment key={group.groupUuid || group.groupName}>
              <TableRow className="bg-muted/40">
                <TableCell colSpan={3 + metrics.length} className="py-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-black">{group.groupName}</div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{t("report.categorySales.columns.category")}: {String(group.summary.categories_count ?? group.rows.length)}</span>
                      <span>{t("report.categorySales.columns.total")}: {displayMetric(group.summary.total, "money")}</span>
                    </div>
                  </div>
                </TableCell>
              </TableRow>
              {sortRowsLocally(group.rows, sort, (row, key) => row[key as keyof CategorySalesRow]).map((row, index) => (
                <TableRow key={`${row.groupUuid}-${row.cateUuid}-${row.rank}`} className={index % 2 === 1 ? "bg-muted/15" : undefined}>
                  <TableCell className="whitespace-nowrap text-center">
                    <Badge className="h-6 min-w-9 justify-center px-1.5 text-xs tabular-nums">#{row.rank}</Badge>
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{row.groupName}</TableCell>
                  <TableCell className="whitespace-nowrap font-bold">{row.cateName}</TableCell>
                  {metrics.map((metric) => (
                    <TableCell key={metric.key} className="whitespace-nowrap text-right tabular-nums">
                      {displayMetric(row[metric.field], metric.kind)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function CategorySalesMobileList({ groups }: { groups: CategorySalesGroup[] }) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {groups.map((group) => (
        <section key={group.groupUuid || group.groupName} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between gap-3 bg-muted/30 px-4 py-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-black">{group.groupName}</h3>
              <p className="text-xs text-muted-foreground">
                {t("report.categorySales.groupSummary", {
                  categories: group.summary.categories_count ?? group.rows.length,
                  qty: group.summary.qty_total ?? 0
                })}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-bold text-muted-foreground">{t("report.categorySales.columns.total")}</p>
              <p className="text-base font-black tabular-nums">{displayMetric(group.summary.total, "money")}</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {group.rows.map((row) => (
              <div key={`${row.groupUuid}-${row.cateUuid}-${row.rank}`} className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge className="h-6 min-w-9 shrink-0 justify-center px-1.5 text-xs tabular-nums">#{row.rank}</Badge>
                      <p className="truncate text-sm font-black">{row.cateName}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t("report.categorySales.columns.salePercent")}: {displayMetric(row.salePercent, "percent")}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[11px] font-bold text-muted-foreground">{t("report.categorySales.columns.total")}</p>
                    <p className="text-sm font-black tabular-nums">{displayMetric(row.total, "money")}</p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <MetricTile label={t("report.categorySales.columns.billCount")} value={row.billCount} kind="number" />
                  <MetricTile label={t("report.categorySales.columns.qtyTotal")} value={row.qtyTotal} kind="number" />
                  <MetricTile label={t("report.categorySales.columns.amount")} value={row.amount} kind="money" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function MetricTile({ kind, label, value }: { kind: "money" | "number"; label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-muted/20 px-2.5 py-2">
      <p className="truncate text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="truncate text-xs font-black tabular-nums text-foreground">{displayMetric(value, kind)}</p>
    </div>
  );
}

export function CategorySalesExportSurface({
  containerRef,
  dateRange,
  methodLabel,
  rows,
  rowsLabel,
  summary,
  title
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  methodLabel: string;
  rows: CategorySalesRow[];
  rowsLabel: string;
  summary: Record<string, unknown>;
  title: string;
}) {
  const { t } = useTranslation();
  const rowMetrics = categorySalesRowMetricConfigs(t);
  const summaryMetrics = categorySalesSummaryMetricConfigs(t);

  return (
    <div ref={containerRef} className="report-print-surface">
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
      <div className="report-print-section">
        <h2>{t("report.summary")}</h2>
        <table className="report-print-table">
          <tbody>
            {summaryMetrics.map((metric) => (
              <tr key={metric.key}>
                <td>{metric.label}</td>
                <td className="is-right">{displayMetric(summary[metric.key], metric.kind)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.categorySales.columns.rank")}</th>
            <th>{t("report.categorySales.columns.group")}</th>
            <th>{t("report.categorySales.columns.category")}</th>
            {rowMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.groupUuid}-${row.cateUuid}-${row.rank}`}>
              <td className="is-center">{row.rank}</td>
              <td>{row.groupName}</td>
              <td>{row.cateName}</td>
              {rowMetrics.map((metric) => (
                <td key={metric.key} className="is-right">
                  {displayMetric(row[metric.field], metric.kind)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
