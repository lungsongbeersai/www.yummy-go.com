"use client";

import { type ReactNode, type RefObject, useCallback } from "react";
import {
  ChevronDown,
  CreditCard,
  Download,
  FileSpreadsheet,
  Printer,
  RefreshCcw,
  SlidersHorizontal,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { DateFilterButton } from "@/components/common/date-filter-button";
import { EmptyState } from "@/components/common/empty-state";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { PAGE_LIMIT_OPTIONS, isAllPageLimit } from "@/lib/pagination";
import type { PaymentMethodReportFilter } from "@/config/report-filters";
import type {
  PaymentMethodOption,
  PaymentMethodReportRow,
  PaymentMethodSummaryCard,
} from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../report-row-selection";
import { useLocalTableSort } from "../report-sort-utils";
import type {
  PaymentMethodsExportAction,
  PaymentMethodsReportFilters,
  PaymentMethodsRowMetricConfig,
} from "./payment-methods-report-types";
import {
  displayMetric,
  paymentMethodReportRowId,
  paymentMethodRowMetricConfigs,
  paymentMethodTotalMetricConfigs,
} from "./payment-methods-report-utils";

type FilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: Array<{ label: string; value: string }>;
  canApply: boolean;
  draftFilters: PaymentMethodsReportFilters;
  loading: boolean;
  methodOptions: PaymentMethodOption[];
  onApply: () => void;
  onDraftChange: (filters: PaymentMethodsReportFilters) => void;
};

