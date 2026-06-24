import { money } from "@/lib/format";
import { PAYMENT_METHOD_REPORT_FILTER_OPTIONS, type PaymentMethodReportFilter } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { CategorySalesRow } from "@/stores/report-store";
import type {
  CategorySalesMetricKind,
  CategorySalesOption,
  CategorySalesReportFilters,
  CategorySalesRowMetricConfig
} from "./category-sales-report-types";

type MetricDefinition = Omit<CategorySalesRowMetricConfig, "label"> & {
  labelKey: string;
};

type SummaryMetricDefinition = {
  key: string;
  kind: CategorySalesMetricKind;
  labelKey: string;
};

const rowMetricDefinitions = [
  { field: "billCount", key: "category_bill_count", kind: "number", labelKey: "report.categorySales.columns.billCount" },
  { field: "itemsCount", key: "items_count", kind: "number", labelKey: "report.categorySales.columns.itemsCount" },
  { field: "qtyTotal", key: "qty_total", kind: "number", labelKey: "report.categorySales.columns.qtyTotal" },
  { field: "toppingTotal", key: "topping_total", kind: "money", labelKey: "report.categorySales.columns.toppingTotal" },
  { field: "amount", key: "amount", kind: "money", labelKey: "report.categorySales.columns.amount" },
  // { field: "itemDiscount", key: "item_discount", kind: "money", labelKey: "report.categorySales.columns.itemDiscount" },
  // { field: "discountBill", key: "discount_bill", kind: "money", labelKey: "report.categorySales.columns.discountBill" },
  { field: "discountTotal", key: "discount_total", kind: "money", labelKey: "report.categorySales.columns.discountTotal" },
  { field: "serviceCharge", key: "service_charge", kind: "money", labelKey: "report.categorySales.columns.serviceCharge" },
  { field: "vat", key: "vat", kind: "money", labelKey: "report.categorySales.columns.vat" },
  { field: "total", key: "total", kind: "money", labelKey: "report.categorySales.columns.total" },
  { field: "salePercent", key: "sale_percent", kind: "percent", labelKey: "report.categorySales.columns.salePercent" }
] as const satisfies readonly MetricDefinition[];

const summaryMetricDefinitions = [
  { key: "categories_count", kind: "number", labelKey: "report.categorySales.cards.categories" },
  { key: "category_bill_count", kind: "number", labelKey: "report.categorySales.columns.billCount" },
  { key: "items_count", kind: "number", labelKey: "report.categorySales.columns.itemsCount" },
  { key: "qty_total", kind: "number", labelKey: "report.categorySales.columns.qtyTotal" },
  { key: "amount", kind: "money", labelKey: "report.categorySales.columns.amount" },
  { key: "discount_total", kind: "money", labelKey: "report.categorySales.columns.discountTotal" },
  { key: "service_charge", kind: "money", labelKey: "report.categorySales.columns.serviceCharge" },
  { key: "vat", kind: "money", labelKey: "report.categorySales.columns.vat" },
  { key: "total", kind: "money", labelKey: "report.categorySales.columns.total" }
] as const satisfies readonly SummaryMetricDefinition[];

function isPresent(value: unknown) {
  return value !== null && value !== undefined && value !== "";
}

export function firstNumber(value: unknown) {
  if (!isPresent(value)) return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function formatNumber(value: unknown) {
  return firstNumber(value).toLocaleString("en-US");
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function displayMetric(value: unknown, kind: CategorySalesMetricKind) {
  if (kind === "money") return money(firstNumber(value));
  if (kind === "percent") return `${firstNumber(value).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
  return formatNumber(value);
}

export function paymentMethodFallbackOptions(t: (key: string) => string): CategorySalesOption[] {
  return PAYMENT_METHOD_REPORT_FILTER_OPTIONS.map((value) => ({
    label: value === "all" ? t("common.all") : t(`report.paymentMethods.${value}`),
    value
  }));
}

export function selectedPaymentMethodLabel(
  value: PaymentMethodReportFilter,
  t: (key: string) => string
) {
  return paymentMethodFallbackOptions(t).find((option) => option.value === value)?.label ?? t("common.all");
}

export function categorySalesRowMetricConfigs(t: (key: string) => string): CategorySalesRowMetricConfig[] {
  return rowMetricDefinitions.map((definition) => ({
    field: definition.field,
    key: definition.key,
    kind: definition.kind,
    label: t(definition.labelKey)
  }));
}

export function categorySalesSummaryMetricConfigs(t: (key: string) => string) {
  return summaryMetricDefinitions.map((definition) => ({
    key: definition.key,
    kind: definition.kind,
    label: t(definition.labelKey)
  }));
}

export function categorySalesFileBaseName(filters: CategorySalesReportFilters) {
  return `category-sales-${filters.paymentMethod}-${filters.orderBy}-${filters.dateFrom}-to-${filters.dateTo}`;
}

export function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function exportCategorySalesRows(rows: CategorySalesRow[], t: (key: string) => string) {
  const metrics = categorySalesRowMetricConfigs(t);
  return rows.map((row) => ({
    [t("report.categorySales.columns.rank")]: row.rank,
    [t("report.categorySales.columns.group")]: row.groupName,
    [t("report.categorySales.columns.category")]: row.cateName,
    ...Object.fromEntries(metrics.map((metric) => [metric.label, Number(row[metric.field] ?? 0)]))
  }));
}

export function exportSummaryRows(summary: ApiEntity, t: (key: string) => string) {
  return categorySalesSummaryMetricConfigs(t).map((metric) => ({
    [t("report.categorySales.export.metric")]: metric.label,
    [t("report.categorySales.export.value")]: firstNumber(summary[metric.key])
  }));
}

export function emptyExportData() {
  return {
    groups: [],
    reportName: "",
    rows: [],
    summary: {}
  };
}
