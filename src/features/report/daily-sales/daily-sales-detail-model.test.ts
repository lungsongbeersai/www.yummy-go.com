import { describe, expect, it } from "vitest";
import type { DailySalesBillGroup } from "@/stores/report-store";
import {
  buildDailySalesDetailReportModel,
  detailGroupDiscountTotal,
  detailGroupQuantity,
} from "./daily-sales-detail-model";

function billGroup(
  overrides: Partial<DailySalesBillGroup> = {},
): DailySalesBillGroup {
  return {
    amountTotal: 82,
    baseTotal: 75,
    branchName: "Branch",
    cancelled: false,
    cashierName: "Cashier",
    changeAmount: 0,
    debtAmount: 0,
    discountBillAmount: 4,
    id: "bill-1",
    invoiceNumber: "INV-1",
    itemCount: 2,
    itemDiscountAmount: 3,
    items: [
      {
        amount: 32,
        discount: 1,
        product_name: "Noodle",
        qty: 3,
        sale_price: 10,
        status_name: "paid",
        topping_total: 2,
        total: 31,
      },
      {
        amount: 50,
        discount: 2,
        product_name: "Tea",
        qty: 2,
        sale_price: 25,
        total: 48,
      },
    ],
    lineTotal: 87,
    paymentType: "cash",
    qtyTotal: 5,
    receiveCashAmount: 87,
    receiveTransferAmount: 0,
    saleDate: "2026-07-13",
    serviceChargeAmount: 5,
    status: "paid",
    tableName: "A1",
    toppingTotal: 2,
    vatAmount: 4,
    ...overrides,
  };
}

describe("daily sales detail presentation model", () => {
  it("uses the same quantity, discount, subtotal, adjustments, and totals as the UI", () => {
    const group = billGroup();
    const model = buildDailySalesDetailReportModel(
      [group],
      {
        amount: 82,
        bill_count: 1,
        product_price_total: 80,
        sum_discount: 7,
        sum_total: 87,
        topping_total: 2,
        total_qty: 5,
      },
      {},
    );

    expect(detailGroupQuantity(group)).toBe(5);
    expect(detailGroupDiscountTotal(group)).toBe(7);
    expect(model.hasStatus).toBe(true);
    expect(model.bills[0]?.collapsedMetrics).toMatchObject({
      discount: 7,
      quantity: 5,
      sellingPrice: 80,
    });
    expect(model.bills[0]?.itemSubtotal).toMatchObject({
      discount: 3,
      total: 79,
    });
    expect(model.bills[0]?.adjustments).toEqual([
      { key: "bill-discount", value: 4 },
      { key: "service-charge", value: 5 },
      { key: "vat", value: 4 },
      { key: "total", value: 87 },
    ]);
    expect(model.totals).toEqual({
      amount: 82,
      billCount: 1,
      discount: 7,
      quantity: 5,
      sellingPrice: 80,
      topping: 2,
      total: 87,
    });
  });

  it("falls back to item count only when the API has no quantity total", () => {
    expect(detailGroupQuantity(billGroup({ itemCount: 2, qtyTotal: 0 }))).toBe(2);
  });
});
