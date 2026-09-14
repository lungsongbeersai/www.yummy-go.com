import { businessDateInputValue } from "@/lib/format";
import type { CustomerSalesReportSummary } from "@/services/report";
import type { ReportMetricKind } from "../shared/report-metrics";

export function customerSalesToday() {
  return businessDateInputValue();
}

export function validCustomerSalesDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to;
}

const SUMMARY_METRIC_DEFINITIONS = [
  { key: "customer_count", kind: "number", labelKey: "report.customerSales.columns.customerCount" },
  { key: "bill_count", kind: "number", labelKey: "report.customerSales.columns.billCount" },
  { key: "net_sale", kind: "money", labelKey: "report.customerSales.columns.netSale" },
  { key: "service_charge", kind: "money", labelKey: "report.customerSales.columns.serviceCharge" },
  { key: "vat", kind: "money", labelKey: "report.customerSales.columns.vat" },
  { key: "grand_total", kind: "money", labelKey: "report.customerSales.columns.grandTotal" },
] as const satisfies readonly { key: keyof CustomerSalesReportSummary; kind: ReportMetricKind; labelKey: string }[];

export function customerSalesSummaryMetricConfigs(t: (key: string) => string) {
  return SUMMARY_METRIC_DEFINITIONS.map(definition => ({
    key: definition.key,
    kind: definition.kind,
    label: t(definition.labelKey),
  }));
}
