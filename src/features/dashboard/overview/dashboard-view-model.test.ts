import { describe, expect, it } from "vitest";
import { createDashboardModel, createDefaultFilters } from "./dashboard-view-model";

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

  it("creates current-date default filters", () => {
    expect(createDefaultFilters(new Date(2026, 5, 11, 12))).toEqual({
      end_date: "2026-06-11",
      start_date: "2026-06-11"
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

  it("normalizes warning entries into stable key/value rows", () => {
    const model = createDashboardModel(dashboardData(), createDefaultFilters());

    expect(model.warnings).toEqual([
      { key: "low_stock", value: "Low stock" },
      { key: "missing", value: "-" }
    ]);
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
