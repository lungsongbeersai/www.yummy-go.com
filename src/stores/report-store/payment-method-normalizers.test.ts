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
