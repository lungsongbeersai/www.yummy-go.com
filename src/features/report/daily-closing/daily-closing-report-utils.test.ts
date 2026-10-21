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

describe("daily closing payment time range", () => {
  const filters: DailyClosingReportFilters = {
    branchUuid: "branch-1", tableUuid: "all", zoneUuid: "all",
    dateFrom: "2026-10-21", dateTo: "2026-10-21",
    customTimeRange: false, timeFrom: "00:00", timeTo: "23:59",
  };

  it("omits both time keys and retains legacy receipt dates while custom time is off", () => {
    const legacy = { ...filters, timeFrom: "", timeTo: "" };
    expect(dailyClosingTimeParams(legacy)).toEqual({});
    expect(dailyClosingFilterError(legacy)).toBeNull();
    expect(dailyClosingPeriodDisplay(legacy)).toBe("21/10/2026");
    expect(dailyClosingPrintPeriod(legacy)).toBeUndefined();
    expect(dailyClosingPeriodDisplay({ ...legacy, dateTo: "2026-10-23" })).toBe("21/10/2026 - 23/10/2026");
  });

  it("sends a continuous calendar window and shows both exact endpoints on the receipt", () => {
    const custom = { ...filters, customTimeRange: true, timeFrom: "20:00", dateTo: "2026-10-22", timeTo: "02:30" };
    expect(dailyClosingFilterError(custom)).toBeNull();
    expect(dailyClosingTimeParams(custom)).toEqual({ time_from: "20:00", time_to: "02:30" });
    expect(dailyClosingPeriodDisplay(custom)).toBe("21/10/2026 20:00 - 22/10/2026 02:30");
    expect(dailyClosingPrintPeriod(custom)).toEqual({ from: "21/10/2026 20:00", to: "22/10/2026 02:30" });
  });

  it("provides separate intact printable endpoints without changing the page's combined period", () => {
    const custom = { ...filters, customTimeRange: true, timeFrom: "23:59", timeTo: "23:59" };
    const period = dailyClosingPrintPeriod(custom);
    expect(period).toEqual({ from: "21/10/2026 23:59", to: "21/10/2026 23:59" });
    expect(dailyClosingPeriodDisplay(custom)).toBe(`${period?.from} - ${period?.to}`);
    expect(dailyClosingPrintPeriod({ ...custom, timeFrom: "" })).toBeUndefined();
    expect(dailyClosingPrintPeriod({ ...custom, timeTo: "22:00" })).toBeUndefined();
    expect(dailyClosingPrintPeriod({ ...custom, customTimeRange: false })).toBeUndefined();
  });

  it("allows a single inclusive minute and the final minute of the selected calendar date", () => {
    expect(dailyClosingFilterError({ ...filters, customTimeRange: true, timeFrom: "09:15", timeTo: "09:15" })).toBeNull();
    expect(dailyClosingFilterError({ ...filters, customTimeRange: true })).toBeNull();
    expect(dailyClosingFilterError({ ...filters, customTimeRange: true, timeFrom: "23:59", timeTo: "23:59" })).toBeNull();
  });

  it("requires an explicit later end date for overnight times", () => {
    const custom = { ...filters, customTimeRange: true, timeFrom: "20:00", timeTo: "02:30" };
    expect(dailyClosingFilterError(custom)).toBe("range");
    expect(dailyClosingPeriodDisplay(custom)).toBe("");
    expect(dailyClosingFilterError({ ...custom, dateTo: "2026-10-22" })).toBeNull();
  });

  it.each(["", "24:00", "09:60", "9:00", "09:00:30"])("rejects incomplete or invalid custom clock values: %s", (time) => {
    expect(dailyClosingFilterError({ ...filters, customTimeRange: true, timeFrom: time })).toBe("time");
    expect(dailyClosingFilterError({ ...filters, customTimeRange: true, timeTo: time })).toBe("time");
  });

  it("rejects impossible/reversed calendar dates independently of browser timezone", () => {
    expect(dailyClosingFilterError({ ...filters, dateFrom: "2026-02-30" })).toBe("date");
    expect(dailyClosingFilterError({ ...filters, dateTo: "2026-10-20" })).toBe("date");
    expect(dailyClosingFilterError({ ...filters, dateFrom: "2028-02-29", dateTo: "2028-02-29" })).toBeNull();
  });

  it("detects changes to applied custom times without treating hidden time drafts as active filters", () => {
    expect(dailyClosingFiltersEqual(filters, { ...filters, timeFrom: "08:00" })).toBe(true);
    const custom = { ...filters, customTimeRange: true };
    expect(dailyClosingFiltersEqual(filters, custom)).toBe(false);
    expect(dailyClosingFiltersEqual(custom, { ...custom, timeFrom: "08:00" })).toBe(false);
    expect(dailyClosingFiltersEqual(custom, { ...custom })).toBe(true);
    expect(dailyClosingPeriodDisplay({ ...custom, customTimeRange: false })).toBe("21/10/2026");
  });
});
