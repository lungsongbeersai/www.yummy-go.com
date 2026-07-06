import { money } from "@/lib/format";
import { PAYMENT_METHOD_REPORT_FILTER_OPTIONS, type PaymentMethodReportFilter } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { CategorySalesGroup, CategorySalesRow } from "@/stores/report-store";
import type {
  CategorySalesMetricKind,
  CategorySalesOption,
  CategorySalesReportFilters,
  CategorySalesRowMetricConfig
} from "./category-sales-report-types";

type MetricDefinition = Omit<CategorySalesRowMetricConfig, "label"> & {
  labelKey: string;
};

type CategorySalesLabelOverrides = Partial<{
  sum_servicecharge: string;
  sum_vate: string;
}>;

type SummaryMetricDefinition = {
  key: string;
  kind: CategorySalesMetricKind;
  labelKey: string;
};

const rowMetricDefinitions = [
  { field: "billCount", key: "bill_count", kind: "number", labelKey: "report.categorySales.columns.billCount" },
  { field: "totalQty", key: "total_qty", kind: "number", labelKey: "report.categorySales.columns.qtyTotal" },
  { field: "productPriceTotal", key: "product_price_total", kind: "money", labelKey: "report.categorySales.columns.productPriceTotal" },
  { field: "toppingTotal", key: "topping_total", kind: "money", labelKey: "report.categorySales.columns.toppingTotal" },
  { field: "total", key: "total", kind: "money", labelKey: "report.categorySales.columns.total" },
  { field: "discountTotal", key: "discount_total", kind: "money", labelKey: "report.categorySales.columns.discountTotal" },
  { field: "serviceCharge", key: "sum_servicecharge", kind: "money", labelKey: "report.categorySales.columns.serviceCharge" },
  { field: "vat", key: "sum_vate", kind: "money", labelKey: "report.categorySales.columns.vat" },
  { field: "grandTotal", key: "grand_total", kind: "money", labelKey: "report.categorySales.columns.grandTotal" }
] as const satisfies readonly MetricDefinition[];

