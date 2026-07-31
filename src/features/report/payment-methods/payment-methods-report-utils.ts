import { firstNumberOrZero as firstNumber } from "@/lib/values";
import type { ApiEntity } from "@/services/shared/types";
import type { PaymentMethodOption, PaymentMethodReportRow } from "@/stores/report-store";
import { paymentMethodFallbackOptions } from "../shared/report-payment-method-options";
import type {
  PaymentMethodsExportData,
  PaymentMethodsReportFilters,
  PaymentMethodsRowMetricConfig,
  PaymentMethodsSummaryCard
} from "./payment-methods-report-types";

export { displayMetric, formatNumber } from "../shared/report-metrics";
export { paymentMethodFallbackOptions, selectedPaymentMethodLabel } from "../shared/report-payment-method-options";
export { waitForPaint } from "@/lib/export/paint";

type TotalMetricDefinition = {
  key: string;
  kind: "money" | "number";
  labelKey: string;
};

type RowMetricDefinition = Omit<PaymentMethodsRowMetricConfig, "label"> & {
  labelKey: string;
};

const totalMetricDefinitions = [
  { key: "bill_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.billsCount" },
  { key: "item_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.itemsCount" },
  { key: "total_qty", kind: "number", labelKey: "report.paymentMethodsReport.columns.qtyTotal" },
  { key: "product_price_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.productPriceTotal" },
  { key: "topping_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.toppingTotal" },
  { key: "total", kind: "money", labelKey: "report.paymentMethodsReport.columns.total" },
  { key: "discount_item_amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.itemDiscount" },
  { key: "after_discount_item", kind: "money", labelKey: "report.categorySales.columns.afterDiscountItem" },
  { key: "bill_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.billTotal" },
  { key: "discount_bill", kind: "money", labelKey: "report.paymentMethodsReport.columns.discountBill" },
  { key: "after_discount_bill", kind: "money", labelKey: "report.categorySales.columns.afterDiscountBill" },
  { key: "sum_servicecharge", kind: "money", labelKey: "report.paymentMethodsReport.columns.serviceCharge" },
  { key: "sum_vate", kind: "money", labelKey: "report.paymentMethodsReport.columns.vat" },
  { key: "grand_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.grandTotal" },
  { key: "payment_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.paymentAmount" },
  { key: "difference", kind: "money", labelKey: "report.paymentMethodsReport.columns.difference" }
] as const satisfies readonly TotalMetricDefinition[];

const rowMetricDefinitions = [
  { field: "billCount", key: "bill_count", summaryKey: "bill_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.billsCount" },
  { field: "productPriceTotal", key: "product_price_total", summaryKey: "product_price_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.productPriceTotal" },
  { field: "toppingTotal", key: "topping_total", summaryKey: "topping_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.toppingTotal" },
  { field: "total", key: "total", summaryKey: "total", kind: "money", labelKey: "report.paymentMethodsReport.columns.total" },
  { field: "discountItemAmount", key: "discount_item_amount", summaryKey: "discount_item_amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.itemDiscount" },
  { field: "afterDiscountItem", key: "after_discount_item", summaryKey: "after_discount_item", kind: "money", labelKey: "report.categorySales.columns.afterDiscountItem" },
  { field: "billTotal", key: "bill_total", summaryKey: "bill_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.billTotal" },
  { field: "discountBill", key: "discount_bill", summaryKey: "discount_bill", kind: "money", labelKey: "report.paymentMethodsReport.columns.discountBill" },
  { field: "afterDiscountBill", key: "after_discount_bill", summaryKey: "after_discount_bill", kind: "money", labelKey: "report.categorySales.columns.afterDiscountBill" },
  { field: "serviceCharge", key: "service_charge", summaryKey: "sum_servicecharge", kind: "money", labelKey: "report.paymentMethodsReport.columns.serviceCharge" },
  { field: "vat", key: "vat", summaryKey: "sum_vate", kind: "money", labelKey: "report.paymentMethodsReport.columns.vat" },
  { field: "grandTotal", key: "grand_total", summaryKey: "grand_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.grandTotal" }
] as const satisfies readonly RowMetricDefinition[];

export { firstNumber };

export function paymentMethodOptions(options: PaymentMethodOption[], t: (key: string) => string) {
  return options.length ? options : paymentMethodFallbackOptions(t);
}

export function paymentMethodRowMetricConfigs(t: (key: string) => string): PaymentMethodsRowMetricConfig[] {
  return rowMetricDefinitions.map((definition) => ({
    field: definition.field,
    key: definition.key,
    summaryKey: definition.summaryKey,
    kind: definition.kind,
    label: t(definition.labelKey)
  }));
}

