import { Fragment, createElement } from "react";
import { describe, expect, it } from "vitest";
import {
  applyPeriodMonth,
  applyPeriodMonthEnd,
  applyPeriodType,
  applyPeriodYear,
  applyPeriodYearEnd,
  createDashboardModel,
  bucketTrendRows,
  buildLedgerSteps,
  createDefaultFilters,
  cumulativeShares,
  formatApiMoney,
  kipFigureSize,
  paretoCount,
  paymentSplit,
  plottedRevenue,
  seatSummary,
  skylineColumns,
  sparklinePath,
  sparklineValues,
  splitMoneyString,
  unsplitRevenue,
  yearSelectOptions,
  type TrendPoint
} from "./dashboard-view-model";

const emptySubLabel = createElement(Fragment);

function dashboardData(overrides: Record<string, unknown> = {}) {
  return {
    charts: {
      monthly_daily_payments: [
        {
          business_date: "2026-06-01",
          cash_total: 20,
          day: "01",
          mixed_total: 5,
          orders_count: 2,
          paid_total: 25,
          revenue_total: 100,
          transfer_total: 75
        }
      ],
      monthly_daily_sales: [
        {
          business_date: "2026-06-01",
          day: "01",
          orders_count: 4,
          revenue_total: 1000
        }
      ],
      monthly_sales_pie: [
        { key: "cash", label: "Cash", value: 120 },
        { key: "transfer", label: "Transfer", value: 80 }
      ],
      order_channel_chart: [],
      top_selling_products_chart: []
    },
    dashboard_sections: {
      rank_1_sales_payment_summary: {
        accounting_summary: [
          { key: "sales", label: "Sales", value: 1000 },
          { important: true, key: "net", label: "Net", value: 900 }
        ],
        chart_source_key: "charts.missing_sales",
        payment_chart_source_key: "charts.missing_payments",
        payment_lines: []
      }
    },
    filters: {},
    insights: {},
    kpis: {},
    order_channel_summary: {
      channels: [
        {
          channel_code: "dine_in",
          channel_name: "Dine in",
          orders_count: 4,
          revenue_total: 500
        }
      ]
    },
    request_params: {
      top: "1"
    },
    tables: {
      summary: {}
    },
    top_selling_products: [
      {
        prod_name: "Noodle",
        prod_uuid: "prod-1",
        qty_total: 9,
        revenue_total: 450
      },
      {
        prod_name: "Rice",
        prod_uuid: "prod-2",
        qty_total: 4,
        revenue_total: 200
      }
    ],
    warnings: {
      low_stock: "Low stock",
      missing: ""
    },
    ...overrides
  };
}

