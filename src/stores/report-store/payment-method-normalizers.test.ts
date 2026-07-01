import { describe, expect, it } from "vitest";
import type { PaymentMethodsReportResponse } from "@/services/report";
import { normalizePaymentMethodsReportResponse } from "./payment-method-normalizers";

const fullResponse: PaymentMethodsReportResponse = {
  status: "success",
  report_name: "Payment method report",
  page: 1,
  limit: 10,
  total: 3,
  totalPages: 1,
  payment_method: "all",
  payment_methods: [
    { sort_order: 1, value: "all", label: "All" },
    { sort_order: 2, value: "cash", label: "Cash" },
    { sort_order: 3, value: "transfer", label: "Transfer" },
    { sort_order: 4, value: "debt", label: "Debt" }
  ],
  report_total: {
    amount: 1821996,
    bills_count: 9,
    receive_cash: 1551286,
    receive_transfer: 411950,
    debt_amount: 181258,
    service_charge: 127540,
    vat: 194954,
    total: 2144490
  },
  summary_cards: {
    total: 2144490,
    receive_cash: 1551286
  },
  dashboard_cards: [
    { sort_order: 1, key: "rows_count", label: "Rows", value: 3, value_type: "number" },
    { sort_order: 2, key: "total", label: "Total", value: 2144490, value_type: "money" }
  ],
  data: [
    {
      sort_order: 1,
      rank: 1,
      payment_method_code: "cash",
      payment_method_name: "Cash",
      bills_count: 7,
      active_count: 7,
      cancelled_count: 0,
      items_count: 17,
      qty_total: 27,
      amount: 1317996,
      topping_total: 15000,
      item_discount: 0,
      discount_bill: 0,
      discount_total: 0,
      service_charge: 92260,
      vat: 141026,
      total: 1551282,
      receive_cash: 1551286,
      receive_transfer: 0,
      debt_amount: 0,
      change_amount: 4,
      cancelled_total: 0
    }
  ]
};