export function paymentMethodTotalMetricConfigs(t: (key: string) => string) {
  return totalMetricDefinitions.map((definition) => ({
    key: definition.key,
    kind: definition.kind,
    label: t(definition.labelKey)
  }));
}

export function paymentMethodRowMetrics(row: PaymentMethodReportRow, t: (key: string) => string) {
  return paymentMethodRowMetricConfigs(t).map((metric) => ({
    ...metric,
    value: row[metric.field]
  }));
}

// คอลัมน์ที่แสดงบนหน้าจอเท่านั้น ไม่ใส่ในไฟล์ Excel/PDF export
const EXPORT_EXCLUDED_METRIC_KEYS = ["bill_count", "bill_total"];

export function paymentMethodExportMetricConfigs(
  t: (key: string) => string
): PaymentMethodsRowMetricConfig[] {
  return paymentMethodRowMetricConfigs(t).filter(
    (metric) => !EXPORT_EXCLUDED_METRIC_KEYS.includes(metric.key)
  );
}

// อ่านยอดรวมจาก summary ที่ backend ส่งมา ไม่บวกแถวเองที่ frontend —
// ไม่งั้นตัวเลขรวมในไฟล์ export จะไม่ตรงกับที่แสดงบนหน้าจอ ซึ่งอ่านจาก summary เหมือนกัน
export function paymentMethodExportTotals(
  reportTotal: ApiEntity,
  metrics: PaymentMethodsRowMetricConfig[]
) {
  return metrics.map((metric) => firstNumber(reportTotal[metric.summaryKey]));
}

export function paymentMethodsFileBaseName(filters: PaymentMethodsReportFilters) {
  return `payment-methods-${filters.paymentMethod}-${filters.dateFrom}-to-${filters.dateTo}`;
}

// ตาราง export มีแถวรวมท้ายตารางแบบเดียวกับ footer ของตารางบนหน้าจอ
// จึงไม่ต้องมี section สรุปแยกต่างหากอีก
export function exportPaymentMethodRows(
  rows: PaymentMethodReportRow[],
  t: (key: string) => string,
  reportTotal: ApiEntity
) {
  const metrics = paymentMethodExportMetricConfigs(t);
  const methodColumn = t("report.paymentMethodsReport.columns.paymentMethod");
  const totals = paymentMethodExportTotals(reportTotal, metrics);

  return [
    ...rows.map((row) => ({
      [methodColumn]: row.paymentMethodName,
      ...Object.fromEntries(metrics.map((metric) => [metric.label, Number(row[metric.field] ?? 0)]))
    })),
    {
      [methodColumn]: t("report.paymentMethodsReport.totalSummary"),
      ...Object.fromEntries(metrics.map((metric, index) => [metric.label, totals[index]]))
    }
  ];
}

export function paymentMethodReportRowId(row: PaymentMethodReportRow) {
  return `${row.paymentMethodCode}:${row.sortOrder}`;
}

export function paymentMethodReportTotalFromRows(
  rows: PaymentMethodReportRow[],
) {
  return rows.reduce<ApiEntity>(
    (summary, row) => {
      summary.bill_count = firstNumber(summary.bill_count) + row.billCount;
      summary.product_price_total =
        firstNumber(summary.product_price_total) + row.productPriceTotal;
      summary.topping_total = firstNumber(summary.topping_total) + row.toppingTotal;
      summary.total = firstNumber(summary.total) + row.total;
      summary.discount_item_amount =
        firstNumber(summary.discount_item_amount) + row.discountItemAmount;
      summary.after_discount_item =
        firstNumber(summary.after_discount_item) + row.afterDiscountItem;
      summary.bill_total = firstNumber(summary.bill_total) + row.billTotal;
      summary.discount_bill = firstNumber(summary.discount_bill) + row.discountBill;
      summary.after_discount_bill =
        firstNumber(summary.after_discount_bill) + row.afterDiscountBill;
      summary.sum_servicecharge =
        firstNumber(summary.sum_servicecharge) + row.serviceCharge;
      summary.sum_vate = firstNumber(summary.sum_vate) + row.vat;
      summary.grand_total = firstNumber(summary.grand_total) + row.grandTotal;
      summary.payment_total =
        firstNumber(summary.payment_total) + row.paymentAmount;
      summary.difference = 0;
      return summary;
    },
    {},
  );
}

export function paymentMethodCardsForTotal(
  cards: PaymentMethodsSummaryCard[],
  reportTotal: ApiEntity,
): PaymentMethodsSummaryCard[] {
  return cards.map((card) => ({
    ...card,
    value: firstNumber(reportTotal[card.key]),
  }));
}

export function emptyExportData(): PaymentMethodsExportData {
  return {
    cards: [],
    reportName: "",
    reportTotal: {},
    rows: []
  };
}
