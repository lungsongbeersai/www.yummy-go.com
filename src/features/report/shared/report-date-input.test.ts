import { describe, expect, it } from "vitest";
import {
  daysInMonth,
  reportDateDisplayValue,
  reportDateParts,
  reportDateValue,
} from "./report-date-input";

describe("report mobile date input", () => {
  it("keeps the API date value in yyyy-mm-dd format", () => {
    expect(reportDateValue({ day: 7, month: 2, year: 2026 })).toBe("2026-02-07");
    expect(reportDateParts("2026-02-07")).toEqual({ day: 7, month: 2, year: 2026 });
  });

  it("shows dates in the same day/month/year order used on the report screen", () => {
    expect(reportDateDisplayValue("2026-08-11")).toBe("11/08/2026");
  });

  it("uses the correct number of days for each selected month", () => {
    expect(daysInMonth(2026, 2)).toBe(28);
    expect(daysInMonth(2028, 2)).toBe(29);
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 8)).toBe(31);
  });
});