const summaryMetricDefinitions = [
  { key: "product_count", kind: "number", labelKey: "report.categorySales.cards.products" },
  { key: "bill_count", kind: "number", labelKey: "report.categorySales.columns.billCount" },
  { key: "total_qty", kind: "number", labelKey: "report.categorySales.columns.qtyTotal" },
  { key: "product_price_total", kind: "money", labelKey: "report.categorySales.columns.productPriceTotal" },
  { key: "topping_total", kind: "money", labelKey: "report.categorySales.columns.toppingTotal" },
  { key: "total", kind: "money", labelKey: "report.categorySales.columns.total" },
  { key: "discount_item_amount", kind: "money", labelKey: "report.categorySales.columns.itemDiscount" },
  { key: "after_discount_item", kind: "money", labelKey: "report.categorySales.columns.afterDiscountItem" },
  { key: "discount_bill", kind: "money", labelKey: "report.categorySales.columns.discountBill" },
  { key: "after_discount_bill", kind: "money", labelKey: "report.categorySales.columns.afterDiscountBill" },
  { key: "sum_servicecharge", kind: "money", labelKey: "report.categorySales.columns.serviceCharge" },
  { key: "sum_vate", kind: "money", labelKey: "report.categorySales.columns.vat" },
  { key: "grand_total", kind: "money", labelKey: "report.categorySales.columns.grandTotal" }
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

export function categorySalesRowMetricConfigs(
  t: (key: string) => string,
  labelOverrides?: CategorySalesLabelOverrides
): CategorySalesRowMetricConfig[] {
  return rowMetricDefinitions.map((definition) => ({
    field: definition.field,
    key: definition.key,
    kind: definition.kind,
    label: labelOverrides?.[definition.key as keyof CategorySalesLabelOverrides] ?? t(definition.labelKey)
  }));
}

export function categorySalesSummaryMetricConfigs(
  t: (key: string) => string,
  labelOverrides?: CategorySalesLabelOverrides
) {
  return summaryMetricDefinitions.map((definition) => ({
    key: definition.key,
    kind: definition.kind,
    label: labelOverrides?.[definition.key as keyof CategorySalesLabelOverrides] ?? t(definition.labelKey)
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

export function exportCategorySalesRows(
  rows: CategorySalesRow[],
  t: (key: string) => string,
  labelOverrides?: CategorySalesLabelOverrides
) {
  const metrics = categorySalesRowMetricConfigs(t, labelOverrides);
  return rows.map((row) => ({
    [t("report.categorySales.columns.group")]: row.groupName,
    [t("report.categorySales.columns.category")]: row.cateName,
    [t("report.categorySales.columns.product")]: row.productName,
    ...Object.fromEntries(metrics.map((metric) => [metric.label, Number(row[metric.field] ?? 0)]))
  }));
}

export function exportSummaryRows(
  summary: ApiEntity,
  t: (key: string) => string,
  labelOverrides?: CategorySalesLabelOverrides
) {
  return categorySalesSummaryMetricConfigs(t, labelOverrides).map((metric) => ({
    [t("report.categorySales.export.metric")]: metric.label,
    [t("report.categorySales.export.value")]: firstNumber(summary[metric.key])
  }));
}

export function categorySalesRowId(row: CategorySalesRow) {
  return [
    row.groupUuid,
    row.cateUuid,
    row.productUuid,
    row.rank,
  ].join(":");
}

export function categorySalesSummaryFromRows(rows: CategorySalesRow[]) {
  return rows.reduce<ApiEntity>(
    (summary, row) => {
      summary.product_count = firstNumber(summary.product_count) + 1;
      summary.bill_count = firstNumber(summary.bill_count) + row.billCount;
      summary.total_qty = firstNumber(summary.total_qty) + row.totalQty;
      summary.product_price_total =
        firstNumber(summary.product_price_total) + row.productPriceTotal;
      summary.topping_total = firstNumber(summary.topping_total) + row.toppingTotal;
      summary.total = firstNumber(summary.total) + row.total;
      summary.discount_item_amount =
        firstNumber(summary.discount_item_amount) + row.discountItemAmount;
      summary.after_discount_item =
        firstNumber(summary.after_discount_item) + row.afterDiscountItem;
      summary.discount_bill = firstNumber(summary.discount_bill) + row.discountBill;
      summary.after_discount_bill =
        firstNumber(summary.after_discount_bill) + row.afterDiscountBill;
      summary.sum_servicecharge =
        firstNumber(summary.sum_servicecharge) + row.serviceCharge;
      summary.sum_vate = firstNumber(summary.sum_vate) + row.vat;
      summary.grand_total = firstNumber(summary.grand_total) + row.grandTotal;
      return summary;
    },
    {},
  );
}

export function categorySalesGroupsFromRows(
  groups: CategorySalesGroup[],
  rows: CategorySalesRow[],
) {
  const selectedIds = new Set(rows.map(categorySalesRowId));

  return groups
    .map((group) => {
      const categories = group.categories
        .map((category) => {
          const categoryRows = category.rows.filter((row) =>
            selectedIds.has(categorySalesRowId(row)),
          );
          if (!categoryRows.length) return null;

          return {
            ...category,
            rows: categoryRows,
            summary: categorySalesSummaryFromRows(categoryRows),
          };
        })
        .filter((category): category is NonNullable<typeof category> =>
          Boolean(category),
        );
      const groupRows = categories.flatMap((category) => category.rows);
      if (!groupRows.length) return null;

      return {
        ...group,
        categories,
        rows: groupRows,
        summary: categorySalesSummaryFromRows(groupRows),
      };
    })
    .filter((group): group is CategorySalesGroup => Boolean(group));
}

export function emptyExportData() {
  return {
    groups: [],
    reportName: "",
    rows: [],
    summary: {}
  };
}
