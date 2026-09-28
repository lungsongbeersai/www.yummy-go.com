"use client";

import { Fragment, useCallback, useMemo, type ReactNode, type RefObject } from "react";
import {
  BadgePercent,
  Calculator,
  HandPlatter,
  Landmark,
  Package,
  Tag,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ReportOfficialHeader,
  ReportSignatures,
} from "@/lib/export/official-layout";
import { ReportFilterCard, ReportFilterSheet } from "../shared/report-filter-shell";
import { ReportLocationFields } from "../shared/report-location-fields";
import type { ReportLocationOptions } from "../shared/report-location";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemFooter,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Progress } from "@/components/ui/progress";
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
import type { ReportColumnOption } from "../shared/report-column-visibility";
import { ReportStatCards, type ReportStat, type ReportStatTone } from "../shared/report-stat-cards";
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

type FilterProps = {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: CategorySalesOption[];
  canApply: boolean;
  draftFilters: CategorySalesReportFilters;
  loading: boolean;
  locationOptions: ReportLocationOptions & { loading: boolean };
  methodOptions: Array<{ label: string; value: PaymentMethodReportFilter }>;
  onApply: () => void;
  onDraftChange: (filters: CategorySalesReportFilters) => void;
};

// ชนิดของตัวเลขต่อการ์ด (ความหมายของสีดูใน report-stat-cards.tsx) — ยอดสุทธิเป็นใบ highlight อยู่หน้าสุด
// 12 ใบพอดี 3 แถว (4 คอลัมน์) จึงไม่ขยายใบ highlight เป็น 2 ช่อง
const SUMMARY_PRESENTATION: Record<string, { icon: LucideIcon; tone: ReportStatTone }> = {
  product_count: { icon: Package, tone: "info" },
  total_qty: { icon: Package, tone: "info" },
  product_price_total: { icon: Wallet, tone: "success" },
  topping_total: { icon: Wallet, tone: "success" },
  total: { icon: Wallet, tone: "success" },
  discount_item_amount: { icon: BadgePercent, tone: "danger" },
  after_discount_item: { icon: Calculator, tone: "primary" },
  discount_bill: { icon: Tag, tone: "danger" },
  after_discount_bill: { icon: Calculator, tone: "primary" },
  sum_servicecharge: { icon: HandPlatter, tone: "primary" },
  sum_vate: { icon: Landmark, tone: "warning" },
  grand_total: { icon: TrendingUp, tone: "highlight" },
};

export function CategorySalesSummaryCards({
  id,
  summary,
}: {
  id?: string;
  summary: Record<string, unknown>;
}) {
  const { t } = useTranslation();
  const stats: ReportStat[] = categorySalesSummaryMetricConfigs(t).map((metric) => {
    const presentation = SUMMARY_PRESENTATION[metric.key] ?? { icon: Package, tone: "primary" };

    return {
      ...presentation,
      key: metric.key,
      label: metric.label,
      negative: presentation.tone === "danger" && metricNumber(summary[metric.key]) > 0,
      value: displayMetric(summary[metric.key], metric.kind),
    };
  });

  return (
    <ReportStatCards
      id={id}
      stats={[...stats.filter((stat) => stat.tone === "highlight"), ...stats.filter((stat) => stat.tone !== "highlight")]}
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
  locationOptions,
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
        locationOptions={locationOptions}
        onDraftChange={onDraftChange}
      />
    </ReportFilterSheet>
  );
}

// จอ lg ขึ้นไปกรองได้จากหน้าเลย โครงเดียวกับ /settings/store และหน้ารายงานขายประจำวัน
export function CategorySalesFilterBar({
  actions,
  branchLoading,
  branchLocked,
  branchOptions,
  canApply,
  draftFilters,
  loading,
  locationOptions,
  methodOptions,
  onApply,
  onDraftChange,
}: FilterProps & { actions?: ReactNode }) {
  return (
    <ReportFilterCard
      actions={actions}
      canApply={canApply}
      // shrink-0: Card มี overflow-hidden (min-height ของ flex item = 0) — กันถูกบีบตอนโหลด ดู report-layout.tsx
      className="hidden shrink-0 shadow-none lg:block"
      contentClassName="grid items-end gap-3 py-4 lg:grid-cols-3 2xl:grid-cols-[repeat(8,minmax(0,1fr))_auto]"
      loading={loading}
      onApply={onApply}
    >
      <CategorySalesFilterFields
        branchLoading={branchLoading}
        branchLocked={branchLocked}
        branchOptions={branchOptions}
        draftFilters={draftFilters}
        idPrefix="category-sales"
        methodOptions={methodOptions}
        locationOptions={locationOptions}
        onDraftChange={onDraftChange}
      />
    </ReportFilterCard>
  );
}

