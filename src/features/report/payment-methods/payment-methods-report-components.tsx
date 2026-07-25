"use client";

import { useCallback, type RefObject } from "react";
import { CreditCard } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { ReportFilterSheet } from "../shared/report-filter-shell";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import type {
  PaymentMethodOption,
  PaymentMethodReportRow,
  PaymentMethodSummaryCard,
} from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  ReportBaseFilterFields,
  ReportPaymentMethodField,
} from "../shared/report-filter-fields";
import { ReportSummaryCardsGrid, type ReportSummaryCard } from "../shared/report-metric-display";
import { metricNumber } from "../shared/report-metrics";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../shared/report-row-selection";
import { useLocalTableSort } from "../shared/report-sort-utils";
import type {
  PaymentMethodsReportFilters,
  PaymentMethodsRowMetricConfig,
} from "./payment-methods-report-types";
import {
  displayMetric,
  paymentMethodExportMetricConfigs,
  paymentMethodExportTotals,
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
  const visibleCards: ReportSummaryCard[] = cards.length
    ? cards.map((card) => ({ key: card.key, kind: card.valueType, label: card.label, value: card.value }))
    : paymentMethodTotalMetricConfigs(t)
        .filter((metric) => isPresent(reportTotal[metric.key]))
        .map((metric) => ({
          key: metric.key,
          kind: metric.kind,
          label: metric.label,
          value: Number(reportTotal[metric.key] ?? 0),
        }));

  return (
    <ReportSummaryCardsGrid
      cards={visibleCards}
      gridClassName="sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5"
      cardClassName={(card) =>
        cn(
          "border-border bg-card",
          (card.key === "grand_total" || card.key === "payment_total") && "border-primary/30 bg-primary/5",
          card.key.includes("discount") && metricNumber(card.value) > 0 && "border-destructive/25 bg-destructive/5"
        )
      }
      labelClassName={() => "text-muted-foreground"}
      valueClassName={(card) => financialTextClass(card.key, card.value, true)}
    />
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
    <ReportFilterSheet
      canApply={canApply}
      description={t("report.paymentMethodsReport.title")}
      gridClassName="grid-cols-1 sm:grid-cols-2 lg:grid-cols-12"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <PaymentMethodsFilterFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        draftFilters={draftFilters}
        idPrefix="payment-methods-mobile"
        methodOptions={methodOptions}
        onDraftChange={onDraftChange}
      />
    </ReportFilterSheet>
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
  function patch(patch: Partial<PaymentMethodsReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <ReportBaseFilterFields
      branchLoading={branchLoading}
      branchLocked={branchLocked}
      branchOptions={branchOptions}
      branchUuid={draftFilters.branchUuid}
      dateFrom={draftFilters.dateFrom}
      dateTo={draftFilters.dateTo}
      idPrefix={idPrefix}
      limit={draftFilters.limit}
      onBranchChange={(value) => patch({ branchUuid: value })}
      onDateFromChange={(value) => patch({ dateFrom: value })}
      onDateToChange={(value) => patch({ dateTo: value })}
      onLimitChange={(value) => patch({ limit: value })}
    >
      <ReportPaymentMethodField
        fieldClassName="min-w-0 gap-1.5 lg:col-span-4"
        id={`${idPrefix}-payment-method`}
        options={methodOptions}
        triggerClassName="h-10 w-full rounded-md"
        value={draftFilters.paymentMethod}
        onValueChange={(value) => patch({ paymentMethod: value })}
      />
    </ReportBaseFilterFields>
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
    ({ field }) => field !== "billCount" && field !== "grandTotal",
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
                {t("report.paymentMethodsReport.columns.grandTotal")}
              </p>
              <p
                className={cn(
                  "text-base tabular-nums",
                  metricValueClass("grandTotal", row.grandTotal),
                )}
              >
                {displayMetric(row.grandTotal, "money")}
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

export function PaymentMethodsLoadingSkeleton() {
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
        <div className="grid min-w-[1180px] grid-cols-[12rem_repeat(10,minmax(7rem,1fr))] gap-3 border-b border-border bg-muted/30 px-3 py-3">
          {Array.from({ length: 11 }).map((_, index) => (
            <Skeleton key={index} className="h-4" />
          ))}
        </div>
        {Array.from({ length: 7 }).map((_, rowIndex) => (
          <div key={rowIndex} className="grid min-w-[1180px] grid-cols-[12rem_repeat(10,minmax(7rem,1fr))] gap-3 border-b border-border/70 px-3 py-3 last:border-b-0">
            {Array.from({ length: 11 }).map((__, cellIndex) => (
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
  containerRef,
  dateRange,
  methodLabel,
  rows,
  title,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  dateRange: string;
  methodLabel: string;
  rows: PaymentMethodReportRow[];
  title: string;
}) {
  const { t } = useTranslation();
  const rowMetrics = paymentMethodExportMetricConfigs(t);
  const totals = paymentMethodExportTotals(rows, rowMetrics);

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
        </div>
      </div>
      <table className="report-print-table">
        <thead>
          <tr>
            <th>{t("report.paymentMethodsReport.columns.paymentMethod")}</th>
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
              {rowMetrics.map((metric) => (
                <td key={metric.key} className="is-right">
                  {displayMetric(row[metric.field], metric.kind)}
                </td>
              ))}
            </tr>
          ))}
          {/* แถวรวมท้ายตารางแบบเดียวกับ footer ของตารางบนหน้าจอ แทน section สรุปแยก */}
          <tr className="is-bill">
            <td>{t("report.paymentMethodsReport.totalSummary")}</td>
            {rowMetrics.map((metric, index) => (
              <td key={metric.key} className="is-right">
                {displayMetric(totals[index], metric.kind)}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
      <ReportSignatures />
    </div>
  );
}