describe("dashboard view model", () => {
  it("uses fallback chart sources for payment, channel, product, and trend rows", () => {
    const model = createDashboardModel(dashboardData(), createDefaultFilters());

    expect(model.paymentRows).toMatchObject([
      { key: "cash", label: "Cash", value: 120 },
      { key: "transfer", label: "Transfer", value: 80 }
    ]);
    expect(model.channelRows).toMatchObject([
      { count: 4, key: "dine_in", label: "Dine in", value: 500 }
    ]);
    expect(model.productRows).toMatchObject([
      { key: "prod-1", name: "Noodle", qty: 9, rank: 1, revenue: 450 }
    ]);
    expect(model.trendRows).toMatchObject([
      { date: "2026-06-01", day: "01", orders: 4, revenue: 1000 }
    ]);
    expect(model.paymentTrendRows).toMatchObject([
      { cash: 20, date: "2026-06-01", day: "01", mixed: 5, paid: 25, transfer: 75 }
    ]);
  });

  it("reads each day's debt for the payment lines", () => {
    const model = createDashboardModel(
      dashboardData({
        charts: {
          monthly_daily_payments: [
            { business_date: "2026-09-05", cash_total: 8143000, day: "5", debt_total: 1194000, transfer_total: 0 }
          ]
        }
      }),
      createDefaultFilters()
    );

    expect(model.paymentTrendRows).toMatchObject([{ cash: 8143000, debt: 1194000, transfer: 0 }]);
  });

  it("defaults both daily dates to the current business date", () => {
    expect(createDefaultFilters(new Date(2026, 5, 11, 12))).toEqual({
      end_date: "2026-06-11",
      periodMonth: 6,
      periodMonthEnd: 6,
      periodType: "daily",
      periodYear: 2026,
      periodYearEnd: 2026,
      start_date: "2026-06-11"
    });
  });

  it("keeps both default dates equal at month and year boundaries", () => {
    expect(createDefaultFilters(new Date(2026, 2, 3, 12))).toMatchObject({
      end_date: "2026-03-03",
      start_date: "2026-03-03"
    });
    expect(createDefaultFilters(new Date(2027, 0, 2, 12))).toMatchObject({
      end_date: "2027-01-02",
      periodMonth: 1,
      periodYear: 2027,
      start_date: "2027-01-02"
    });
  });

  it("uses the previous business date through 05:59:59", () => {
    expect(createDefaultFilters(new Date("2026-08-25T22:59:59.000Z"))).toEqual({
      end_date: "2026-08-25",
      periodMonth: 8,
      periodMonthEnd: 8,
      periodType: "daily",
      periodYear: 2026,
      periodYearEnd: 2026,
      start_date: "2026-08-25"
    });
  });

  it("keeps payment summary total cards while excluding totals from payment rows", () => {
    const paymentLines = [
      { important: true, key: "payment_total", label: "Total sales", value: 17046975 },
      { key: "cash", label: "Cash", value: 15204970 },
      { key: "transfer", label: "Transfer", value: 411950 },
      { key: "debt", label: "Debt", value: 1430055 }
    ];
    const model = createDashboardModel(
      dashboardData({
        dashboard_sections: {
          rank_1_sales_payment_summary: {
            accounting_summary: [],
            chart_source_key: "charts.missing_sales",
            payment_chart_source_key: "charts.missing_payments",
            payment_lines: paymentLines
          }
        }
      }),
      createDefaultFilters()
    );

    expect(model.paymentSummaryCards).toMatchObject(paymentLines);
    expect(model.paymentRows.map((row) => row.key)).toEqual(["cash", "transfer", "debt"]);
  });

  it("uses request top first and then report top for product row limits", () => {
    const filters = createDefaultFilters(new Date(2026, 5, 11, 12));
    const products = [
      { prod_name: "A", prod_uuid: "a", qty_total: 10, revenue_total: 100 },
      { prod_name: "B", prod_uuid: "b", qty_total: 9, revenue_total: 90 },
      { prod_name: "C", prod_uuid: "c", qty_total: 8, revenue_total: 80 }
    ];

    const requestTopModel = createDashboardModel(
      dashboardData({
        charts: {
          top_selling_products_chart: products
        },
        request_params: {
          top: "1"
        }
      }),
      filters,
      "2"
    );
    const filterTopModel = createDashboardModel(
      dashboardData({
        charts: {
          top_selling_products_chart: products
        },
        request_params: {}
      }),
      filters,
      "2"
    );

    expect(requestTopModel.productRows).toHaveLength(1);
    expect(filterTopModel.productRows).toHaveLength(2);
  });

  it("keeps only warnings that carry a message", () => {
    const model = createDashboardModel(dashboardData(), createDefaultFilters());

    expect(model.warnings).toEqual([{ key: "low_stock", value: "Low stock" }]);
  });

  it("normalizes mixed payment summary and maps payment warning copy keys", () => {
    const model = createDashboardModel(
      dashboardData({
        charts: {
          payment_summary: {
            cash_total: 15204970,
            debt_total: 1430055,
            has_mixed_split_columns: false,
            mixed_cash_column: null,
            mixed_total: 3734937,
            mixed_transfer_column: null,
            total: 17046975,
            transfer_total: 411950,
            unallocated_mixed_total: 3734937
          }
        },
        warnings: {
          payment_split: "payment_split_warning"
        }
      }),
      createDefaultFilters()
    );

    expect(model.paymentSummary).toMatchObject({
      hasMixedSplitColumns: false,
      mixedTotal: 3734937,
      total: 17046975,
      unallocatedMixedTotal: 3734937
    });
    expect(model.warnings).toEqual([
      { copyKey: "paymentSplitWarning", key: "payment_split", value: "payment_split_warning" }
    ]);
  });

  it("keeps channel order and revenue shares separately", () => {
    const model = createDashboardModel(
      dashboardData({
        charts: {
          order_channel_chart: [
            {
              channel_code: "dine_in",
              channel_name: "Dine-in",
              orders_count: 30,
              orders_percent: 85.71,
              revenue_percent: 78.34,
              revenue_total: 13631062
            },
            {
              channel_code: "takeaway",
              channel_name: "Takeaway",
              orders_count: 4,
              orders_percent: 11.43,
              revenue_percent: 20.8,
              revenue_total: 3619664
            }
          ]
        }
      }),
      createDefaultFilters()
    );

    expect(model.channelRows[0]).toMatchObject({
      count: 30,
      key: "dine_in",
      label: "Dine-in",
      orderPercent: 85.71,
      percent: 78.34,
      revenuePercent: 78.34
    });
  });

  it("normalizes product images and highest revenue product", () => {
    const model = createDashboardModel(
      dashboardData({
        charts: {
          top_selling_products_chart: [
            {
              prod_image: "https://cdn.test/noodle.jpg",
              prod_name: "Noodle",
              prod_status_imge: 1,
              prod_uuid: "prod-1",
              qty_total: 9,
              revenue_total: 450
            },
            {
              prod_image: "https://cdn.test/fish.jpg",
              prod_name: "Fish",
              prod_status_imge: 0,
              prod_uuid: "prod-2",
              qty_total: 4,
              revenue_total: 900
            }
          ]
        },
        request_params: {
          top: "2"
        }
      }),
      createDefaultFilters()
    );

    expect(model.productRows).toMatchObject([
      { hasImage: true, image: "https://cdn.test/noodle.jpg", key: "prod-1" },
      { hasImage: false, image: "https://cdn.test/fish.jpg", key: "prod-2" }
    ]);
    expect(model.highestRevenueProduct).toMatchObject({ key: "prod-2", revenue: 900 });
  });

  it("normalizes main order channel and peak revenue day", () => {
    const model = createDashboardModel(
      dashboardData({
        charts: {
          monthly_daily_sales: [
            { business_date: "2026-06-01", day: "01", orders_count: 2, revenue_total: 1000 },
            { business_date: "2026-06-02", day: "02", orders_count: 5, revenue_total: 2500 }
          ]
        },
        insights: {
          main_order_channel: {
            channel_code: "dine_in",
            channel_name: "Dine-in",
            orders_count: 30,
            orders_percent: 85.71,
            revenue_percent: 78.34,
            revenue_total: 13631062
          }
        }
      }),
      createDefaultFilters()
    );

    expect(model.mainOrderChannel).toMatchObject({
      key: "dine_in",
      label: "Dine-in",
      orderPercent: 85.71,
      revenuePercent: 78.34,
      value: 13631062
    });
    expect(model.peakRevenueDay).toMatchObject({
      date: "2026-06-02",
      orders: 5,
      revenue: 2500
    });
  });
});