export function CategorySalesFilterFields({
  branchLoading,
  branchLocked,
  branchOptions,
  draftFilters,
  idPrefix,
  locationOptions,
  methodOptions,
  onDraftChange,
}: {
  branchLoading: boolean;
  branchLocked: boolean;
  branchOptions: CategorySalesOption[];
  draftFilters: CategorySalesReportFilters;
  idPrefix: string;
  methodOptions: Array<{ label: string; value: PaymentMethodReportFilter }>;
  locationOptions: ReportLocationOptions & { loading: boolean };
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
        onValueChange={(value) => patch({ branchUuid: value, tableUuid: "all", zoneUuid: "all" })}
      />

      <ReportLocationFields
        branchUuid={draftFilters.branchUuid}
        idPrefix={idPrefix}
        loading={locationOptions.loading}
        tableOptions={locationOptions.tableOptions}
        tableUuid={draftFilters.tableUuid}
        zoneOptions={locationOptions.zoneOptions}
        zoneUuid={draftFilters.zoneUuid}
        onTableChange={(tableUuid) => patch({ tableUuid })}
        onZoneChange={(zoneUuid) => patch({ tableUuid: "all", zoneUuid })}
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

type MetricTone = "default" | "discount" | "total";

type CategoryMetricColumn = {
  field: keyof CategorySalesRow & CategorySalesSortKey;
  id: string;
  kind: "money" | "number";
  label: string;
  /** ค่ารวมจาก summary (ของกลุ่มหรือทั้งรายงาน) — ส่วนลดรวมคำนวณจากหลาย key */
  summaryValue: (summary: Record<string, unknown>) => unknown;
  tone: MetricTone;
};

function categoryMetricColumns(
  t: (key: string) => string,
  labelOverrides?: CategoryLabelOverrides,
): CategoryMetricColumn[] {
  const read = (key: string) => (summary: Record<string, unknown>) => summary[key];

  return [
    { field: "productPriceTotal", id: "productPriceTotal", kind: "money", label: t("report.categorySales.columns.productPriceTotal"), summaryValue: read("product_price_total"), tone: "default" },
    { field: "totalQty", id: "totalQty", kind: "number", label: t("report.categorySales.columns.qtyTotal"), summaryValue: read("total_qty"), tone: "default" },
    { field: "toppingTotal", id: "toppingTotal", kind: "money", label: t("report.categorySales.columns.toppingTotal"), summaryValue: read("topping_total"), tone: "default" },
    { field: "total", id: "total", kind: "money", label: t("report.categorySales.columns.total"), summaryValue: read("total"), tone: "default" },
    { field: "discountTotal", id: "discountTotal", kind: "money", label: t("report.categorySales.columns.discountTotal"), summaryValue: summaryDiscountTotal, tone: "discount" },
    { field: "serviceCharge", id: "serviceCharge", kind: "money", label: labelOverrides?.sum_servicecharge ?? t("report.categorySales.columns.serviceCharge"), summaryValue: read("sum_servicecharge"), tone: "default" },
    { field: "vat", id: "vat", kind: "money", label: labelOverrides?.sum_vate ?? t("report.categorySales.columns.vat"), summaryValue: read("sum_vate"), tone: "default" },
    { field: "grandTotal", id: "grandTotal", kind: "money", label: t("report.categorySales.columns.grandTotal"), summaryValue: read("grand_total"), tone: "total" },
  ];
}

type CategoryLabelOverrides = {
  sum_servicecharge?: string;
  sum_vate?: string;
};

/** ตัวเลือกของเมนู "คอลัมน์" — ชื่อสินค้าและยอดสุทธิเป็นแกนของรายงาน ซ่อนไม่ได้ */
export function categorySalesColumnOptions(
  t: (key: string) => string,
  labelOverrides?: CategoryLabelOverrides,
): ReportColumnOption[] {
  return categoryMetricColumns(t, labelOverrides).map((column) => ({
    hideable: column.id !== "grandTotal",
    id: column.id,
    label: column.label,
  }));
}

// สีตัวเลข: ส่วนลดที่มากกว่า 0 = แดง, ยอดสุทธิ = สีธีม, ค่า 0 = จาง
function metricClass(value: unknown, tone: MetricTone) {
  const number = metricNumber(value);

  return cn(
    "text-right tabular-nums",
    number === 0 && "text-muted-foreground",
    tone === "discount" && number > 0 && "text-destructive",
    tone === "total" && number !== 0 && "font-medium text-primary-text",
  );
}

// สัดส่วนยอดสุทธิของสินค้าในกลุ่ม — เห็นทันทีว่าตัวไหนทำเงินให้กลุ่มมากที่สุด
function groupShare(row: CategorySalesRow, group: CategorySalesGroup) {
  const total = metricNumber(group.summary.grand_total);
  if (total <= 0) return null;
  return Math.min(100, Math.max(0, (metricNumber(row.grandTotal) / total) * 100));
}

function footerCellClass(align: "left" | "right" = "left") {
  return cn(
    // แถวรวมค้างขอบล่าง — ทึบ (bg-background) แล้ววางสีธีมจางเป็นชั้น gradient ทับ
    "sticky bottom-0 z-20 border-t border-primary/30 bg-background bg-linear-to-r from-primary/10 to-primary/10 font-medium text-primary-text",
    align === "right" && "text-right tabular-nums",
  );
}

export function CategorySalesTable({
  groups,
  isColumnVisible,
  labelOverrides,
  selectedRowIds,
  summary,
  onToggleRow,
  onToggleRows,
}: {
  groups: CategorySalesGroup[];
  isColumnVisible: (id: string) => boolean;
  labelOverrides?: CategoryLabelOverrides;
  selectedRowIds: Set<string>;
  summary: Record<string, unknown>;
  onToggleRow: (row: CategorySalesRow, selected: boolean) => void;
  onToggleRows: (rows: CategorySalesRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();
  const columns = useMemo(
    () => categoryMetricColumns(t, labelOverrides).filter((column) => isColumnVisible(column.id)),
    [isColumnVisible, labelOverrides, t],
  );

  const getGroupSortValue = useCallback((group: CategorySalesGroup, key: CategorySalesSortKey) => {
    if (key === "groupName") return group.groupName;
    if (key === "groupSummary") return group.summary.grand_total;
    return group.rows[0]?.[key as keyof CategorySalesRow];
  }, []);

  const { sort, sortedRows: sortedGroups, toggleSort } = useLocalTableSort(groups, getGroupSortValue);
  const sortedGroupRows = useMemo(
    () =>
      sortedGroups.map((group) => ({
        group,
        rows: sortRowsLocally(group.rows, sort, (row, key) => row[key as keyof CategorySalesRow]),
      })),
    [sort, sortedGroups],
  );
  const visibleRows = sortedGroupRows.flatMap(({ rows }) => rows);
  const { allVisibleSelected, someVisibleSelected } = selectionStateForVisibleIds(
    visibleRows.map(categorySalesRowId),
    selectedRowIds,
  );
  const productCount = metricNumber(summary.product_count);

  return (
    // container ของ Table เป็นตัวสกรอลเอง — หัวตาราง sticky ด้านบน, แถวรวม sticky ด้านล่าง
    <Table containerClassName="min-h-0 flex-1 overflow-auto">
      <TableHeader className="sticky top-0 z-30 bg-muted">
        <TableRow>
          <TableHead>
            <ReportIndeterminateCheckbox
              aria-label={t("common.selectAll")}
              checked={allVisibleSelected}
              indeterminate={!allVisibleSelected && someVisibleSelected}
              onCheckedChange={(checked) => onToggleRows(visibleRows, checked as boolean)}
            />
          </TableHead>
          <SortableReportTableHead sort={sort} sortKey="productName" className="min-w-60" onSort={toggleSort}>
            {t("report.categorySales.columns.product")}
          </SortableReportTableHead>
          {columns.map((column) => (
            <SortableReportTableHead
              key={column.id}
              align="right"
              sort={sort}
              sortKey={column.field}
              className="text-right"
              onSort={toggleSort}
            >
              {column.label}
            </SortableReportTableHead>
          ))}
        </TableRow>
      </TableHeader>

      <TableBody>
        {sortedGroupRows.map(({ group, rows }) => {
          const selection = selectionStateForVisibleIds(rows.map(categorySalesRowId), selectedRowIds);

          return (
            <Fragment key={group.groupUuid || group.groupName}>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableCell>
                  <ReportIndeterminateCheckbox
                    aria-label={t("common.selectRow", { name: group.groupName })}
                    checked={selection.allVisibleSelected}
                    indeterminate={!selection.allVisibleSelected && selection.someVisibleSelected}
                    onCheckedChange={(checked) => onToggleRows(group.rows, checked as boolean)}
                  />
                </TableCell>
                <TableCell colSpan={1 + columns.length}>
                  <span className="font-medium">{group.groupName}</span>
                  <span className="ml-2 text-muted-foreground">
                    {t("report.categorySales.productsCount", { count: group.rows.length })}
                  </span>
                </TableCell>
              </TableRow>

              {rows.map((row) => {
                const selected = selectedRowIds.has(categorySalesRowId(row));
                const share = groupShare(row, group);

                return (
                  <TableRow
                    key={`${row.groupUuid}-${row.cateUuid}-${row.productUuid}-${row.rank}`}
                    data-state={selected ? "selected" : undefined}
                  >
                    <TableCell>
                      <Checkbox
                        aria-label={t("common.selectRow", { name: row.productName })}
                        checked={selected}
                        onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-medium">{row.productName}</span>
                        {row.cateName ? <span className="text-muted-foreground">{row.cateName}</span> : null}
                        {share !== null ? (
                          <span className="flex max-w-56 items-center gap-2">
                            <Progress value={share} aria-hidden="true" />
                            <span className="shrink-0 tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    {columns.map((column) => (
                      <TableCell key={column.id} className={metricClass(row[column.field], column.tone)}>
                        {displayMetric(row[column.field], column.kind)}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}

              <TableRow className="bg-primary/5 hover:bg-primary/5">
                <TableCell />
                <TableCell className="font-medium text-primary-text">{t("common.total")}</TableCell>
                {columns.map((column) => {
                  const value = column.summaryValue(group.summary);
                  return (
                    <TableCell key={column.id} className={cn(metricClass(value, column.tone), "font-medium")}>
                      {displayMetric(value, column.kind)}
                    </TableCell>
                  );
                })}
              </TableRow>
            </Fragment>
          );
        })}

        <TableRow className="hover:bg-transparent">
          <TableCell className={footerCellClass()} colSpan={2}>
            {t("report.summary")}
            {productCount > 0 ? (
              <span className="ml-2 font-normal text-muted-foreground">
                {t("report.categorySales.productsCount", { count: productCount })}
              </span>
            ) : null}
          </TableCell>
          {columns.map((column) => {
            const value = column.summaryValue(summary);
            return (
              <TableCell
                key={column.id}
                className={cn(
                  footerCellClass("right"),
                  column.tone === "total" ? "font-semibold" : "text-foreground",
                  column.tone === "discount" && metricNumber(value) > 0 && "text-destructive",
                )}
              >
                {displayMetric(value, column.kind)}
              </TableCell>
            );
          })}
        </TableRow>
      </TableBody>
    </Table>
  );
}

export function CategorySalesMobileList({
  groups,
  selectedRowIds,
  onToggleRow,
  onToggleRows,
}: {
  groups: CategorySalesGroup[];
  selectedRowIds: Set<string>;
  onToggleRow: (row: CategorySalesRow, selected: boolean) => void;
  onToggleRows: (rows: CategorySalesRow[], selected: boolean) => void;
}) {
  const { t } = useTranslation();

  return (
    <ItemGroup>
      {groups.map((group) => {
        const selection = selectionStateForVisibleIds(group.rows.map(categorySalesRowId), selectedRowIds);

        return (
          <Item key={group.groupUuid || group.groupName} variant="outline">
            <ReportIndeterminateCheckbox
              aria-label={t("common.selectRow", { name: group.groupName })}
              checked={selection.allVisibleSelected}
              indeterminate={!selection.allVisibleSelected && selection.someVisibleSelected}
              onCheckedChange={(checked) => onToggleRows(group.rows, checked as boolean)}
            />
            <ItemContent>
              <ItemTitle>{group.groupName}</ItemTitle>
              <ItemDescription>
                {t("report.categorySales.columns.qtyTotal")} {displayMetric(group.summary.total_qty, "number")}
              </ItemDescription>
            </ItemContent>
            <ItemActions>
              <span className="font-medium tabular-nums text-primary-text">
                {displayMetric(group.summary.grand_total, "money")}
              </span>
            </ItemActions>

            <ItemFooter>
              <ItemGroup>
                {group.rows.map((row) => {
                  const share = groupShare(row, group);
                  const discount = metricNumber(row.discountTotal);

                  return (
                    <Item
                      key={`${row.groupUuid}-${row.cateUuid}-${row.productUuid}-${row.rank}`}
                      variant="muted"
                      size="sm"
                    >
                      <Checkbox
                        aria-label={t("common.selectRow", { name: row.productName })}
                        checked={selectedRowIds.has(categorySalesRowId(row))}
                        onCheckedChange={(checked) => onToggleRow(row, checked as boolean)}
                      />
                      <ItemContent>
                        <ItemTitle>{row.productName}</ItemTitle>
                        <ItemDescription>
                          {t("report.categorySales.columns.qtyTotal")} {displayMetric(row.totalQty, "number")}
                          {discount > 0 ? (
                            <span className="text-destructive">
                              {" · "}
                              {t("report.categorySales.columns.discountTotal")} {displayMetric(discount, "money")}
                            </span>
                          ) : null}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <span className="tabular-nums">{displayMetric(row.grandTotal, "money")}</span>
                      </ItemActions>
                      {share !== null ? (
                        <ItemFooter>
                          <Progress value={share} aria-hidden="true" />
                          <span className="shrink-0 tabular-nums text-muted-foreground">{share.toFixed(1)}%</span>
                        </ItemFooter>
                      ) : null}
                    </Item>
                  );
                })}
              </ItemGroup>
            </ItemFooter>
          </Item>
        );
      })}
    </ItemGroup>
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
