import { describe, expect, it } from "vitest";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import {
  billMetaText,
  billNeedsPaymentAttention,
  calculatedRateLabel,
  itemAmounts,
  itemDiscountLabel,
  itemToppingNames,
  itemToppingTotal,
  paymentMethodLabel,
  rateLabel,
  readRateLabel,
  realMetaText,
  saleListPrintBillSource,
  salesListVatSummary,
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
  it("explains the saved 40 percent item discount without changing the amounts", () => {
    const item = Object.freeze({
      qty: 1, product_price: 40000, amount: 40000, total: 24000,
      discount_item_type: "PCT", discount_item_value: 40, discount_item_amount: 16000
    });

    expect(itemDiscountLabel(item, "ສ່ວນຫຼຸດ")).toBe("ສ່ວນຫຼຸດ 40%");
    expect(itemAmounts(item)).toEqual({ qty: 1, unitPrice: 40000, amount: 40000, discount: 16000, total: 24000 });
  });

  it.each(["PCT", " pct ", "PERCENT", "PERCENTAGE", "%", 1, "1"])(
    "recognizes percentage discount type %s",
    (type) => {
      expect(itemDiscountLabel({ discount_item_type: type, discount_item_value: "40" }, "Discount")).toBe("Discount 40%");
    }
  );

  it("uses percentage points as saved, including rates at or below one percent", () => {
    expect(itemDiscountLabel({ discount_item_type: "PCT", discount_item_value: 0.5 }, "Discount")).toBe("Discount 0,5%");
    expect(itemDiscountLabel({ discount_item_type: "PCT", discount_item_value: 1 }, "Discount")).toBe("Discount 1%");
    expect(itemDiscountLabel({ order_it_discount_type: "PCT", order_it_discount_value: 100 }, "Discount")).toBe("Discount 100%");
  });

  it.each(["AMT", "AMOUNT", 2, "2", "", undefined, "UNKNOWN"])(
    "does not invent a percentage for fixed or unknown discount type %s",
    (type) => {
      expect(itemDiscountLabel({ discount_item_type: type, discount_item_value: 14000, discount_item_amount: 14000, amount: 40000 }, "Discount")).toBe("Discount");
    }
  );

  it.each([undefined, null, "", "invalid", -1, 0, 101, Infinity])(
    "does not display an invalid or missing percentage %s",
    (value) => {
      expect(itemDiscountLabel({ discount_item_type: "PCT", discount_item_value: value }, "Discount")).toBe("Discount");
    }
  );

  it("shows the saved price before discount instead of the net unit price", () => {
    expect(itemAmounts({ qty: 1, product_price: 40000, amount: 40000, discount_item_amount: 16000, total: 24000 }))
      .toEqual({ qty: 1, unitPrice: 40000, amount: 40000, discount: 16000, total: 24000 });
  });

  it("does not fold separately displayed toppings into the product unit price", () => {
    expect(itemAmounts({ qty: 3, product_price: 65000, amount: 240000, topping_total: 45000, total: 240000 }).unitPrice).toBe(65000);
    expect(itemAmounts({ qty: 3, product_price_total: 195000, amount: 240000, topping_total: 45000, total: 235000 }).unitPrice).toBe(65000);
    expect(itemAmounts({ qty: 3, amount: 240000, topping_total: 45000, total: 235000 }).unitPrice).toBe(65000);
  });

  it("preserves free products, fully discounted totals, and price aliases", () => {
    expect(itemAmounts({ qty: 1, product_price: 0, price: 40000, amount: 0, total: 0 }).unitPrice).toBe(0);
    expect(itemAmounts({ qty: 1, sale_price: 40000, amount: 40000, discount_amount: 40000, total: 0 }))
      .toMatchObject({ unitPrice: 40000, discount: 40000, total: 0 });
  });

  it("does not invent an original price from a net total or divide by zero", () => {
    expect(itemAmounts({ qty: 1, total: 24000 }).unitPrice).toBeNull();
    expect(itemAmounts({ qty: 0, amount: 40000, total: 24000 }).unitPrice).toBeNull();
  });

  it.each([
    [1, "salesList.vatExempt"],
    [2, "salesList.vatIncluded"],
    [3, "salesList.vatExcluded"],
    [null, "salesList.vatUnspecified"],
    [undefined, "salesList.vatUnspecified"],
    [0, "salesList.vatUnspecified"],
    [99, "salesList.vatUnspecified"]
  ])("labels VAT from the saved mode %s without guessing from the amounts", (status, labelKey) => {
    expect(salesListVatSummary({ order_vat_status: status, vat_rate: 10, sum_vate: 4000, sum_total: 48000 }))
      .toEqual({ labelKey, rate: "10%" });
  });

  it("supports VAT snapshot aliases but never infers a rate from rounded money", () => {
    expect(salesListVatSummary({ summary: { vat_status: "2", vat_rate: 10 } }))
      .toEqual({ labelKey: "salesList.vatIncluded", rate: "10%" });
    expect(salesListVatSummary({ order_vat_status: 3, summary: { vat_status: 2 } }).labelKey).toBe("salesList.vatExcluded");
    expect(salesListVatSummary({ order_vat_status: 2, sum_vate: 4000, sum_total: 48000 }).rate).toBe("");
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
