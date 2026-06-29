import { describe, expect, it } from "vitest";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import { billNeedsPaymentAttention, itemToppingNames, itemToppingTotal, saleListPrintBillSource } from "./sales-list-utils";

function bill(overrides: Partial<DailySaleItemsBillGroup> = {}): DailySaleItemsBillGroup {
  return {
    amountTotal: 100000,
    branchName: "Main",
    cancelled: false,
    debtAmount: 0,
    discountTotal: 0,
    id: "bill-1",
    invoiceNumber: "INV-1",
    itemCount: 1,
    items: [],
    lineTotal: 100000,
    paymentMethodCode: "cash",
    paymentMethodName: "Cash",
    qtyTotal: 1,
    raw: {},
    receiveCashAmount: 100000,
    receiveTransferAmount: 0,
    saleDate: "2026-06-24",
    serviceChargeAmount: 0,
    status: "paid",
    tableName: "A1",
    toppingTotal: 0,
    vatAmount: 0,
    ...overrides,
  };
}

describe("sales list utils", () => {
  it("marks unpaid and debt bills for attention", () => {
    expect(billNeedsPaymentAttention(bill({ debtAmount: 25000 }))).toBe(true);
    expect(billNeedsPaymentAttention(bill({ paymentMethodCode: "debt" }))).toBe(true);
    expect(billNeedsPaymentAttention(bill({ paymentMethodName: "ໜີ້ຄ້າງ" }))).toBe(true);
    expect(billNeedsPaymentAttention(bill({ status: "unpaid" }))).toBe(true);
  });

  it("does not mark paid or cancelled bills", () => {
    expect(billNeedsPaymentAttention(bill())).toBe(false);
    expect(
      billNeedsPaymentAttention(
        bill({
          cancelled: true,
          debtAmount: 25000,
          status: "cancelled",
        }),
      ),
    ).toBe(false);
  });

  it("reads topping names and totals from the report_all sale list item shape", () => {
    const item = {
      product_full_name: "Fried rice-Large",
      qty: 3,
      product_price: 65000,
      product_price_total: 195000,
      topping_unit_total: 15000,
      topping_total: 45000,
      toppings: [
        { topping_name: "Egg", topping_qty: 1, topping_price: 5000, topping_total: 5000 },
        { topping_name: "Meat", topping_qty: 1, topping_price: 10000, topping_total: 10000 }
      ],
      total: 240000
    };

    expect(itemToppingNames(item)).toEqual(["Egg", "Meat"]);
    expect(itemToppingTotal(item)).toBe(45000);
  });

  it("keeps sale list print source aligned with the new API price and topping fields", () => {
    const source = saleListPrintBillSource(
      bill({
        amountTotal: 240000,
        items: [
          {
            product_full_name: "Fried rice-Large",
            product_price: 65000,
            product_price_total: 195000,
            topping_total: 45000,
            topping_unit_total: 15000,
            total: 240000
          }
        ],
        lineTotal: 306432,
        raw: { order_uuid: "order-1" },
        serviceChargeAmount: 33600,
        vatAmount: 32832
      })
    );

    const items = Array.isArray(source.items) ? source.items : [];

    expect(items[0]).toMatchObject({
      line_total: 240000,
      price: 65000,
      product_price_total: 195000,
      topping_total: 45000
    });
  });
});
