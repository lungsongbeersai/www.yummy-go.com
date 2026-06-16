import { describe, expect, it } from "vitest";
import { PAGE_LIMIT_ALL_BATCH } from "@/lib/pagination";
import type {
  BestSellingProductsReportResponse,
  DailySalesReportResponse,
  FetchBestSellingProductsReportParams,
  FetchDailySalesReportParams,
  FetchPaymentMethodsReportParams,
  PaymentMethodsReportResponse
} from "@/services/report";
import {
  loadBestSellingProductsReportExportData,
  loadDailySalesReportExportData,
  loadPaymentMethodsReportExportData
} from "./export-loaders";

describe("report export loaders", () => {
  it("loads all daily sales pages and keeps first-page summary data", async () => {
    const requests: FetchDailySalesReportParams[] = [];
    const responses: Record<number, DailySalesReportResponse> = {
      1: {
        data: [
          { order_invoice: "INV-1", product_name: "Tea", qty: 1, total: 10 },
          { order_invoice: "INV-1", product_name: "Coffee", qty: 2, total: 20 }
        ],
        grand_total_by_date: [{ date: "2026-06-08", total: 60 }],
        report_total: { total: 60 },
        summary_cards: { bills_count: 2 },
        total: 3,
        totalPages: 2
      },
      2: {
        data: [{ order_invoice: "INV-2", product_name: "Noodle", qty: 1, total: 30 }],
        total: 3,
        totalPages: 2
      }
    };

    const data = await loadDailySalesReportExportData(
      {
        branch_uuid_fk: "branch-1",
        date_from: "2026-06-08",
        date_to: "2026-06-08",
        orderBy: "DESC",
        type_page: "detail"
      },
      async (params) => {
        requests.push(params);
        return responses[params.page]!;
      }
    );

    expect(requests.map((request) => [request.limit, request.page])).toEqual([
      [PAGE_LIMIT_ALL_BATCH, 1],
      [PAGE_LIMIT_ALL_BATCH, 2]
    ]);
    expect(data.rows).toHaveLength(3);
    expect(data.billGroups.map((group) => group.invoiceNumber)).toEqual(["INV-1", "INV-2"]);
    expect(data.grandTotalByDate).toEqual([{ date: "2026-06-08", total: 60 }]);
    expect(data.reportTotal).toEqual({ total: 60 });
    expect(data.summaryCards).toEqual({ bills_count: 2 });
  });

  it("loads and merges all best-selling product export pages", async () => {
    const requests: FetchBestSellingProductsReportParams[] = [];
    const responses: Record<number, BestSellingProductsReportResponse> = {
      1: {
        data: [
          {
            groups: [
              {
                group_name: "Drinks",
                group_uuid: "group-1",
                items: [{ final_total: 10, prod_name: "Tea", product_uuid: "prod-1", qty: 1, rank: 1 }]
              }
            ]
          }
        ],
        pagination: { page: 1, total: 2, totalPages: 2 },
        report: { summary: { final_total: 30, qty: 3 } }
      },
      2: {
        data: [
          {
            groups: [
              {
                group_name: "Drinks",
                group_uuid: "group-1",
                items: [{ final_total: 20, prod_name: "Coffee", product_uuid: "prod-2", qty: 2, rank: 2 }]
              }
            ]
          }
        ],
        pagination: { page: 2, total: 2, totalPages: 2 }
      }
    };

    const data = await loadBestSellingProductsReportExportData(
      {
        branch_uuid_fk: "branch-1",
        date_from: "2026-06-08",
        date_to: "2026-06-08",
        group_uuid_fk: "all",
        sort_by: "qty"
      },
      async (params) => {
        requests.push(params);
        return responses[params.page]!;
      }
    );

    expect(requests.map((request) => [request.group_uuid_fk, request.limit, request.page])).toEqual([
      ["all", PAGE_LIMIT_ALL_BATCH, 1],
      ["all", PAGE_LIMIT_ALL_BATCH, 2]
    ]);
    expect(data.groups).toHaveLength(1);
    expect(data.groups[0]).toMatchObject({ finalTotal: 30, name: "Drinks", qtyTotal: 3 });
    expect(data.rows.map((row) => row.productName)).toEqual(["Tea", "Coffee"]);
    expect(data.summary).toEqual({ final_total: 30, qty: 3 });
  });

  it("loads all payment method rows and keeps first-page cards and totals", async () => {
    const requests: FetchPaymentMethodsReportParams[] = [];
    const responses: Record<number, PaymentMethodsReportResponse> = {
      1: {
        dashboard_cards: [{ key: "total", label: "Total", sort_order: 1, value: 300, value_type: "money" }],
        data: [
          {
            amount: 100,
            payment_method_code: "cash",
            payment_method_name: "Cash",
            rank: 1,
            sort_order: 1,
            total: 100
          }
        ],
        report_name: "Payment report",
        report_total: { total: 300 },
        total: 2,
        totalPages: 2
      },
      2: {
        data: [
          {
            amount: 200,
            payment_method_code: "transfer",
            payment_method_name: "Transfer",
            rank: 2,
            sort_order: 2,
            total: 200
          }
        ],
        total: 2,
        totalPages: 2
      }
    };

    const data = await loadPaymentMethodsReportExportData(
      {
        branch_uuid_fk: "branch-1",
        date_from: "2026-06-08",
        date_to: "2026-06-08",
        orderBy: "DESC",
        payment_method: "all"
      },
      async (params) => {
        requests.push(params);
        return responses[params.page]!;
      }
    );

    expect(requests.map((request) => [request.limit, request.page])).toEqual([
      [PAGE_LIMIT_ALL_BATCH, 1],
      [PAGE_LIMIT_ALL_BATCH, 2]
    ]);
    expect(data.cards).toEqual([{ key: "total", label: "Total", sortOrder: 1, value: 300, valueType: "money" }]);
    expect(data.reportName).toBe("Payment report");
    expect(data.reportTotal).toEqual({ total: 300 });
    expect(data.rows.map((row) => row.paymentMethodName)).toEqual(["Cash", "Transfer"]);
  });
});
