import { readValue, textValue } from "@/lib/values";
import { businessDateInputValue } from "@/lib/format";
import type { ApiEntity } from "@/services/shared/types";
import type { ZoneSalesSummary } from "@/services/report";
import type { ReportMetricKind } from "../shared/report-metrics";

export function zoneSalesToday() {
  return businessDateInputValue();
}

export function validZoneSalesDateRange(from: string, to: string) {
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  return valid(from) && valid(to) && from <= to;
}

// ลำดับ field ตามภาษาแบบเดียวกับ branchOptionLabel (report-branch-options.ts)
export function zoneOptionLabel(zone: ApiEntity, language: string) {
  const keys = language === "en"
    ? ["zone_name_eng", "zone_name", "zone_name_la", "zone_uuid"]
    : ["zone_name_la", "zone_name", "zone_name_eng", "zone_uuid"];
  return textValue(readValue(zone, keys));
}

const SUMMARY_METRIC_DEFINITIONS = [
  { key: "zone_count", kind: "number", labelKey: "report.zoneSales.columns.zoneCount" },
  { key: "bill_count", kind: "number", labelKey: "report.zoneSales.columns.billCount" },
  { key: "customer_count", kind: "number", labelKey: "report.zoneSales.columns.customerCount" },
  { key: "net_sale", kind: "money", labelKey: "report.zoneSales.columns.netSale" },
  { key: "service_charge", kind: "money", labelKey: "report.zoneSales.columns.serviceCharge" },
  { key: "vat", kind: "money", labelKey: "report.zoneSales.columns.vat" },
  { key: "grand_total", kind: "money", labelKey: "report.zoneSales.columns.grandTotal" },
] as const satisfies readonly { key: keyof ZoneSalesSummary; kind: ReportMetricKind; labelKey: string }[];

export function zoneSalesSummaryMetricConfigs(t: (key: string) => string) {
  return SUMMARY_METRIC_DEFINITIONS.map(definition => ({
    key: definition.key,
    kind: definition.kind,
    label: t(definition.labelKey),
  }));
}
