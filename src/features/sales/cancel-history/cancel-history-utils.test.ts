import { describe, expect, it } from "vitest";
import type { CancelHistoryBill } from "@/stores/cancel-store";
import {
  activeCancelHistoryPreset,
  cancelHistoryClock,
  cancelHistoryDay,
  cancelHistoryPresetRange,
  groupCancelHistoryByDate,
  summarizeCancelHistory,
  cancelHistoryMetricConfigs,
  cancelHistoryRange,
  defaultCancelHistoryFilters,
  formatCancelHistoryMetric,
  localDateInputValue
} from "./cancel-history-utils";

describe("cancel history helpers", () => {
  it("creates today-to-today default filters", () => {
    const date = new Date(2026, 5, 3, 12);
    expect(localDateInputValue(date)).toBe("2026-06-03");
    expect(defaultCancelHistoryFilters("branch-1", date)).toEqual({
      branchUuid: "branch-1",
      endDate: "2026-06-03",
      limit: 20,
      orderBy: "DESC",
      startDate: "2026-06-03"
    });
  });

  it("keeps all cancel history financial fields in metric config", () => {
    expect(cancelHistoryMetricConfigs.map((metric) => metric.field)).toEqual([
      "orderQty",
      "orderTotal",
      "discountAmount",
      "subtotal",
      "serviceAmount",
      "vatAmount",
      "grandTotal",
      "paidTotal",
      "balance"
    ]);
  });

  it("formats string-number metrics and computes ranges", () => {
    expect(formatCancelHistoryMetric("1225846", "money")).toBe("1.225.846 ₭");
    expect(formatCancelHistoryMetric("9", "number")).toBe("9");
    expect(cancelHistoryRange(2, 20, 20, 45)).toEqual({ start: 21, end: 40 });
  });
});

function bill(overrides: Partial<CancelHistoryBill>): CancelHistoryBill {
  return {
    balance: 0,
    branchName: "",
    branchUuid: "",
    cancelReason: "",
    cancelledAt: "",
    cancelledByName: "",
    discountAmount: 0,
    grandTotal: 0,
    invoice: "",
    orderDate: "",
    orderQty: 0,
    orderTotal: 0,
    orderUuid: "",
    paidTotal: 0,
    raw: {},
    serviceAmount: 0,
    statusCode: "",
    statusName: "",
    subtotal: 0,
    tableName: "",
    tableUuid: "",
    vatAmount: 0,
    ...overrides
  };
}

describe("cancel history redesign helpers", () => {
  it("formats cancel dates without timezone shifts and hides the midnight placeholder time", () => {
    expect(cancelHistoryDay("2026-09-15 00:00:00")).toEqual({ key: "2026-09-15", label: "15/09/2026" });
    expect(cancelHistoryClock("2026-09-15 00:00:00")).toBe("");
    expect(cancelHistoryClock("2026-09-15 18:05:00")).toBe("18:05");
    expect(cancelHistoryClock("")).toBe("");
  });

  it("groups consecutive rows by cancel day, falling back to the order date", () => {
    const groups = groupCancelHistoryByDate([
      bill({ orderUuid: "a", cancelledAt: "2026-09-15 00:00:00" }),
      bill({ orderUuid: "b", cancelledAt: "2026-09-15 10:00:00" }),
      bill({ orderUuid: "c", orderDate: "2026-09-14" })
    ]);

    expect(groups.map((group) => [group.label, group.rows.map((row) => row.orderUuid)])).toEqual([
      ["15/09/2026", ["a", "b"]],
      ["14/09/2026", ["c"]]
    ]);
  });

  it("builds quick date ranges from local calendar days", () => {
    const now = new Date(2026, 8, 3, 9);
    expect(cancelHistoryPresetRange("today", now)).toEqual({ startDate: "2026-09-03", endDate: "2026-09-03" });
    expect(cancelHistoryPresetRange("yesterday", now)).toEqual({ startDate: "2026-09-02", endDate: "2026-09-02" });
    expect(cancelHistoryPresetRange("last7", now)).toEqual({ startDate: "2026-08-28", endDate: "2026-09-03" });
    expect(cancelHistoryPresetRange("thisMonth", now)).toEqual({ startDate: "2026-09-01", endDate: "2026-09-03" });
  });

  it("detects which quick range matches the applied dates", () => {
    const now = new Date(2026, 8, 3, 9);
    expect(activeCancelHistoryPreset({ startDate: "2026-09-02", endDate: "2026-09-02" }, now)).toBe("yesterday");
    expect(activeCancelHistoryPreset({ startDate: "2026-07-01", endDate: "2026-09-03" }, now)).toBeNull();
  });

  it("sums the loaded rows", () => {
    expect(
      summarizeCancelHistory([bill({ grandTotal: 165000, orderQty: 4 }), bill({ grandTotal: 35000, orderQty: 1 })])
    ).toEqual({ grandTotal: 200000, qty: 5, rows: 2 });
    expect(summarizeCancelHistory([])).toEqual({ grandTotal: 0, qty: 0, rows: 0 });
  });
});