describe("normalizePaymentMethodsReportResponse", () => {
  it("uses the new payment summary response shape as the primary source", () => {
    const normalized = normalizePaymentMethodsReportResponse(
      {
        status: "success",
        report_name: "Payment summary by method",
        page: 1,
        limit: "all",
        total: 2,
        totalPages: 1,
        summary: {
          bill_count: 8,
          total_qty: 43,
          amount: 4336000,
          discount_item: 197500,
          discount_bill: 129000,
          sum_discount: 326500,
          sum_servicecharge: 561330,
          sum_vate: 548500,
          sum_total: 5119330,
          paid_cash: 3000000,
          paid_transfer: 2119330
        },
        rows: [
          {
            payment_method: "cash",
            payment_method_name: "Cash",
            bill_count: 5,
            total_qty: 20,
            amount: 2000000,
            discount_item: 50000,
            discount_bill: 10000,
            sum_discount: 60000,
            sum_servicecharge: 140000,
            sum_vate: 166400,
            sum_total: 2246400,
            paid_cash: 2246400
          },
          {
            payment_method: "transfer",
            payment_method_name: "Transfer",
            bill_count: 3,
            total_qty: 23,
            amount: 2336000,
            paid_transfer: 2872930,
            sum_total: 2872930
          }
        ]
      },
      "All",
      1
    );

    expect(normalized.reportTotal).toMatchObject({
      amount: 4336000,
      bills_count: 8,
      discount_total: 326500,
      item_discount: 197500,
      qty_total: 43,
      receive_cash: 3000000,
      receive_transfer: 2119330,
      service_charge: 561330,
      total: 5119330,
      vat: 548500
    });
    expect(normalized.rows.map((row) => row.paymentMethodCode)).toEqual(["cash", "transfer"]);
    expect(normalized.rows[0]).toMatchObject({
      billsCount: 5,
      discountTotal: 60000,
      paymentMethodName: "Cash",
      receiveCash: 2246400,
      serviceCharge: 140000,
      total: 2246400,
      vat: 166400
    });
    expect(normalized.pagination).toEqual({ limit: "All", page: 1, total: 2, totalPages: 1 });
  });

  it("maps payment_rows from the backend payment_summary_by_method response", () => {
    const normalized = normalizePaymentMethodsReportResponse(
      {
        status: "success",
        lang: "la",
        summary: {
          bill_count: 65,
          item_count: 246,
          total_qty: 434,
          product_price_total: 79627726,
          topping_total: 371000,
          total: 79998726,
          discount_item_amount: 421460,
          discount_bill: 1176056,
          sum_servicecharge: 9131726,
          sum_vate: 9911389,
          grand_total: 96619324,
          payment_total: 96619324
        },
        payment_rows: [
          {
            payment_method: 1,
            payment_method_name: "ສົດ",
            bill_count: 55,
            product_price_total: 75701369.04,
            topping_total: 324006.66,
            total: 76025375.71,
            discount_item_amount: 289711.67,
            discount_bill: 969514.07,
            sum_servicecharge: 8861521.61,
            sum_vate: 9515732.43,
            grand_total: 92318403,
            payment_amount: 92318403
          },
          {
            payment_method: 2,
            payment_method_name: "ໂອນ",
            bill_count: 5,
            product_price_total: 3196356.96,
            topping_total: 26993.34,
            total: 3223350.29,
            discount_item_amount: 1748.33,
            discount_bill: 73541.93,
            sum_servicecharge: 236114.39,
            sum_vate: 343547.57,
            grand_total: 3727722,
            payment_amount: 3727722
          }
        ]
      },
      "All",
      1
    );

    expect(normalized.reportTotal).toMatchObject({
      amount: 79627726,
      bills_count: 65,
      items_count: 246,
      qty_total: 434,
      service_charge: 9131726,
      total: 96619324,
      vat: 9911389
    });
    expect(normalized.rows).toHaveLength(2);
    expect(normalized.rows[0]).toMatchObject({
      amount: 75701369.04,
      billsCount: 55,
      discountBill: 969514.07,
      itemDiscount: 289711.67,
      paymentMethodCode: "1",
      paymentMethodName: "ສົດ",
      serviceCharge: 8861521.61,
      total: 92318403,
      vat: 9515732.43
    });
    expect(normalized.rows[1]?.paymentMethodCode).toBe("2");
    expect(normalized.pagination).toEqual({ limit: "All", page: 1, total: 2, totalPages: 1 });
  });

  it("keeps cards, filters, totals, rows, and pagination from the full API shape", () => {
    const normalized = normalizePaymentMethodsReportResponse(fullResponse, 10, 1);

    expect(normalized.reportName).toBe("Payment method report");
    expect(normalized.cards).toEqual([
      { key: "rows_count", label: "Rows", sortOrder: 1, value: 3, valueType: "number" },
      { key: "total", label: "Total", sortOrder: 2, value: 2144490, valueType: "money" }
    ]);
    expect(normalized.paymentMethods.map((option) => option.value)).toEqual(["all", "cash", "transfer", "debt"]);
    expect(normalized.reportTotal).toMatchObject({
      debt_amount: 181258,
      receive_cash: 1551286,
      service_charge: 127540,
      total: 2144490,
      vat: 194954
    });
    expect(normalized.rows[0]).toMatchObject({
      amount: 1317996,
      billsCount: 7,
      paymentMethodCode: "cash",
      paymentMethodName: "Cash",
      receiveCash: 1551286,
      serviceCharge: 92260,
      vat: 141026
    });
    expect(normalized.pagination).toEqual({ limit: 10, page: 1, total: 3, totalPages: 1 });
  });

  it("falls back to card_summary, summary_cards, static methods, and derived pagination", () => {
    const normalized = normalizePaymentMethodsReportResponse(
      {
        card_summary: [{ key: "total", label: "Total", value: 99, value_type: "money" }],
        data: [],
        summary_cards: { total: 99 }
      },
      20,
      2
    );

    expect(normalized.cards).toHaveLength(1);
    expect(normalized.cards[0]?.value).toBe(99);
    expect(normalized.paymentMethods.map((option) => option.value)).toEqual(["all", "cash", "transfer", "debt"]);
    expect(normalized.reportTotal).toEqual({ total: 99 });
    expect(normalized.rows).toEqual([]);
    expect(normalized.pagination).toEqual({ limit: 20, page: 2, total: 0, totalPages: 2 });
  });
});
