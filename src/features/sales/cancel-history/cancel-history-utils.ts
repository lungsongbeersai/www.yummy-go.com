import { money } from "@/lib/format";
import { DEFAULT_PAGE_LIMIT, pageLimitNumber } from "@/lib/pagination";
import type { CancelHistoryOrder } from "@/services/cancel";
import type { PageLimit } from "@/services/shared/types";
import type { CancelHistoryBill } from "@/stores/cancel-store";

export interface CancelHistoryFilters {
  branchUuid: string;
  endDate: string;
  limit: PageLimit;
  orderBy: CancelHistoryOrder;
  startDate: string;
}

export type CancelHistoryMetricKind = "money" | "number";
export type CancelHistoryMetricField =
  | "orderQty"
  | "orderTotal"
  | "discountAmount"
  | "subtotal"
  | "serviceAmount"
  | "vatAmount"
  | "grandTotal"
  | "paidTotal"
  | "balance";

export interface CancelHistoryMetricConfig {
  field: CancelHistoryMetricField;
  kind: CancelHistoryMetricKind;
  labelKey: string;
}

export const CANCEL_HISTORY_LIMIT_OPTIONS: PageLimit[] = [20, 50, 100, 200];
export const CANCEL_HISTORY_ORDER_OPTIONS: CancelHistoryOrder[] = ["DESC", "ASC"];

export const cancelHistoryMetricConfigs = [
  { field: "orderQty", kind: "number", labelKey: "cancelHistory.columns.qty" },
  { field: "orderTotal", kind: "money", labelKey: "cancelHistory.columns.orderTotal" },
  { field: "discountAmount", kind: "money", labelKey: "cancelHistory.columns.discount" },
  { field: "subtotal", kind: "money", labelKey: "cancelHistory.columns.subtotal" },
  { field: "serviceAmount", kind: "money", labelKey: "cancelHistory.columns.serviceCharge" },
  { field: "vatAmount", kind: "money", labelKey: "cancelHistory.columns.vat" },
  { field: "grandTotal", kind: "money", labelKey: "cancelHistory.columns.grandTotal" },
  { field: "paidTotal", kind: "money", labelKey: "cancelHistory.columns.paidTotal" },
  { field: "balance", kind: "money", labelKey: "cancelHistory.columns.balance" }
] as const satisfies readonly CancelHistoryMetricConfig[];

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function defaultCancelHistoryFilters(branchUuid = "", date = new Date()): CancelHistoryFilters {
  const today = localDateInputValue(date);
  return {
    branchUuid,
    endDate: today,
    limit: DEFAULT_PAGE_LIMIT,
    orderBy: "DESC",
    startDate: today
  };
}

export function numericMetric(value: unknown) {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
}

export function formatCancelHistoryMetric(value: unknown, kind: CancelHistoryMetricKind) {
  const number = numericMetric(value);
  return kind === "money" ? money(number) : number.toLocaleString("en-US");
}

export function cancelHistoryMetrics(row: CancelHistoryBill, t: (key: string) => string) {
  return cancelHistoryMetricConfigs.map((metric) => ({
    ...metric,
    label: t(metric.labelKey),
    value: row[metric.field]
  }));
}

export function cancelHistoryRange(page: number, limit: PageLimit, rowCount: number, total: number) {
  const size = pageLimitNumber(limit);
  const start = rowCount ? (page - 1) * size + 1 : 0;
  const end = rowCount ? Math.min(total || start + rowCount - 1, start + rowCount - 1) : 0;
  return { end, start };
}
