import { localDateInputValue } from "@/lib/format";
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

export { localDateInputValue };

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

const DATE_PREFIX_PATTERN = /^(\d{4})-(\d{2})-(\d{2})/;
const CLOCK_PATTERN = /^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2})/;

/** วันที่ของ "2026-09-15 00:00:00" แบบ dd/mm/yyyy — อ่านจากข้อความตรง ๆ ไม่ผ่าน Date กัน timezone เลื่อนวัน */
export function cancelHistoryDay(value: string) {
  const match = DATE_PREFIX_PATTERN.exec(value.trim());
  if (!match) return { key: value, label: value || "-" };
  return { key: `${match[1]}-${match[2]}-${match[3]}`, label: `${match[3]}/${match[2]}/${match[1]}` };
}

// backend เก็บ order_cancelled_at เป็นเที่ยงคืนเสมอ (ข้อมูลจริง "2026-09-15 00:00:00") ซึ่งไม่ใช่เวลา
// ที่ยกเลิกจริง — โชว์ HH:mm เฉพาะตอนที่มีเวลาจริง ไม่งั้นทุกแถวจะขึ้น 00:00 ที่ชวนเข้าใจผิด
export function cancelHistoryClock(value: string) {
  const match = CLOCK_PATTERN.exec(value.trim());
  if (!match || (match[1] === "00" && match[2] === "00")) return "";
  return `${match[1]}:${match[2]}`;
}

export interface CancelHistoryDateGroup {
  key: string;
  label: string;
  rows: CancelHistoryBill[];
}

/** จัดกลุ่มแถวที่ติดกันตามวันที่ยกเลิก — คงลำดับเดิมจาก API (ASC/DESC) ไม่เรียงใหม่ */
export function groupCancelHistoryByDate(rows: CancelHistoryBill[]) {
  const groups: CancelHistoryDateGroup[] = [];
  for (const row of rows) {
    const day = cancelHistoryDay(row.cancelledAt || row.orderDate);
    const last = groups.at(-1);
    if (last?.key === day.key) last.rows.push(row);
    else groups.push({ key: day.key, label: day.label, rows: [row] });
  }
  return groups;
}

export const CANCEL_HISTORY_PRESETS = ["today", "yesterday", "last7", "thisMonth"] as const;
export type CancelHistoryPreset = (typeof CANCEL_HISTORY_PRESETS)[number];

export function cancelHistoryPresetRange(preset: CancelHistoryPreset, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const shift = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);

  if (preset === "yesterday") {
    const yesterday = localDateInputValue(shift(-1));
    return { endDate: yesterday, startDate: yesterday };
  }
  if (preset === "last7") return { endDate: localDateInputValue(today), startDate: localDateInputValue(shift(-6)) };
  if (preset === "thisMonth") {
    return {
      endDate: localDateInputValue(today),
      startDate: localDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
    };
  }
  const value = localDateInputValue(today);
  return { endDate: value, startDate: value };
}

/** ปุ่มช่วงเวลาที่ตรงกับวันที่ที่กรองอยู่ — null เมื่อเป็นช่วงที่ผู้ใช้เลือกเอง */
export function activeCancelHistoryPreset(
  filters: Pick<CancelHistoryFilters, "endDate" | "startDate">,
  now = new Date()
): CancelHistoryPreset | null {
  return (
    CANCEL_HISTORY_PRESETS.find((preset) => {
      const range = cancelHistoryPresetRange(preset, now);
      return range.startDate === filters.startDate && range.endDate === filters.endDate;
    }) ?? null
  );
}

export interface CancelHistorySummary {
  grandTotal: number;
  qty: number;
  rows: number;
}

/** รวมเฉพาะแถวที่โหลดอยู่ — API ไม่ส่งยอดรวมของทั้งช่วงมา (หน้าเรียกใช้ต้องบอกว่าเป็นยอดของหน้านี้เมื่อมีหลายหน้า) */
export function summarizeCancelHistory(rows: CancelHistoryBill[]): CancelHistorySummary {
  return rows.reduce<CancelHistorySummary>(
    (summary, row) => ({
      grandTotal: summary.grandTotal + numericMetric(row.grandTotal),
      qty: summary.qty + numericMetric(row.orderQty),
      rows: summary.rows + 1
    }),
    { grandTotal: 0, qty: 0, rows: 0 }
  );
}
