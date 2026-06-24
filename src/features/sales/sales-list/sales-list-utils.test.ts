import { describe, expect, it } from "vitest";
import type { DailySaleItemsBillGroup } from "@/stores/report-store";
import { billNeedsPaymentAttention } from "./sales-list-utils";

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
});
