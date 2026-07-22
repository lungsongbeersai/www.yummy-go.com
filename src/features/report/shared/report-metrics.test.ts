import { describe, expect, it } from "vitest";
import { displayMetric, formatNumber, metricNumber } from "./report-metrics";

describe("formatNumber", () => {
  it("formats a numeric value with thousands separators", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("treats missing or non-numeric values as zero", () => {
    expect(formatNumber(null)).toBe("0");
    expect(formatNumber(undefined)).toBe("0");
    expect(formatNumber("not-a-number")).toBe("0");
  });
});

describe("displayMetric", () => {
  it("formats money with the currency suffix", () => {
    expect(displayMetric(15000, "money")).toBe("15.000 ₭");
  });

  it("formats percent with up to two decimal digits", () => {
    expect(displayMetric(12.345, "percent")).toBe("12.35%");
  });

  it("falls back to plain number formatting", () => {
    expect(displayMetric(3200, "number")).toBe("3,200");
  });
});

describe("metricNumber", () => {
  it("coerces a numeric-looking value to a number", () => {
    expect(metricNumber("42")).toBe(42);
    expect(metricNumber(42)).toBe(42);
  });

  // ค่าจาก backend อาจเป็น null/undefined/NaN — ต้องไม่พังการคำนวณ/class ต่อ
  it("falls back to zero for null, undefined, and NaN", () => {
    expect(metricNumber(null)).toBe(0);
    expect(metricNumber(undefined)).toBe(0);
    expect(metricNumber("not-a-number")).toBe(0);
  });
});
