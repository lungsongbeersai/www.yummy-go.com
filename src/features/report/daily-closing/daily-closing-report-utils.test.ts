import { describe, expect, it } from "vitest";
import type { DailyStoreClosingReport } from "@/stores/report-store";
import {
  dailyClosingLabel,
  dailyClosingFilterError,
  dailyClosingFiltersEqual,
  dailyClosingPeriodDisplay,
  dailyClosingPrintPeriod,
  dailyClosingReportItemCount,
  dailyClosingTimeParams,
  initialDailyClosingFilters,
  normalizeDailyClosingBranchFilters,
} from "./daily-closing-report-utils";
import type { DailyClosingReportFilters } from "./daily-closing-report-types";

function reportFixture(): DailyStoreClosingReport {
  return {
    cancelSummary: { billCount: 0, totalAmount: 0 },
    filters: { branchUuid: "branch-1", date: "2026-07-10", lang: "la" },
    groups: [
      {
        discountAmount: 0,
        items: [
          {
            discountAmount: 0,
            key: "item-1",
            productName: "Tea",
            toppings: [],
            totalAmount: 5000,
            totalQty: 1,
            unitPrice: 5000,
          },
          {
            discountAmount: 0,
            key: "item-2",
            productName: "Coffee",
            toppings: [],
            totalAmount: 7000,
            totalQty: 1,
            unitPrice: 7000,
          },
        ],
        key: "group-1",
        name: "Drinks",
        totalAmount: 12000,
        totalQty: 0,
      },
    ],
    orderChannels: [],
    labels: {
      cancelAmount: "",
      cancelBill: "",
      cash: "",
      credit: "",
      discountAmount: "",
      grandTotal: "",
      groupTotal: "",
      noGroup: "",
      paymentTotal: "",
      reportName: "",
      serviceCharge: "",
      totalAmount: "",
      totalQty: "",
      transfer: "",
      vat: "",
    },
    paymentSummary: { cash: 11500, credit: 0, paymentTotal: 12000, transfer: 500 },
    summary: {
      discountAmount: 0,
      grandTotal: 11500,
      serviceCharge: 0,
      totalAmount: 11500,
      totalQty: 2,
      vat: 0,
    },
  };
}

describe("daily closing report utils", () => {
  it("counts item rows without treating topping quantities as product quantities", () => {
    expect(dailyClosingReportItemCount(reportFixture())).toBe(2);
  });

  it("uses API labels when present and falls back for blank labels", () => {
    expect(dailyClosingLabel(" Cash ", "Fallback")).toBe("Cash");
    expect(dailyClosingLabel("   ", "Fallback")).toBe("Fallback");
  });
});

describe("daily closing branch normalization", () => {
  const filters: DailyClosingReportFilters = {
    branchUuid: "branch-old", zoneUuid: "zone-old", tableUuid: "table-old",
    dateFrom: "2026-10-21", dateTo: "2026-10-22",
    timeFrom: "20:00", timeTo: "02:30",
  };

  it("clears the previous branch's zone and table when branch access selects a new branch", () => {
    const normalized = normalizeDailyClosingBranchFilters(filters, (current) => ({
      ...current, branchUuid: "branch-current",
    }));

    expect(normalized).toEqual({
      ...filters, branchUuid: "branch-current", zoneUuid: "all", tableUuid: "all",
    });
    expect(filters).toMatchObject({ branchUuid: "branch-old", zoneUuid: "zone-old", tableUuid: "table-old" });
  });

  it("preserves location selections when branch normalization keeps the selected branch", () => {
    expect(normalizeDailyClosingBranchFilters(filters, (current) => current)).toBe(filters);
    expect(normalizeDailyClosingBranchFilters(filters, (current) => ({ ...current }))).toEqual(filters);
  });
});

