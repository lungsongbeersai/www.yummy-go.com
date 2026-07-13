import { money } from "@/lib/format";
import {
  PAYMENT_METHOD_REPORT_FILTER_OPTIONS,
  type PaymentMethodReportFilter,
} from "@/config/report-filters";
import type { ApiEntity } from "@/services/shared/types";
import type { CategorySalesGroup, CategorySalesRow } from "@/stores/report-store";
import type {
  ReportExcelCellStyle,
  ReportExcelGridRow,
  ReportExcelGridSection
} from "../report-excel-utils";
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

// สไตล์ตาราง Excel แบบจัดกลุ่ม: แถวหัวกลุ่มถือยอดรวมของกลุ่มไว้ในตัว
const GROUPED_TABLE_HEADER_STYLE = {
  align: "center",
  bold: true,
  fill: "#1F4E78",
  fontColor: "#FFFFFF"
} as const satisfies ReportExcelCellStyle;

const GROUP_ROW_STYLE = {
  bold: true,
  fill: "#DEE8F4"
} as const satisfies ReportExcelCellStyle;

const GRAND_TOTAL_ROW_STYLE = {
  bold: true,
  fill: "#D9E2F3"
} as const satisfies ReportExcelCellStyle;

// summary ของ API ไม่มี key discount_total ตรงๆ ต้องรวมส่วนลดรายการ + ส่วนลดบิล
export function categorySalesSummaryDiscountTotal(summary: ApiEntity) {
  return (
    firstNumber(summary.discount_item_amount) + firstNumber(summary.discount_bill)
  );
}

function summaryMetricValue(summary: ApiEntity, key: string) {
  if (key === "discount_total") return categorySalesSummaryDiscountTotal(summary);
  return firstNumber(summary[key]);
}

// ตารางเดียวจัดกลุ่มตามกลุ่มสินค้า เหมือนหน้าจอ: แถวกลุ่ม (พร้อมยอดรวมกลุ่ม)
// → สินค้าในกลุ่ม → ปิดท้ายด้วยยอดรวมทั้งรายงาน
export function categorySalesGroupedSection(
  groups: CategorySalesGroup[],
  summary: ApiEntity,
  t: (key: string) => string,
  labelOverrides?: CategorySalesLabelOverrides
): ReportExcelGridSection {
  const metrics = categorySalesRowMetricConfigs(t, labelOverrides);
  const headers = [
    t("report.categorySales.columns.product"),
    t("report.categorySales.columns.category"),
    ...metrics.map((metric) => metric.label)
  ];
  const rows: ReportExcelGridRow[] = [
    {
      cells: headers.map((header) => ({ value: header })),
      style: GROUPED_TABLE_HEADER_STYLE
    }
  ];

  groups.forEach((group) => {
    rows.push({
      cells: [
        { colSpan: 2, value: group.groupName },
        ...metrics.map((metric) => ({
          value: summaryMetricValue(group.summary, metric.key)
        }))
      ],
      style: GROUP_ROW_STYLE
    });
    group.rows.forEach((row) => {
      rows.push({
        cells: [
          { value: row.productName },
          { value: row.cateName },
          ...metrics.map((metric) => ({ value: firstNumber(row[metric.field]) }))
        ]
      });
    });
  });

  rows.push({
    cells: [
      { colSpan: 2, value: t("report.summary") },
      ...metrics.map((metric) => ({ value: summaryMetricValue(summary, metric.key) }))
    ],
    style: GRAND_TOTAL_ROW_STYLE
  });

  return {
    grid: {
      columnCount: headers.length,
      columnWidths: [34, 20, 10, 10, 17, 14, 15, 14, 16, 13, 16],
      rows
    },
    title: t("report.excel.rows")
  };
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
