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

  it("uses request top first and then filter top for product row limits", () => {
    const filters = { ...createDefaultFilters(), top: "2" };
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
      filters
    );
    const filterTopModel = createDashboardModel(
      dashboardData({
        charts: {
          top_selling_products_chart: products
        },
        request_params: {}
      }),
      filters
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
});
