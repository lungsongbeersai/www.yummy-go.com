"use client";

import { Fragment, useCallback, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { ReportFilterSheet } from "../shared/report-filter-shell";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PaymentMethodReportFilter } from "@/config/report-filters";
import type { CategorySalesReportOrder } from "@/services/report";
import type {
  CategorySalesGroup,
  CategorySalesRow,
} from "@/stores/report-store";
import { SortableReportTableHead } from "../report-sort-table-head";
import {
  ReportBranchField,
  ReportDateRangeFields,
  ReportPageLimitField,
  ReportPaymentMethodField,
  ReportSelectField,
} from "../shared/report-filter-fields";
import { ReportSummaryCardsGrid, type ReportSummaryCard } from "../shared/report-metric-display";
import {
  ReportIndeterminateCheckbox,
  selectionStateForVisibleIds,
} from "../shared/report-row-selection";
import {
  reportOrderOptions,
  sortRowsLocally,
  useLocalTableSort,
} from "../shared/report-sort-utils";
import type {
  CategorySalesOption,
  CategorySalesReportFilters,
} from "./category-sales-report-types";
import {
  categorySalesRowMetricConfigs,
  categorySalesRowId,
  categorySalesSummaryMetricConfigs,
  displayMetric,
} from "./category-sales-report-utils";
import { metricNumber } from "../shared/report-metrics";

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
  methodOptions: Array<{ label: string; value: PaymentMethodReportFilter }>;
  onApply: () => void;
  onDraftChange: (filters: CategorySalesReportFilters) => void;
};

export function CategorySalesSummaryCards({
  summary,
}: {
  summary: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const cards: ReportSummaryCard[] = categorySalesSummaryMetricConfigs(t).map((metric) => ({
    key: metric.key,
    kind: metric.kind,
    label: metric.label,
    value: summary[metric.key],
  }));

  return (
    <ReportSummaryCardsGrid
      cards={cards}
      gridClassName="sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5"
      cardClassName={() => "border-border bg-card"}
      labelClassName={() => "text-muted-foreground"}
      valueClassName={() => "font-black text-foreground"}
    />
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
    <ReportFilterSheet
      canApply={canApply}
      description={t("report.categorySales.title")}
      gridClassName="lg:grid-cols-3"
      loading={loading}
      open={open}
      onApply={onApply}
      onOpenChange={onOpenChange}
    >
      <CategorySalesFilterFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        draftFilters={draftFilters}
        idPrefix="category-sales-mobile"
        methodOptions={methodOptions}
        onDraftChange={onDraftChange}
      />
    </ReportFilterSheet>
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
  methodOptions: Array<{ label: string; value: PaymentMethodReportFilter }>;
  onDraftChange: (filters: CategorySalesReportFilters) => void;
}) {
  const { t } = useTranslation();
  const orderOptions = reportOrderOptions(t);

  function patch(patch: Partial<CategorySalesReportFilters>) {
    onDraftChange({ ...draftFilters, ...patch });
  }

  return (
    <>
      <ReportBranchField
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        id={`${idPrefix}-branch`}
        options={branchOptions}
        value={draftFilters.branchUuid}
        onValueChange={(value) => patch({ branchUuid: value })}
      />

      <ReportDateRangeFields
        dateFrom={draftFilters.dateFrom}
        dateTo={draftFilters.dateTo}
        idPrefix={idPrefix}
        onDateFromChange={(value) => patch({ dateFrom: value })}
        onDateToChange={(value) => patch({ dateTo: value })}
      />

      <ReportPaymentMethodField
        id={`${idPrefix}-payment-method`}
        options={methodOptions}
        value={draftFilters.paymentMethod}
        onValueChange={(value) => patch({ paymentMethod: value })}
      />

      <ReportPageLimitField
        id={`${idPrefix}-limit`}
        value={draftFilters.limit}
        onValueChange={(value) => patch({ limit: value })}
      />

      <ReportSelectField
        id={`${idPrefix}-order-by`}
        label={t("report.filters.orderBy")}
        options={orderOptions}
        value={draftFilters.orderBy}
        onValueChange={(value) => patch({ orderBy: value as CategorySalesReportOrder })}
      />
    </>
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
                  <TableCell colSpan={9} className="py-3">
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

                  <div className="mt-3 grid grid-cols-2 gap-2">
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