export function PaymentMethodsSummaryCards({
  cards,
  reportTotal,
}: {
  cards: PaymentMethodSummaryCard[];
  reportTotal: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const visibleCards = cards.length
    ? cards
    : paymentMethodTotalMetricConfigs(t)
        .filter((metric) => isPresent(reportTotal[metric.key]))
        .map((metric, index) => ({
          key: metric.key,
          label: metric.label,
          sortOrder: index + 1,
          value: Number(reportTotal[metric.key] ?? 0),
          valueType: metric.kind,
        }));

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {visibleCards.map((card) => (
        <Card
          key={card.key}
          className={cn(
            "overflow-hidden border-border bg-card shadow-sm",
            (card.key === "grand_total" || card.key === "payment_total") &&
              "border-primary/30 bg-primary/5",
            card.key.includes("discount") && card.value > 0 && "border-destructive/25 bg-destructive/5"
          )}
        >
          <CardContent className="p-4">
            <p className="truncate text-xs font-black uppercase text-muted-foreground">
              {card.label}
            </p>
            <p className={cn("mt-2 truncate text-xl tabular-nums", financialTextClass(card.key, card.value, true))}>
              {displayMetric(card.value, card.valueType)}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}

export function PaymentMethodsFilterBar({
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
      <CardContent className="p-3 sm:p-4">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
          <PaymentMethodsFilterFields
            branchLoading={branchLoading}
            branchLocked={branchLocked}
            branchOptions={branchOptions}
            draftFilters={draftFilters}
            idPrefix="payment-methods"
            methodOptions={methodOptions}
            onDraftChange={onDraftChange}
          />
          <div className="flex items-end sm:col-span-2 lg:col-span-12 xl:col-span-2">
            <Button
              type="button"
              className="h-9 w-full min-w-28"
              disabled={loading || !canApply}
              onClick={onApply}
            >
              {loading ? (
                <RefreshCcw className="animate-spin" data-icon="inline-start" />
              ) : null}
              {t("report.apply")}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function PaymentMethodsFilterSheet({
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
      <DialogContent className="!flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
        <DialogHeader className="shrink-0 border-b border-border bg-muted/20 px-4 py-3 pr-12 text-left sm:px-5">
          <DialogTitle className="text-base font-black text-foreground">
            {t("report.filters.currentFilters")}
          </DialogTitle>
          <DialogDescription>
            {t("report.paymentMethodsReport.title")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[calc(100dvh-12rem)] overflow-y-auto overscroll-contain p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <PaymentMethodsFilterFields
              branchLoading={branchLoading}
              branchLocked={branchLocked}
              branchOptions={branchOptions}
              draftFilters={draftFilters}
              idPrefix="payment-methods-mobile"
              methodOptions={methodOptions}
              onDraftChange={onDraftChange}
            />
          </div>
        </div>
        <DialogFooter className="grid shrink-0 grid-cols-2 gap-2 border-t border-border bg-card/95 px-4 py-3 backdrop-blur sm:flex sm:px-5">
          <DialogClose asChild>
            <Button type="button" variant="outline" className="h-10 sm:min-w-24">
              {t("actions.close")}
            </Button>
          </DialogClose>
          <Button
            type="button"
            className="h-10 sm:min-w-24"
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

export function MobilePaymentMethodsFilterSummary({
  branchLabel,
  filters,
  methodLabel,
  onOpen,
}: {
  branchLabel: string;
  filters: PaymentMethodsReportFilters;
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

function PaymentMethodsFilterFields({
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
  branchOptions: Array<{ label: string; value: string }>;
  draftFilters: PaymentMethodsReportFilters;
  idPrefix: string;
  methodOptions: PaymentMethodOption[];
  onDraftChange: (filters: PaymentMethodsReportFilters) => void;
}) {
  const { t } = useTranslation();

  function patch(patch: Partial<PaymentMethodsReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      <Field className="min-w-0 gap-1.5 sm:col-span-2 lg:col-span-4">
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
          <SelectTrigger id={`${idPrefix}-branch`} className="h-10 w-full rounded-md">
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
      <Field className="min-w-0 gap-1.5 lg:col-span-4">
        <FieldLabel
          htmlFor={`${idPrefix}-date-from`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateFrom")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-from`}
          name={`${idPrefix}-date-from`}
          type="date"
          value={draftFilters.dateFrom}
          autoComplete="off"
          className="h-10 rounded-md text-sm"
          onChange={(event) => patch({ dateFrom: event.target.value })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5 lg:col-span-4">
        <FieldLabel
          htmlFor={`${idPrefix}-date-to`}
          className="text-xs font-bold text-muted-foreground"
        >
          {t("report.filters.dateTo")}
        </FieldLabel>
        <Input
          id={`${idPrefix}-date-to`}
          name={`${idPrefix}-date-to`}
          type="date"
          value={draftFilters.dateTo}
          autoComplete="off"
          className="h-10 rounded-md text-sm"
          onChange={(event) => patch({ dateTo: event.target.value })}
        />
      </Field>
      <Field className="min-w-0 gap-1.5 lg:col-span-4">
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
          <SelectTrigger id={`${idPrefix}-payment-method`} className="h-10 w-full rounded-md">
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
      <Field className="min-w-0 gap-1.5 lg:col-span-6">
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
          <SelectTrigger id={`${idPrefix}-limit`} className="h-10 w-full rounded-md">
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
    </>
  );
}

type TableCardProps = {
  children: ReactNode;
  exportDisabled: boolean;
  exporting: PaymentMethodsExportAction | null;
  footer: ReactNode;
  loading: boolean;
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

export function PaymentMethodsTableCard({
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
    <Card className="min-w-0 overflow-hidden border-border bg-card shadow-sm">
      <CardHeader className="shrink-0 border-b border-border bg-card/95 px-2 py-2 sm:px-3">
        <div className="grid w-full min-w-0 grid-cols-1 items-center gap-2 2xl:grid-cols-[minmax(180px,16rem)_minmax(0,1fr)_auto]">
          <div className="flex min-w-0 items-center gap-2">
            <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
              <CreditCard aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="truncate text-sm font-black">
                {title}
              </CardTitle>
              {rowsLength ? (
                <p className="mt-0.5 truncate text-xs font-semibold text-muted-foreground">
                  {t("report.paymentMethodsReport.rowsLabel", {
                    count: rowsLength,
                  })}
                </p>
              ) : null}
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
            </div>
            {loading && rowsLength ? (
              <Badge className="h-7 w-fit border-border bg-muted px-2 text-xs text-muted-foreground">
                <RefreshCcw className="animate-spin" data-icon="inline-start" />
                {t("common.loading")}
              </Badge>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5 2xl:col-start-3 2xl:flex-nowrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label={t("common.export")}
                  className="h-9 min-w-9 rounded-md px-2.5"
                  disabled={exportDisabled}
                >
                  {exporting === "excel" || exporting === "pdf" ? (
                    <RefreshCcw className="animate-spin" data-icon="inline-start" />
                  ) : (
                    <Download data-icon="inline-start" />
                  )}
                  <span className="hidden sm:inline">{t("common.export")}</span>
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
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label={t("report.print")}
              className="h-9 min-w-9 rounded-md px-2.5"
              disabled={printDisabled}
              onClick={onPrintReport}
            >
              {exporting === "print" ? (
                <RefreshCcw className="animate-spin" data-icon="inline-start" />
              ) : (
                <Printer data-icon="inline-start" />
              )}
              <span className="hidden sm:inline">{t("report.print")}</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={t("actions.refresh")}
              className="h-9 min-w-9 rounded-md border border-border/60 px-2.5 text-muted-foreground hover:text-foreground"
              disabled={loading || Boolean(exporting)}
              onClick={onRefresh}
            >
              <RefreshCcw
                className={loading ? "animate-spin" : undefined}
                data-icon="inline-start"
              />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading && !rowsLength ? (
          <div className="p-4 md:min-h-80">
            <PaymentMethodsLoadingSkeleton />
          </div>
        ) : rowsLength ? (
          <>
            <div className="min-w-0 overflow-x-auto overscroll-x-contain">
              {children}
            </div>
            <div className="shrink-0 bg-card">{footer}</div>
          </>
        ) : (
          <div className="p-4 md:min-h-80">
            <EmptyState
              title={t("report.paymentMethodsReport.noData")}
              description={t("report.paymentMethodsReport.adjustFilters")}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

type PaymentMethodTableField = {
  field: keyof PaymentMethodReportRow;
  minWidth: string;
  summaryKey: string;
};

const PAYMENT_METHOD_TABLE_FIELDS = [
  { field: "billCount", minWidth: "min-w-[84px]", summaryKey: "bill_count" },
  {
    field: "productPriceTotal",
    minWidth: "min-w-[132px]",
    summaryKey: "product_price_total",
  },
  {
    field: "toppingTotal",
    minWidth: "min-w-[116px]",
    summaryKey: "topping_total",
  },
  { field: "total", minWidth: "min-w-[132px]", summaryKey: "total" },
  {
    field: "discountItemAmount",
    minWidth: "min-w-[124px]",
    summaryKey: "discount_item_amount",
  },
  {
    field: "discountBill",
    minWidth: "min-w-[124px]",
    summaryKey: "discount_bill",
  },
  {
    field: "serviceCharge",
    minWidth: "min-w-[124px]",
    summaryKey: "sum_servicecharge",
  },
  { field: "vat", minWidth: "min-w-[104px]", summaryKey: "sum_vate" },
  {
    field: "grandTotal",
    minWidth: "min-w-[132px]",
    summaryKey: "grand_total",
  },
  {
    field: "paymentAmount",
    minWidth: "min-w-[142px]",
    summaryKey: "payment_total",
  },
] as const satisfies readonly PaymentMethodTableField[];

type PaymentMetricByField = Partial<
  Record<keyof PaymentMethodReportRow, PaymentMethodsRowMetricConfig>
>;

export function PaymentMethodsTable({
  reportTotal,
  rows,
  selectedRowIds,
  onToggleRow,
  onToggleRows,
}: {
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  selectedRowIds: Set<string>;
  onToggleRow: (row: PaymentMethodReportRow, selected: boolean) => void;
  onToggleRows: (rows: PaymentMethodReportRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const metricByField = Object.fromEntries(
    paymentMethodRowMetricConfigs(t).map((metric) => [metric.field, metric]),
  ) as PaymentMetricByField;
  const totalPaymentAmount = paymentTotalAmount(reportTotal, rows);
  const getSortValue = useCallback(
    (row: PaymentMethodReportRow, key: keyof PaymentMethodReportRow) =>
      row[key],
    [],
  );
  const { sort, sortedRows, toggleSort } = useLocalTableSort(
    rows,
    getSortValue,
  );
  const visibleIds = sortedRows.map(paymentMethodReportRowId);
  const { allVisibleSelected, someVisibleSelected } =
    selectionStateForVisibleIds(visibleIds, selectedRowIds);

  return (
    <div className="hidden min-w-0 md:block">
      <Table className="w-max min-w-full table-auto text-[13px]">
        <TableHeader className="[&_th]:sticky [&_th]:top-0 [&_th]:z-20 [&_th]:h-9 [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:bg-muted/70 [&_th]:px-2 [&_th]:shadow-sm [&_th]:backdrop-blur">
          <TableRow>
            <TableHead className="w-10 text-center">
              <ReportIndeterminateCheckbox
                aria-label={t("common.selectAll")}
                checked={allVisibleSelected}
                indeterminate={!allVisibleSelected && someVisibleSelected}
                onChange={(event) =>
                  onToggleRows(sortedRows, event.target.checked)
                }
              />
            </TableHead>
            <SortableReportTableHead
              sort={sort}
              sortKey="paymentMethodName"
              className="min-w-[220px]"
              onSort={toggleSort}
            >
              {t("report.paymentMethodsReport.columns.paymentMethod")}
            </SortableReportTableHead>

            {PAYMENT_METHOD_TABLE_FIELDS.map(({ field, minWidth }) => {
              const metric = metricByField[field];
              return (
                <SortableReportTableHead
                  key={field}
                  align="right"
                  sort={sort}
                  sortKey={field}
                  className={cn(minWidth, "text-right text-[12px]")}
                  onSort={toggleSort}
                >
                  {metric?.label ?? field}
                </SortableReportTableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row, index) => (
            <TableRow
              key={`${row.paymentMethodCode}-${row.sortOrder}`}
              className={cn(
                "bg-card hover:bg-muted/25 [&>td]:px-2 [&>td]:py-2.5",
                index % 2 === 1 && "bg-muted/10",
                selectedRowIds.has(paymentMethodReportRowId(row)) &&
                  "bg-primary/5 hover:bg-primary/10",
              )}
            >
              <TableCell className="w-10 text-center">
                <Checkbox
                  aria-label={t("common.selectRow", {
                    name: row.paymentMethodName,
                  })}
                  checked={selectedRowIds.has(paymentMethodReportRowId(row))}
                  onChange={(event) => onToggleRow(row, event.target.checked)}
                />
              </TableCell>
              <TableCell className="whitespace-nowrap">
                <PaymentMethodNameCell
                  row={row}
                  totalPaymentAmount={totalPaymentAmount}
                />
              </TableCell>

              {PAYMENT_METHOD_TABLE_FIELDS.map(({ field }) => {
                const metric = metricByField[field];
                return (
                  <TableCell
                    key={field}
                    className={cn(
                      "whitespace-nowrap text-right tabular-nums",
                      metricValueClass(field, row[field]),
                    )}
                  >
                    {metric
                      ? displayMetric(row[field], metric.kind)
                      : String(row[field] ?? "-")}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}

          <PaymentMethodsSummaryRow
            metricByField={metricByField}
            reportTotal={reportTotal}
            rows={rows}
          />
        </TableBody>
      </Table>
    </div>
  );
}

export function PaymentMethodsMobileList({
  reportTotal,
  rows,
  selectedRowIds,
  onToggleRow,
}: {
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  selectedRowIds: Set<string>;
  onToggleRow: (row: PaymentMethodReportRow, selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const metricByField = Object.fromEntries(
    paymentMethodRowMetricConfigs(t).map((metric) => [metric.field, metric]),
  ) as PaymentMetricByField;
  const totalPaymentAmount = paymentTotalAmount(reportTotal, rows);
  const detailFields = PAYMENT_METHOD_TABLE_FIELDS.filter(
    ({ field }) => field !== "billCount" && field !== "paymentAmount",
  );

  return (
    <div className="flex flex-col gap-3 p-3 md:hidden">
      {rows.map((row) => (
        <section
          key={`${row.paymentMethodCode}-${row.sortOrder}`}
          className={cn(
            "overflow-hidden rounded-md border border-border bg-card shadow-sm",
            selectedRowIds.has(paymentMethodReportRowId(row)) &&
              "border-primary/30 bg-primary/5",
          )}
        >
          <div className="flex items-start justify-between gap-3 border-b border-border bg-muted/20 px-3 py-3">
            <div className="flex min-w-0 items-start gap-3">
              <Checkbox
                aria-label={t("common.selectRow", {
                  name: row.paymentMethodName,
                })}
                className="mt-1"
                checked={selectedRowIds.has(paymentMethodReportRowId(row))}
                onChange={(event) => onToggleRow(row, event.target.checked)}
              />
              <PaymentMethodNameCell
                row={row}
                totalPaymentAmount={totalPaymentAmount}
              />
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[11px] font-bold text-muted-foreground">
                {t("report.paymentMethodsReport.columns.paymentAmount")}
              </p>
              <p
                className={cn(
                  "text-base tabular-nums",
                  metricValueClass("paymentAmount", row.paymentAmount),
                )}
              >
                {displayMetric(row.paymentAmount, "money")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
            <div className="px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("report.paymentMethodsReport.columns.billsCount")}
              </p>
              <p className="text-sm font-black tabular-nums">
                {row.billCount}
              </p>
            </div>
            <div className="px-3 py-2 text-center">
              <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {t("report.paymentMethodsReport.columns.total")}
              </p>
              <p
                className={cn(
                  "text-sm tabular-nums",
                  metricValueClass("total", row.total),
                )}
              >
                {displayMetric(row.total, "money")}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5 bg-muted/10 p-3">
            {detailFields.map(({ field }) => {
              const metric = metricByField[field];
              return (
                <div
                  key={field}
                  className="min-w-0 rounded-md border border-border bg-background/70 px-2.5 py-1.5"
                >
                  <p className="truncate text-[10px] font-bold text-muted-foreground">
                    {metric?.label ?? field}
                  </p>
                  <p
                    className={cn(
                      "truncate text-xs tabular-nums",
                      metricValueClass(field, row[field]),
                    )}
                  >
                    {metric
                      ? displayMetric(row[field], metric.kind)
                      : String(row[field] ?? "-")}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <PaymentMethodsMobileSummary
        metricByField={metricByField}
        reportTotal={reportTotal}
        rows={rows}
      />
    </div>
  );
}

function PaymentMethodNameCell({
  row,
  totalPaymentAmount,
}: {
  row: PaymentMethodReportRow;
  totalPaymentAmount: number;
}) {
  const share = paymentShare(row.paymentAmount, totalPaymentAmount);

  return (
    <div className="min-w-0">
      <div className="flex items-center gap-2">
        <div className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
          <CreditCard className="size-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate font-black">{row.paymentMethodName}</p>
          <p className="text-[11px] font-semibold text-muted-foreground">
            {row.paymentMethodCode}
          </p>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 min-w-16 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${share}%` }}
          />
        </div>
        <span className="text-[11px] font-bold tabular-nums text-muted-foreground">
          {share.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

function PaymentMethodsSummaryRow({
  metricByField,
  reportTotal,
  rows,
}: {
  metricByField: PaymentMetricByField;
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
}) {
  const { t } = useTranslation();

  return (
    <TableRow className="sticky bottom-0 z-20 border-t border-primary/25 bg-primary/10 hover:bg-primary/10 [&>td]:px-2 [&>td]:py-2.5">
      <TableCell />
      <TableCell className="whitespace-nowrap">
        <div className="flex min-w-48 items-center gap-2">
          <span className="inline-flex h-6 items-center rounded-full bg-background/80 px-2 text-xs font-black uppercase text-primary ring-1 ring-primary/20">
            {t("report.paymentMethodsReport.totalSummary")}
          </span>
          <span className="text-xs font-semibold text-muted-foreground">
            {t("report.paymentMethodsReport.rowsLabel", { count: rows.length })}
          </span>
        </div>
      </TableCell>

      {PAYMENT_METHOD_TABLE_FIELDS.map(({ field, summaryKey }) => {
        const metric = metricByField[field];
        const value = summaryValue(reportTotal, rows, field, summaryKey);
        return (
          <TableCell
            key={field}
            className={cn(
              "whitespace-nowrap text-right tabular-nums",
              metricValueClass(field, value),
            )}
          >
            {metric ? displayMetric(value, metric.kind) : String(value)}
          </TableCell>
        );
      })}
    </TableRow>
  );
}

function PaymentMethodsMobileSummary({
  metricByField,
  reportTotal,
  rows,
}: {
  metricByField: PaymentMetricByField;
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
}) {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden rounded-md border border-primary/20 bg-primary/5 shadow-sm">
      <div className="flex items-center justify-between gap-2 border-b border-primary/15 px-3 py-2.5">
        <p className="text-sm font-black text-primary">
          {t("report.paymentMethodsReport.totalSummary")}
        </p>
        <Badge className="border-primary/20 bg-background/80 text-primary">
          {t("report.paymentMethodsReport.rowsLabel", { count: rows.length })}
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-3">
        {PAYMENT_METHOD_TABLE_FIELDS.map(({ field, summaryKey }) => {
          const metric = metricByField[field];
          const value = summaryValue(reportTotal, rows, field, summaryKey);
          return (
            <div
              key={field}
              className="min-w-0 rounded-md border border-border bg-background/80 px-2.5 py-1.5"
            >
              <p className="truncate text-[10px] font-bold text-muted-foreground">
                {metric?.label ?? field}
              </p>
              <p
                className={cn(
                  "truncate text-xs tabular-nums",
                  metricValueClass(field, value),
                )}
              >
                {metric ? displayMetric(value, metric.kind) : String(value)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PaymentMethodsLoadingSkeleton() {
  return (
    <section aria-busy="true" className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-4 shadow-sm">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-3 h-7 w-32" />
          </div>
        ))}
      </div>
      <div className="hidden overflow-hidden rounded-md border border-border md:block">
        <div className="grid min-w-[1180px] grid-cols-[12rem_repeat(13,minmax(7rem,1fr))] gap-3 border-b border-border bg-muted/30 px-3 py-3">
          {Array.from({ length: 14 }).map((_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid min-w-[1180px] grid-cols-[12rem_repeat(13,minmax(7rem,1fr))] gap-3 border-b border-border/70 px-3 py-3 last:border-b-0">
            {Array.from({ length: 14 }).map((__, cellIndex) => (
              <Skeleton key={cellIndex} className="h-5" />
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border bg-card p-3 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-20" />
              </div>
              <Skeleton className="h-7 w-24" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

function metricNumber(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

function summaryValue(
  reportTotal: Record<string, unknown>,
  rows: PaymentMethodReportRow[],
  field: keyof PaymentMethodReportRow,
  summaryKey: string,
) {
  const backendValue = reportTotal[summaryKey];
  if (isPresent(backendValue)) return metricNumber(backendValue);

  return rows.reduce((total, row) => total + metricNumber(row[field]), 0);
}

function paymentTotalAmount(
  reportTotal: Record<string, unknown>,
  rows: PaymentMethodReportRow[],
) {
  const paymentTotal = metricNumber(reportTotal.payment_total);
  if (paymentTotal > 0) return paymentTotal;

  const grandTotal = metricNumber(reportTotal.grand_total);
  if (grandTotal > 0) return grandTotal;

  return rows.reduce((total, row) => total + row.paymentAmount, 0);
}

function paymentShare(value: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (value / total) * 100));
}

function financialTextClass(key: string, value: unknown, strong = false) {
  const number = metricNumber(value);
  const isDiscount = key.includes("discount");
  const isTotal = key === "total" || key.includes("total") || key.includes("amount");

  return cn(
    (strong || isTotal || (isDiscount && number > 0)) && "font-black",
    number === 0 && "text-muted-foreground",
    isDiscount && number > 0 && "text-destructive",
    !isDiscount && number > 0 && "text-foreground"
  );
}

function metricValueClass(field: keyof PaymentMethodReportRow, value: unknown) {
  const number = metricNumber(value);
  const isDiscount =
    field === "discountBill" || field === "discountItemAmount";
  const isTotal =
    field === "grandTotal" || field === "paymentAmount" || field === "total";

  return cn(
    "font-semibold",
    field === "billCount" && "font-black text-foreground",
    field === "paymentAmount" && number > 0 && "font-black text-primary",
    field === "grandTotal" && number > 0 && "font-black text-foreground",
    field === "total" && number > 0 && "font-black text-foreground",
    isDiscount && number > 0 && "font-black text-destructive",
    field === "serviceCharge" &&
      number > 0 &&
      "font-black text-sky-700 dark:text-sky-300",
    field === "vat" &&
      number > 0 &&
      "font-black text-amber-700 dark:text-amber-300",
    !isTotal &&
      !isDiscount &&
      field !== "serviceCharge" &&
      field !== "vat" &&
      number > 0 &&
      "text-foreground",
    number === 0 && "text-muted-foreground",
  );
}

export function PaymentMethodsExportSurface({
  cards,
  containerRef,
  dateRange,
  methodLabel,
  reportTotal,
  rows,
  rowsLabel,
  title,
}: {
  cards: PaymentMethodSummaryCard[];
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  methodLabel: string;
  reportTotal: Record<string, unknown>;
  rows: PaymentMethodReportRow[];
  rowsLabel: string;
  title: string;
}) {
  const { t } = useTranslation();
  const rowMetrics = paymentMethodRowMetricConfigs(t);
  const totalMetrics = paymentMethodTotalMetricConfigs(t);

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
      <div className="report-print-cards">
        {cards.map((card) => (
          <div key={card.key} className="report-print-card">
            <p>{card.label}</p>
            <strong>{displayMetric(card.value, card.valueType)}</strong>
          </div>
        ))}
      </div>
      <div className="report-print-section">
        <h2>{t("report.paymentMethodsReport.totalSummary")}</h2>
        <table className="report-print-table">
          <tbody>
            {totalMetrics.map((metric) => (
              <tr key={metric.key}>
                <td>{metric.label}</td>
                <td className="is-right">
                  {displayMetric(reportTotal[metric.key], metric.kind)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.paymentMethodsReport.columns.paymentMethod")}</th>
            <th>
              {t("report.paymentMethodsReport.columns.paymentMethodCode")}
            </th>
            {rowMetrics.map((metric) => (
              <th key={metric.key} className="is-right">
                {metric.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.paymentMethodCode}-${row.sortOrder}`}>
              <td>{row.paymentMethodName}</td>
              <td>{row.paymentMethodCode}</td>
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
