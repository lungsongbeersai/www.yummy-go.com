import { describe, expect, it } from "vitest";
import {
  formatReportDate,
  formatReportDateRange,
  formatReportDateTime,
  formatReportSaleDate,
} from "@/features/report/shared/report-date-format";

describe("report date format", () => {
  it("shows a business date day-first without going through a time zone", () => {
    expect(formatReportDate("2026-09-28")).toBe("28/09/2026");
    expect(formatReportDate("2026-01-01")).toBe("01/01/2026");
  });

  it("shows timestamps on the Vientiane (UTC+7) clock", () => {
    // 17:30 UTC is already the next day in Vientiane.
    expect(formatReportDate("2026-09-28T17:30:00.000Z")).toBe("29/09/2026");
    expect(formatReportDateTime("2026-09-28T06:16:54.000Z")).toBe("28/09/2026 13:16:54");
  });

  it("keeps a bare business date free of a made-up time", () => {
    expect(formatReportDateTime("2026-09-28")).toBe("28/09/2026");
  });

  it("drops the midnight the API puts on a sale date, but keeps a real time", () => {
    // 17:00 UTC is 00:00 in Vientiane: the business date at midnight.
    expect(formatReportSaleDate("2026-09-28T17:00:00.000Z")).toBe("29/09/2026");
    expect(formatReportSaleDate("2026-09-29")).toBe("29/09/2026");
    expect(formatReportSaleDate("2026-09-28T06:16:54.000Z")).toBe("28/09/2026 13:16:54");
    expect(formatReportSaleDate("")).toBe("-");
  });

  it("falls back for empty input and passes unparseable text through", () => {
    expect(formatReportDate("")).toBe("-");
    expect(formatReportDate(null, "")).toBe("");
    expect(formatReportDate("not a date")).toBe("not a date");
  });

  it("collapses a one-day range and joins a longer one", () => {
    expect(formatReportDateRange("2026-09-28", "2026-09-28")).toBe("28/09/2026");
    expect(formatReportDateRange("2026-09-01", "2026-09-30")).toBe("01/09/2026 - 30/09/2026");
  });
});
