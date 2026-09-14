import { businessDateInputValue } from "@/lib/format";
import type { VatReportSummary } from "@/services/report";
import type { ReportMetricKind } from "../shared/report-metrics";

export function vatReportToday() {
  return businessDateInputValue();
}

export function validVatDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to;
}

const SUMMARY_METRIC_DEFINITIONS = [
  { key: "bill_count", kind: "number", labelKey: "report.vat.columns.billCount" },
  { key: "net_sale", kind: "money", labelKey: "report.vat.columns.netSale" },
  { key: "service_charge", kind: "money", labelKey: "report.vat.columns.serviceCharge" },
  { key: "discount_amount", kind: "money", labelKey: "report.vat.columns.discount" },
  { key: "vat", kind: "money", labelKey: "report.vat.columns.vat" },
  { key: "grand_total", kind: "money", labelKey: "report.vat.columns.grandTotal" },
] as const satisfies readonly { key: keyof VatReportSummary; kind: ReportMetricKind; labelKey: string }[];

export function vatSummaryMetricConfigs(t: (key: string) => string) {
  return SUMMARY_METRIC_DEFINITIONS.map(definition => ({
    key: definition.key,
    kind: definition.kind,
    label: t(definition.labelKey),
  }));
}