describe("dashboard period type filters", () => {
  const dailyFilters = createDefaultFilters(new Date(2026, 5, 11, 12));

  it("keeps a manual date range untouched while on the daily period", () => {
    const filters = applyPeriodType({ ...dailyFilters, start_date: "2026-06-05" }, "daily");

    expect(filters).toMatchObject({
      end_date: "2026-06-11",
      periodType: "daily",
      start_date: "2026-06-05"
    });
  });

  it("fills the whole month when switching to the monthly period", () => {
    const filters = applyPeriodType(dailyFilters, "monthly");

    expect(filters).toMatchObject({
      end_date: "2026-06-30",
      periodMonth: 6,
      periodType: "monthly",
      periodYear: 2026,
      start_date: "2026-06-01"
    });
  });

  it("accounts for leap years when recomputing a February month range", () => {
    const filters = applyPeriodMonth(
      { ...dailyFilters, periodMonth: 2, periodMonthEnd: 2, periodType: "monthly", periodYear: 2024 },
      2
    );

    expect(filters).toMatchObject({ end_date: "2024-02-29", start_date: "2024-02-01" });
  });

  it("fills January 1 - December 31 when switching to the yearly period", () => {
    const filters = applyPeriodType({ ...dailyFilters, periodYear: 2024, periodYearEnd: 2024 }, "yearly");

    expect(filters).toMatchObject({
      end_date: "2024-12-31",
      periodType: "yearly",
      start_date: "2024-01-01"
    });
  });

  it("recomputes the yearly range when the selected year changes", () => {
    const yearly = applyPeriodType({ ...dailyFilters, periodYear: 2024, periodYearEnd: 2024 }, "yearly");
    const filters = applyPeriodYear(yearly, 2025);

    expect(filters).toMatchObject({
      end_date: "2025-12-31",
      periodYear: 2025,
      start_date: "2025-01-01"
    });
  });

  it("does not touch dates when changing year or month outside their matching period", () => {
    expect(applyPeriodYear(dailyFilters, 2030)).toMatchObject({
      end_date: dailyFilters.end_date,
      start_date: dailyFilters.start_date
    });
    expect(applyPeriodMonth(dailyFilters, 9)).toMatchObject({
      end_date: dailyFilters.end_date,
      start_date: dailyFilters.start_date
    });
  });

  it("spans from the first day of the start month to the last day of the end month", () => {
    const monthly = applyPeriodType({ ...dailyFilters, periodYear: 2024 }, "monthly");
    const filters = applyPeriodMonthEnd(applyPeriodMonth(monthly, 1), 2);

    expect(filters).toMatchObject({
      end_date: "2024-02-29",
      periodMonth: 1,
      periodMonthEnd: 2,
      start_date: "2024-01-01"
    });
  });

  it("keeps the month range in the selected year when the year changes", () => {
    const monthly = applyPeriodMonthEnd(applyPeriodMonth(applyPeriodType(dailyFilters, "monthly"), 3), 5);

    expect(applyPeriodYear(monthly, 2025)).toMatchObject({ end_date: "2025-05-31", start_date: "2025-03-01" });
  });

  it("never lets the month range invert", () => {
    const monthly = applyPeriodMonthEnd(applyPeriodMonth(applyPeriodType(dailyFilters, "monthly"), 3), 5);

    // Start moved past the end: the end follows it.
    expect(applyPeriodMonth(monthly, 8)).toMatchObject({
      end_date: "2026-08-31",
      periodMonth: 8,
      periodMonthEnd: 8,
      start_date: "2026-08-01"
    });
    // End moved before the start: the start follows it.
    expect(applyPeriodMonthEnd(monthly, 1)).toMatchObject({
      end_date: "2026-01-31",
      periodMonth: 1,
      periodMonthEnd: 1,
      start_date: "2026-01-01"
    });
  });

  it("spans January 1 of the start year to December 31 of the end year", () => {
    const yearly = applyPeriodType({ ...dailyFilters, periodYear: 2023, periodYearEnd: 2023 }, "yearly");

    expect(applyPeriodYearEnd(yearly, 2025)).toMatchObject({
      end_date: "2025-12-31",
      periodYear: 2023,
      periodYearEnd: 2025,
      start_date: "2023-01-01"
    });
  });

  it("never lets the year range invert", () => {
    const yearly = applyPeriodYearEnd(applyPeriodType({ ...dailyFilters, periodYear: 2023 }, "yearly"), 2025);

    expect(applyPeriodYear(yearly, 2026)).toMatchObject({
      end_date: "2026-12-31",
      periodYearEnd: 2026,
      start_date: "2026-01-01"
    });
    expect(applyPeriodYearEnd(yearly, 2022)).toMatchObject({
      end_date: "2022-12-31",
      periodYear: 2022,
      start_date: "2022-01-01"
    });
  });

  it("builds a descending list of year options centered on the given year", () => {
    expect(yearSelectOptions(2026, 3)).toEqual([
      { label: "2026", value: "2026" },
      { label: "2025", value: "2025" },
      { label: "2024", value: "2024" },
      { label: "2023", value: "2023" }
    ]);
  });
});

