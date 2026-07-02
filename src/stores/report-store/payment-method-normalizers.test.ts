import { describe, expect, it } from "vitest";
import type { PaymentMethodsReportResponse } from "@/services/report";
import { normalizePaymentMethodsReportResponse } from "./payment-method-normalizers";

const paymentSummaryResponse: PaymentMethodsReportResponse = {
  status: "success",
  lang: "la",
  page: 1,
  limit: "all",
  total: 3,
  totalPages: 1,
  summary: {
    bill_count: 65,
    item_count: 246,
    total_qty: 434,
    product_price_total: 79627726,
    topping_total: 371000,
    total: 79998726,
    discount_item_amount: 421460,
    after_discount_item: 79577266,
    bill_total: 79173726,
    discount_bill: 1176056,
    after_discount_bill: 77997670,
    sum_servicecharge: 9131726,
    sum_vate: 9911389,
    grand_total: 96619324,
    payment_total: 96619324,
    difference: 0,
    is_match: true,
  },
  payment_rows: [
    {
      payment_method: 1,
      payment_method_name: "Cash",
      bill_count: 55,
      product_price_total: 75701369.04,
      topping_total: 324006.66,
      total: 76025375.71,
      discount_item_amount: 289711.67,
      after_discount_item: 75735664.04,
      bill_total: 75200375.71,
      discount_bill: 969514.07,
      after_discount_bill: 74230861.63,
      sum_servicecharge: 8861521.61,
      sum_vate: 9515732.43,
      grand_total: 92318403,
      payment_amount: 92318403,
    },
    {
      payment_method: 2,
      payment_method_name: "Transfer",
      bill_count: 5,
      product_price_total: 3196356.96,
      topping_total: 26993.34,
      total: 3223350.29,
      discount_item_amount: 1748.33,
      after_discount_item: 3221601.96,
      bill_total: 3223350.29,
      discount_bill: 73541.93,
      after_discount_bill: 3149808.37,
      sum_servicecharge: 236114.39,
      sum_vate: 343547.57,
      grand_total: 3727722,
      payment_amount: 3727722,
    },
  ],
};

describe("normalizePaymentMethodsReportResponse", () => {
  it("maps backend summary fields without legacy payment fields", () => {
    const normalized = normalizePaymentMethodsReportResponse(
      paymentSummaryResponse,
      "All",
      1,
    );

    expect(normalized.reportTotal).toMatchObject({
      after_discount_bill: 77997670,
      after_discount_item: 79577266,
      bill_count: 65,
      bill_total: 79173726,
      difference: 0,
      discount_bill: 1176056,
      discount_item_amount: 421460,
      grand_total: 96619324,
      item_count: 246,
      payment_total: 96619324,
      product_price_total: 79627726,
      sum_servicecharge: 9131726,
      sum_vate: 9911389,
      topping_total: 371000,
      total: 79998726,
      total_qty: 434,
    });
  });

  it("maps payment_rows from the backend payment_summary_by_method response", () => {
    const normalized = normalizePaymentMethodsReportResponse(
      paymentSummaryResponse,
      "All",
      1,
    );

    expect(normalized.rows).toHaveLength(2);
    expect(normalized.rows[0]).toMatchObject({
      afterDiscountBill: 74230861.63,
      afterDiscountItem: 75735664.04,
      billCount: 55,
      billTotal: 75200375.71,
      discountBill: 969514.07,
      discountItemAmount: 289711.67,
      grandTotal: 92318403,
      paymentAmount: 92318403,
      paymentMethodCode: "1",
      paymentMethodName: "Cash",
      productPriceTotal: 75701369.04,
      serviceCharge: 8861521.61,
      toppingTotal: 324006.66,
      total: 76025375.71,
      vat: 9515732.43,
    });
    expect(normalized.rows[1]?.paymentMethodCode).toBe("2");
    expect(normalized.pagination).toEqual({
      limit: "All",
      page: 1,
      total: 3,
      totalPages: 1,
    });
  });

  it("keeps backend payment method options when available", () => {
    const normalized = normalizePaymentMethodsReportResponse(
      {
        ...paymentSummaryResponse,
        payment_methods: [
          { sort_order: 1, value: "all", label: "All" },
          { sort_order: 2, value: "cash", label: "Cash" },
          { sort_order: 3, value: "transfer", label: "Transfer" },
          { sort_order: 4, value: "debt", label: "Debt" },
        ],
      },
      "All",
      1,
    );

    expect(normalized.paymentMethods.map((option) => option.value)).toEqual([
      "all",
      "cash",
      "transfer",
      "debt",
    ]);
  });

  it("falls back to static payment methods and derived pagination", () => {
    const normalized = normalizePaymentMethodsReportResponse(
      {
        card_summary: [
          { key: "grand_total", label: "Grand total", value: 99, value_type: "money" },
        ],
        payment_rows: [],
        summary: { grand_total: 99 },
      },
      20,
      2,
    );

    expect(normalized.cards).toHaveLength(1);
    expect(normalized.cards[0]?.value).toBe(99);
    expect(normalized.paymentMethods.map((option) => option.value)).toEqual([
      "all",
      "cash",
      "transfer",
      "debt",
    ]);
    expect(normalized.reportTotal).toMatchObject({ grand_total: 99 });
    expect(normalized.rows).toEqual([]);
    expect(normalized.pagination).toEqual({
      limit: 20,
      page: 2,
      total: 0,
      totalPages: 2,
    });
  });
});
