import { describe, expect, it } from "vitest";
import { employeeWorkPdfPageFit } from "./employee-work-pdf";

describe("employee report PDF page capacity", () => {
  it("keeps the exact final row boundary and moves a row that exceeds it", () => {
    expect(employeeWorkPdfPageFit(1030.8, 1030.8, true)).toBe("fits");
    expect(employeeWorkPdfPageFit(1030.81, 1030.8, true)).toBe("next-page");
  });

  it("rejects a row that cannot fit an empty page without generating empty pages", () => {
    expect(employeeWorkPdfPageFit(1031, 1030.8, false)).toBe("too-tall");
    expect(employeeWorkPdfPageFit(0, 1030.8, false)).toBe("fits");
  });

  it("places a final row and totals together on a continuation page", () => {
    const finalRow = 100, totals = 80, continuedContext = 200, capacity = 1000;
    expect(employeeWorkPdfPageFit(900 + finalRow + totals, capacity, true)).toBe("next-page");
    expect(employeeWorkPdfPageFit(continuedContext + finalRow + totals, capacity, false)).toBe("fits");
  });

  it("fails closed when the row and totals cannot fit together on an empty page", () => {
    expect(employeeWorkPdfPageFit(200 + 790 + 80, 1000, false)).toBe("too-tall");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, -1])("rejects invalid measured height %s", height => {
    expect(employeeWorkPdfPageFit(height, 1030.8, true)).toBe("too-tall");
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, 0, -1])("rejects invalid page capacity %s", capacity => {
    expect(employeeWorkPdfPageFit(100, capacity, true)).toBe("too-tall");
  });
});
