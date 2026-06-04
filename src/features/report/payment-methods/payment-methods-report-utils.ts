import { money } from "@/lib/format";
import { PAGE_LIMIT_ALL_BATCH } from "@/lib/pagination";
import { PAYMENT_METHOD_REPORT_FILTER_OPTIONS, type PaymentMethodReportFilter } from "@/services/report";
import type { ApiEntity } from "@/services/shared/types";
import type { PaymentMethodOption, PaymentMethodReportRow } from "@/stores/report-store";
import type {
  PaymentMethodsExportData,
  PaymentMethodsReportFilters,
  PaymentMethodsRowMetricConfig,
  PaymentMethodsSummaryCard
} from "./payment-methods-report-types";

type TotalMetricDefinition = {
  key: string;
  kind: "money" | "number";
  labelKey: string;
};

type RowMetricDefinition = Omit<PaymentMethodsRowMetricConfig, "label"> & {
  labelKey: string;
};

const totalMetricDefinitions = [
  { key: "rows_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.rowsCount" },
  { key: "bills_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.billsCount" },
  { key: "active_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.activeCount" },
  { key: "cancelled_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.cancelledCount" },
  { key: "items_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.itemsCount" },
  { key: "qty_total", kind: "number", labelKey: "report.paymentMethodsReport.columns.qtyTotal" },
  { key: "amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.amount" },
  { key: "topping_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.toppingTotal" },
  { key: "item_discount", kind: "money", labelKey: "report.paymentMethodsReport.columns.itemDiscount" },
  { key: "discount_bill", kind: "money", labelKey: "report.paymentMethodsReport.columns.discountBill" },
  { key: "discount_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.discountTotal" },
  { key: "service_charge", kind: "money", labelKey: "report.paymentMethodsReport.columns.serviceCharge" },
  { key: "vat", kind: "money", labelKey: "report.paymentMethodsReport.columns.vat" },
  { key: "total", kind: "money", labelKey: "report.paymentMethodsReport.columns.total" },
  { key: "receive_cash", kind: "money", labelKey: "report.paymentMethodsReport.columns.receiveCash" },
  { key: "receive_transfer", kind: "money", labelKey: "report.paymentMethodsReport.columns.receiveTransfer" },
  { key: "debt_amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.debtAmount" },
  { key: "change_amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.changeAmount" },
  { key: "cancelled_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.cancelledTotal" },
  { key: "avg_bill", kind: "money", labelKey: "report.paymentMethodsReport.columns.avgBill" }
] as const satisfies readonly TotalMetricDefinition[];

const rowMetricDefinitions = [
  { field: "billsCount", key: "bills_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.billsCount" },
  { field: "activeCount", key: "active_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.activeCount" },
  { field: "cancelledCount", key: "cancelled_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.cancelledCount" },
  { field: "itemsCount", key: "items_count", kind: "number", labelKey: "report.paymentMethodsReport.columns.itemsCount" },
  { field: "qtyTotal", key: "qty_total", kind: "number", labelKey: "report.paymentMethodsReport.columns.qtyTotal" },
  { field: "amount", key: "amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.amount" },
  { field: "toppingTotal", key: "topping_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.toppingTotal" },
  { field: "itemDiscount", key: "item_discount", kind: "money", labelKey: "report.paymentMethodsReport.columns.itemDiscount" },
  { field: "discountBill", key: "discount_bill", kind: "money", labelKey: "report.paymentMethodsReport.columns.discountBill" },
  { field: "discountTotal", key: "discount_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.discountTotal" },
  { field: "serviceCharge", key: "service_charge", kind: "money", labelKey: "report.paymentMethodsReport.columns.serviceCharge" },
  { field: "vat", key: "vat", kind: "money", labelKey: "report.paymentMethodsReport.columns.vat" },
  { field: "total", key: "total", kind: "money", labelKey: "report.paymentMethodsReport.columns.total" },
  { field: "receiveCash", key: "receive_cash", kind: "money", labelKey: "report.paymentMethodsReport.columns.receiveCash" },
  { field: "receiveTransfer", key: "receive_transfer", kind: "money", labelKey: "report.paymentMethodsReport.columns.receiveTransfer" },
  { field: "debtAmount", key: "debt_amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.debtAmount" },
  { field: "changeAmount", key: "change_amount", kind: "money", labelKey: "report.paymentMethodsReport.columns.changeAmount" },
  { field: "cancelledTotal", key: "cancelled_total", kind: "money", labelKey: "report.paymentMethodsReport.columns.cancelledTotal" }
] as const satisfies readonly RowMetricDefinition[];

export const paymentMethodsExportLimit = PAGE_LIMIT_ALL_BATCH;

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

export function displayMetric(value: unknown, kind: "money" | "number") {
  return kind === "money" ? money(firstNumber(value)) : formatNumber(value);
}

export function paymentMethodFallbackOptions(t: (key: string) => string): PaymentMethodOption[] {
  return PAYMENT_METHOD_REPORT_FILTER_OPTIONS.map((value, index) => ({
    label: value === "all" ? t("common.all") : t(`report.paymentMethods.${value}`),
    sortOrder: index + 1,
    value
  }));
}

export function paymentMethodOptions(options: PaymentMethodOption[], t: (key: string) => string) {
  return options.length ? options : paymentMethodFallbackOptions(t);
}

export function selectedPaymentMethodLabel(
  options: PaymentMethodOption[],
  value: PaymentMethodReportFilter,
  t: (key: string) => string
) {
  return paymentMethodOptions(options, t).find((option) => option.value === value)?.label ?? t("common.all");
}

export function paymentMethodRowMetricConfigs(t: (key: string) => string): PaymentMethodsRowMetricConfig[] {
  return rowMetricDefinitions.map((definition) => ({
    field: definition.field,
    key: definition.key,
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

export function paymentMethodsFileBaseName(filters: PaymentMethodsReportFilters) {
  return `payment-methods-${filters.paymentMethod}-${filters.orderBy}-${filters.dateFrom}-to-${filters.dateTo}`;
}

export function waitForPaint() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export function exportSummaryRows(
  cards: PaymentMethodsSummaryCard[],
  reportTotal: ApiEntity,
  t: (key: string) => string
) {
  const cardRows = cards.map((card) => ({
    [t("report.paymentMethodsReport.export.section")]: t("report.paymentMethodsReport.export.cards"),
    [t("report.paymentMethodsReport.export.metric")]: card.label,
    [t("report.paymentMethodsReport.export.value")]: card.value
  }));
  const totalRows = paymentMethodTotalMetricConfigs(t).map((metric) => ({
    [t("report.paymentMethodsReport.export.section")]: t("report.paymentMethodsReport.export.total"),
    [t("report.paymentMethodsReport.export.metric")]: metric.label,
    [t("report.paymentMethodsReport.export.value")]: firstNumber(reportTotal[metric.key])
  }));

  return [...cardRows, ...totalRows];
}

export function exportPaymentMethodRows(rows: PaymentMethodReportRow[], t: (key: string) => string) {
  const metrics = paymentMethodRowMetricConfigs(t);
  return rows.map((row) => ({
    [t("report.paymentMethodsReport.columns.rank")]: row.rank,
    [t("report.paymentMethodsReport.columns.paymentMethod")]: row.paymentMethodName,
    [t("report.paymentMethodsReport.columns.paymentMethodCode")]: row.paymentMethodCode,
    ...Object.fromEntries(metrics.map((metric) => [metric.label, Number(row[metric.field] ?? 0)]))
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
