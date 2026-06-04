import { describe, expect, it } from "vitest";
import {
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
