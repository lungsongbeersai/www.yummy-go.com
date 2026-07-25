import { describe, expect, it } from "vitest";
import { chooseReportPdfPageEnd } from "./pdf";

describe("chooseReportPdfPageEnd", () => {
  it("uses the full remaining canvas when it fits on the page", () => {
    expect(
      chooseReportPdfPageEnd(0, 1200, 1200, { fallback: [500], preferred: [400] }),
    ).toBe(1200);
  });

  it("prefers the last group boundary that fits on the page", () => {
    expect(
      chooseReportPdfPageEnd(0, 1000, 3000, {
        fallback: [300, 600, 950, 990],
        preferred: [400, 900, 1100],
      }),
    ).toBe(900);
  });

  it("falls back to the last row edge when no group boundary fits", () => {
    expect(
      chooseReportPdfPageEnd(0, 1000, 3000, {
        fallback: [300, 600, 950],
        preferred: [1100],
      }),
    ).toBe(950);
  });

  it("keeps at least a minimum useful slice before breaking", () => {
    // ขอบเขตที่อยู่ตื้นกว่า pageStart + 120 ถูกข้าม เพื่อไม่ให้ได้หน้าที่สูงไม่กี่พิกเซล
    expect(
      chooseReportPdfPageEnd(800, 1800, 3000, {
        fallback: [850, 900],
        preferred: [880],
      }),
    ).toBe(1800);
  });
});
