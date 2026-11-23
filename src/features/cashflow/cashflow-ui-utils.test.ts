import { describe, expect, it } from "vitest";
import {
  cashflowAmountValue,
  formatCashflowDate,
  isCashflowDate,
  validCashflowDateRange,
} from "./cashflow-ui-utils";

describe("cashflow form values", () => {
  it("requires positive exact money amounts with at most two decimal places", () => {
    expect(cashflowAmountValue("12000")).toBe(12000);
    expect(cashflowAmountValue("120.50")).toBe(120.5);
    for (const invalid of [
      "",
      "0",
      "-5",
      "1.005",
      "1e3",
      "Infinity",
      "120,000",
      "9007199254740992",
    ]) {
      expect(cashflowAmountValue(invalid)).toBeNull();
    }
  });

  it("rejects invalid calendar dates and reversed ranges", () => {
    expect(isCashflowDate("2028-02-29")).toBe(true);
    expect(isCashflowDate("2026-02-29")).toBe(false);
    expect(validCashflowDateRange("2026-11-01", "2026-11-23")).toBe(true);
    expect(validCashflowDateRange("2026-11-23", "2026-11-01")).toBe(false);
    expect(validCashflowDateRange("2026-11-01", "2026-13-01")).toBe(false);
  });

  it("preserves a calendar entry date instead of shifting with host timezone", () => {
    expect(formatCashflowDate("2026-11-23", "en")).toBe("23 Nov 2026");
  });
});
