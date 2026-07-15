import { describe, expect, it } from "vitest";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import {
  billMetaText,
  billNeedsPaymentAttention,
  cancelDateSelectForSaleDate,
  calculatedRateLabel,
  itemToppingNames,
  itemToppingTotal,
  paymentMethodLabel,
  rateLabel,
  readRateLabel,
  realMetaText,
  saleListPrintBillSource,
  summaryMetricLabel
} from "./sales-list-utils";

function bill(overrides: Partial<DailySaleItemsBillGroup> = {}): DailySaleItemsBillGroup {
  return {
    amountTotal: 100000,
    branchName: "Main",
    cancelled: false,
    changeAmount: 0,
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
  it("maps only today's and yesterday's bills to cancel-sale date filters", () => {
    const now = new Date(2026, 6, 15, 12);

    expect(cancelDateSelectForSaleDate("2026-07-15 09:30:00", now)).toBe("today");
    expect(cancelDateSelectForSaleDate("2026-07-14", now)).toBe("yesterday");
    expect(cancelDateSelectForSaleDate("2026-07-13", now)).toBeNull();
    expect(cancelDateSelectForSaleDate("invalid", now)).toBeNull();
  });

  it("handles yesterday across month boundaries", () => {
    expect(cancelDateSelectForSaleDate("2026-06-30", new Date(2026, 6, 1, 8))).toBe("yesterday");
  });

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
        changeAmount: 43568,
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
    expect(source.change_amount).toBe(43568);
  });

  it("keeps payment method labels mapped to the existing translation keys", () => {
    const translate = (key: string) => `translated:${key}`;

    expect(paymentMethodLabel("All", translate)).toBe("translated:common.all");
    expect(paymentMethodLabel("1", translate)).toBe("translated:pos.paymentCash");
    expect(paymentMethodLabel("2", translate)).toBe("translated:pos.paymentTransfer");
    expect(paymentMethodLabel("4", translate)).toBe("translated:pos.paymentArrears");
  });

  it("reads bill metadata from the raw bill before its summary fallback", () => {
    const groupedBill = bill({
      raw: {
        customer_name: "Raw customer",
        summary: {
          customer_name: "Summary customer",
          customer_phone: "020 5555 5555"
        }
      }
    });

    expect(billMetaText(groupedBill, ["customer_name"])).toBe("Raw customer");
    expect(billMetaText(groupedBill, ["customer_phone"])).toBe("020 5555 5555");
    expect(realMetaText(" - ")).toBe("");
  });

  it("preserves explicit and calculated percentage labels for bill summaries", () => {
    expect(rateLabel(0.1)).toBe("10%");
    expect(rateLabel(7.5)).toBe("7,5%");
    expect(readRateLabel({ summary: { vat_rate: 0.07 }, vat_rate: 10 }, ["vat_rate"], "vat")).toBe("7%");
    expect(calculatedRateLabel(10, 200)).toBe("5%");
    expect(summaryMetricLabel("VAT", "7%")).toBe("VAT (7%)");
  });
});