describe("daily closing payment time range", () => {
  const filters: DailyClosingReportFilters = {
    branchUuid: "branch-1", tableUuid: "all", zoneUuid: "all",
    dateFrom: "2026-10-21", dateTo: "2026-10-21",
    timeFrom: "00:00", timeTo: "23:59",
  };

  it("uses all four visible fields for the initial payment query and receipt", () => {
    const initial = initialDailyClosingFilters("branch-1", new Date("2026-10-21T10:00:00Z"));
    expect(initial).toEqual(filters);
    expect(dailyClosingTimeParams(initial)).toEqual({ time_from: "00:00", time_to: "23:59" });
    expect(dailyClosingFilterError(initial)).toBeNull();
    expect(dailyClosingPeriodDisplay(initial)).toBe("21/10/2026 00:00 - 21/10/2026 23:59");
    expect(dailyClosingPrintPeriod(initial)).toEqual({ from: "21/10/2026 00:00", to: "21/10/2026 23:59" });
  });

  it.each([
    ["2026-10-21T16:59:59Z", "2026-10-21"],
    ["2026-10-21T17:00:00Z", "2026-10-22"],
    ["2026-10-21T20:00:00Z", "2026-10-22"],
    ["2026-12-31T17:00:00Z", "2027-01-01"],
  ])("defaults to the Laos calendar date even before the business-day cutoff: %s", (instant, expectedDate) => {
    expect(initialDailyClosingFilters("branch-1", new Date(instant))).toMatchObject({
      dateFrom: expectedDate, dateTo: expectedDate, timeFrom: "00:00", timeTo: "23:59",
    });
  });

  it("sends a continuous calendar window and shows both exact endpoints on the receipt", () => {
    const custom = { ...filters, timeFrom: "20:00", dateTo: "2026-10-22", timeTo: "02:30" };
    expect(dailyClosingFilterError(custom)).toBeNull();
    expect(dailyClosingTimeParams(custom)).toEqual({ time_from: "20:00", time_to: "02:30" });
    expect(dailyClosingPeriodDisplay(custom)).toBe("21/10/2026 20:00 - 22/10/2026 02:30");
    expect(dailyClosingPrintPeriod(custom)).toEqual({ from: "21/10/2026 20:00", to: "22/10/2026 02:30" });
  });

  it("provides separate intact printable endpoints without changing the page's combined period", () => {
    const custom = { ...filters, timeFrom: "23:59", timeTo: "23:59" };
    const period = dailyClosingPrintPeriod(custom);
    expect(period).toEqual({ from: "21/10/2026 23:59", to: "21/10/2026 23:59" });
    expect(dailyClosingPeriodDisplay(custom)).toBe(`${period?.from} - ${period?.to}`);
    expect(dailyClosingPrintPeriod({ ...custom, timeFrom: "" })).toBeUndefined();
    expect(dailyClosingPrintPeriod({ ...custom, timeTo: "22:00" })).toBeUndefined();
  });

  it("allows a single inclusive minute and the final minute of the selected calendar date", () => {
    expect(dailyClosingFilterError({ ...filters, timeFrom: "09:15", timeTo: "09:15" })).toBeNull();
    expect(dailyClosingFilterError(filters)).toBeNull();
    expect(dailyClosingFilterError({ ...filters, timeFrom: "23:59", timeTo: "23:59" })).toBeNull();
  });

  it("requires an explicit later end date for overnight times", () => {
    const custom = { ...filters, timeFrom: "20:00", timeTo: "02:30" };
    expect(dailyClosingFilterError(custom)).toBe("range");
    expect(dailyClosingPeriodDisplay(custom)).toBe("");
    expect(dailyClosingFilterError({ ...custom, dateTo: "2026-10-22" })).toBeNull();
  });

  it.each(["", "24:00", "09:60", "9:00", "09:00:30"])("rejects incomplete or invalid custom clock values: %s", (time) => {
    expect(dailyClosingFilterError({ ...filters, timeFrom: time })).toBe("time");
    expect(dailyClosingFilterError({ ...filters, timeTo: time })).toBe("time");
  });

  it("requires both visible clocks instead of silently querying a different date window", () => {
    expect(dailyClosingFilterError({ ...filters, timeFrom: "", timeTo: "" })).toBe("time");
    expect(dailyClosingPeriodDisplay({ ...filters, timeFrom: "", timeTo: "" })).toBe("");
  });

  it("rejects impossible/reversed calendar dates independently of browser timezone", () => {
    expect(dailyClosingFilterError({ ...filters, dateFrom: "2026-02-30" })).toBe("date");
    expect(dailyClosingFilterError({ ...filters, dateTo: "2026-10-20" })).toBe("date");
    expect(dailyClosingFilterError({ ...filters, dateFrom: "2028-02-29", dateTo: "2028-02-29" })).toBeNull();
  });

  it("reloads when either visible clock changes, keeping the query and displayed period aligned", () => {
    expect(dailyClosingFiltersEqual(filters, { ...filters, timeFrom: "08:00" })).toBe(false);
    expect(dailyClosingFiltersEqual(filters, { ...filters, timeTo: "18:00" })).toBe(false);
    expect(dailyClosingFiltersEqual(filters, { ...filters })).toBe(true);
    expect(dailyClosingPeriodDisplay({ ...filters, timeFrom: "08:00", timeTo: "18:00" }))
      .toBe("21/10/2026 08:00 - 21/10/2026 18:00");
  });
});