function trendPoint(overrides: Partial<TrendPoint> & { date: string }): TrendPoint {
  return {
    balance: 0,
    cash: 0,
    day: overrides.date.slice(8, 10),
    debt: 0,
    mixed: 0,
    orders: 0,
    paid: 0,
    revenue: 0,
    transfer: 0,
    ...overrides
  };
}

function daysFrom(start: string, count: number, revenue = (index: number) => 100 + index) {
  const [year, month, day] = start.split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(year, month - 1, day + index);
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return trendPoint({ date: iso, orders: 2, revenue: revenue(index) });
  });
}

describe("dashboard presentation helpers", () => {
  it("prints Kip spellings as ₭ and keeps other units", () => {
    expect(formatApiMoney(1250000, "LAK")).toBe("1,250,000 ₭");
    expect(formatApiMoney(1250000, "")).toBe("1,250,000 ₭");
    expect(formatApiMoney(99, "USD")).toBe("99 USD");
  });

  it("splits a formatted money string into figure and unit", () => {
    expect(splitMoneyString("25,480,000 ₭")).toEqual({ number: "25,480,000", unit: "₭" });
    expect(splitMoneyString("99 USD")).toEqual({ number: "99", unit: "USD" });
    expect(splitMoneyString("1,000")).toEqual({ number: "1,000", unit: "" });
    expect(splitMoneyString("n/a")).toBeNull();
  });

  it("steps headline figures down past 11 digits", () => {
    expect(kipFigureSize("99,999,999,999")).toBe("default");
    expect(kipFigureSize("125,480,000,000")).toBe("long");
  });

  it("keeps up to 62 days as days, then sums weeks, then months", () => {
    expect(bucketTrendRows(daysFrom("2026-10-01", 62))).toMatchObject({ kind: "day" });
    expect(bucketTrendRows(daysFrom("2026-10-01", 62)).rows).toHaveLength(62);

    const weekly = bucketTrendRows(daysFrom("2026-01-05", 70, () => 10));
    expect(weekly.kind).toBe("week");
    expect(weekly.rows).toHaveLength(10);
    expect(weekly.rows[0]).toMatchObject({ key: "2026-01-05", label: "05/01", orders: 14, revenue: 70 });

    const monthly = bucketTrendRows(daysFrom("2025-01-01", 401, () => 1));
    expect(monthly.kind).toBe("month");
    expect(monthly.rows[0]).toMatchObject({ key: "2025-01", label: "01/2025", revenue: 31 });
    expect(monthly.rows).toHaveLength(14);
  });

  it("draws skyline columns from sales rows with the owed cap from payment rows", () => {
    const sales = [
      trendPoint({ date: "2026-10-01", revenue: 200 }),
      trendPoint({ date: "2026-10-02", revenue: 400 }),
      trendPoint({ date: "2026-10-03", revenue: 0 })
    ];
    const payments = [
      trendPoint({ date: "2026-10-01", cash: 150, debt: 50 }),
      trendPoint({ date: "2026-10-02", debt: 900, transfer: 400 })
    ];

    expect(skylineColumns(sales, payments, "2026-10-02")).toEqual([
      { height: 50, isPeak: false, key: "2026-10-01", owedPercent: 25 },
      { height: 100, isPeak: true, key: "2026-10-02", owedPercent: 100 },
      { height: 0, isPeak: false, key: "2026-10-03", owedPercent: 0 }
    ]);
  });

  it("falls back to payment rows for the skyline and sums their methods as revenue", () => {
    const payments = [trendPoint({ cash: 30, date: "2026-10-01", debt: 10, transfer: 60 })];

    expect(skylineColumns([], payments, null)).toEqual([
      { height: 100, isPeak: false, key: "2026-10-01", owedPercent: 10 }
    ]);
  });

  it("splits payments in a fixed order and surfaces what the methods do not cover", () => {
    const cards = [
      { important: false, key: "transfer", label: "Transfer", subLabel: emptySubLabel, value: 30 },
      { important: false, key: "cash", label: "Cash", subLabel: emptySubLabel, value: 50 },
      { important: true, key: "total", label: "Total", subLabel: emptySubLabel, value: 100 }
    ];

    const split = paymentSplit(cards);
    expect(split.total).toBe(100);
    expect(split.segments.map((segment) => [segment.key, segment.value, segment.share])).toEqual([
      ["cash", 50, 50],
      ["transfer", 30, 30],
      ["debt", 0, 0],
      ["unallocated", 20, 20]
    ]);
  });

  it("takes the total from every payment line when none is marked important", () => {
    const lines = [
      { important: false, key: "cash", label: "Cash", subLabel: emptySubLabel, value: 120 },
      { important: false, key: "transfer", label: "Transfer", subLabel: emptySubLabel, value: 80 },
      { important: false, key: "mixed", label: "Mixed", subLabel: emptySubLabel, value: 50 }
    ];

    const split = paymentSplit(lines);
    expect(split.total).toBe(250);
    expect(split.segments.map((segment) => [segment.key, segment.value, segment.share])).toEqual([
      ["cash", 120, 48],
      ["transfer", 80, 32],
      ["debt", 0, 0],
      ["unallocated", 50, 20]
    ]);
    // A "total" line that is not flagged important is the total, not one more method.
    expect(paymentSplit([...lines, { important: false, key: "total", label: "Total", subLabel: emptySubLabel, value: 250 }]).total).toBe(250);
  });

  it("labels a week by its first day inside the range", () => {
    // 2026-01-01 is a Thursday: its ISO week starts on 2025-12-29, outside the range.
    const weekly = bucketTrendRows(daysFrom("2026-01-01", 70, () => 10));

    expect(weekly.rows[0]).toMatchObject({ days: 4, key: "2025-12-29", label: "01/01", revenue: 40 });
    expect(weekly.rows[1]).toMatchObject({ days: 7, key: "2026-01-05", label: "05/01" });
  });

  it("plots a revenue bar as tall as the day's revenue, the unsplit part on top", () => {
    const split = { cash: 50, debt: 10, revenue: 100, transfer: 30 };

    expect(unsplitRevenue(split)).toBe(10);
    expect(plottedRevenue(split)).toBe(100);
    // Payment rows without a revenue figure plot the split's own sum.
    expect(unsplitRevenue({ ...split, revenue: 0 })).toBe(0);
    expect(plottedRevenue({ ...split, revenue: 0 })).toBe(90);
  });

  it("counts the items that reach 80% of the total", () => {
    expect(paretoCount([50, 30, 10, 10])).toBe(2);
    expect(paretoCount([10, 10, 10])).toBe(3);
    expect(paretoCount([])).toBe(0);
    expect(cumulativeShares([50, 30, 20])).toEqual([50, 80, 100]);
  });

  it("walks the ledger from gross to net when the rows add up", () => {
    const rows = [
      { important: false, key: "gross", label: "Gross", negative: false, value: 1000 },
      { important: false, key: "discount", label: "Discount", negative: true, value: 100 },
      { important: false, key: "vat", label: "VAT", negative: false, value: 90 },
      { important: true, key: "net", label: "Net", negative: false, value: 990 }
    ];

    const ledger = buildLedgerSteps(rows);
    expect(ledger.reconciles).toBe(true);
    expect(ledger.gap).toBe(0);
    expect(ledger.steps.map((step) => [step.kind, Math.round(step.from), Math.round(step.to)])).toEqual([
      ["total", 0, 100],
      ["step", 90, 100],
      ["step", 90, 99],
      ["total", 0, 99]
    ]);
  });

  it("draws no ledger bars when the rows are not a gross-to-net walk", () => {
    const rows = [
      { important: false, key: "sales", label: "Sales", negative: false, value: 1000 },
      { important: true, key: "net", label: "Net", negative: false, value: 900 }
    ];

    expect(buildLedgerSteps(rows)).toEqual({ gap: 100, reconciles: false, steps: [] });
    expect(buildLedgerSteps(rows.slice(0, 1)).steps).toEqual([]);
  });

  it("draws no ledger bars unless the rows end on a reported total", () => {
    const trailing = [
      { important: false, key: "gross", label: "Gross", negative: false, value: 1000 },
      { important: false, key: "discount", label: "Discount", negative: true, value: 100 },
      { important: true, key: "net", label: "Net", negative: false, value: 900 },
      { important: false, key: "paid", label: "Paid", negative: false, value: 700 },
      { important: false, key: "balance", label: "Balance", negative: false, value: 200 }
    ];
    const noTotal = [
      { important: false, key: "cash", label: "Cash", negative: false, value: 500 },
      { important: false, key: "transfer", label: "Transfer", negative: false, value: 300 }
    ];

    expect(buildLedgerSteps(trailing)).toEqual({ gap: 0, reconciles: false, steps: [] });
    expect(buildLedgerSteps(noTotal)).toEqual({ gap: 0, reconciles: false, steps: [] });
  });

  it("reports a rounding gap without dropping the bars", () => {
    const rows = [
      { important: false, key: "gross", label: "Gross", negative: false, value: 1000 },
      { important: true, key: "net", label: "Net", negative: false, value: 1005 }
    ];

    expect(buildLedgerSteps(rows)).toMatchObject({ gap: 5, reconciles: true });
  });

  it("lays tables out as cells and keeps unaccounted tables visible", () => {
    const seats = seatSummary({
      available_tables: 3,
      occupancy_rate: "40",
      occupied_tables: 4,
      total_tables: 10,
      waiting_tables: 1
    });

    expect(seats).toMatchObject({ available: 3, occupancy: 40, occupied: 4, total: 10, unknown: 2, waiting: 1 });
    expect(seats.cells).toEqual([
      "occupied", "occupied", "occupied", "occupied", "waiting",
      "available", "available", "available", "unknown", "unknown"
    ]);
    expect(seatSummary({ total_tables: 61 }).cells).toBeNull();
    expect(seatSummary({}).cells).toBeNull();
  });

  it("needs three days for a sparkline and skips days with no bills for the average bill", () => {
    const rows = [
      trendPoint({ date: "2026-10-01", orders: 2, revenue: 200 }),
      trendPoint({ date: "2026-10-02", orders: 0, revenue: 0 }),
      trendPoint({ date: "2026-10-03", orders: 4, revenue: 200 }),
      trendPoint({ date: "2026-10-04", orders: 1, revenue: 300 })
    ];

    expect(sparklineValues(rows.slice(0, 2), "orders")).toBeNull();
    expect(sparklineValues(rows, "orders")).toEqual([2, 0, 4, 1]);
    expect(sparklineValues(rows, "avgBill")).toEqual([100, 50, 300]);
    expect(sparklinePath([0, 10])).toBe("M0.00 30.00 L100.00 2.00");
    expect(sparklinePath([5])).toBe("");
  });
});
