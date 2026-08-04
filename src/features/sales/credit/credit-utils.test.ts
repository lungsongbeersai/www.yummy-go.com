import { describe, expect, it } from "vitest";
import type { CreditBill } from "@/services/credit";
import {
  creditAllocationTotal,
  creditChange,
  toCreditAmount,
  validateCreditPayment
} from "./credit-utils";

const bills: CreditBill[] = [
  {
    payment_uuid: "p1",
    order_uuid: "o1",
    invoice_no: "INV-1",
    bill_total: 4_000_000,
    paid_total: 0,
    balance: 4_000_000,
    credit_status: 1,
    credit_status_text: "Unpaid"
  },
  {
    payment_uuid: "p2",
    order_uuid: "o2",
    invoice_no: "INV-2",
    bill_total: 2_000_000,
    paid_total: 500_000,
    balance: 1_500_000,
    credit_status: 2,
    credit_status_text: "Partial"
  }
];

describe("credit payment helpers", () => {
  it("totals four selected one-million bills while leaving the fifth unselected", () => {
    const fiveBills = Array.from({ length: 5 }, (_, index) => ({
      ...bills[0],
      payment_uuid: `payment-${index + 1}`,
      order_uuid: `order-${index + 1}`,
      invoice_no: `INV-${index + 1}`,
      bill_total: 1_000_000,
      balance: 1_000_000
    }));
    const selectedUuids = fiveBills.slice(0, 4).map((bill) => bill.payment_uuid);

    expect(creditAllocationTotal(fiveBills, selectedUuids)).toBe(4_000_000);
    expect(
      validateCreditPayment({
        customerUuid: "customer-1",
        mode: "multiple",
        bills: fiveBills,
        selectedUuids,
        payMethod: 1,
        cashAmount: 4_000_000,
        transferAmount: 0
      })
    ).toBeNull();
  });

  it("pays every selected bill at its full outstanding balance", () => {
    expect(
      validateCreditPayment({
        customerUuid: "customer-1",
        mode: "multiple",
        bills,
        selectedUuids: ["p1", "p2"],
        payMethod: 1,
        cashAmount: 5_500_000,
        transferAmount: 0
      })
    ).toBeNull();
  });

  it("requires at least two bills in multiple mode", () => {
    expect(
      validateCreditPayment({
        customerUuid: "customer-1",
        mode: "multiple",
        bills,
        selectedUuids: ["p1"],
        payMethod: 1,
        cashAmount: 4_000_000,
        transferAmount: 0
      })
    ).toBe("selectMultipleBills");
  });

  it("blocks a selected bill with no outstanding balance", () => {
    expect(
      validateCreditPayment({
        customerUuid: "customer-1",
        mode: "single",
        bills: [{ ...bills[0], balance: 0 }],
        selectedUuids: ["p1"],
        payMethod: 1,
        cashAmount: 0,
        transferAmount: 0
      })
    ).toBe("invalidBalance");
  });

  it("adds the full balances of only the selected bills and calculates change in cents", () => {
    expect(creditAllocationTotal(bills, ["p1", "p2"])).toBe(5_500_000);
    expect(creditAllocationTotal(bills, ["p2"])).toBe(1_500_000);
    expect(creditChange(3, 4_600_000, 1_000_000, 5_500_000)).toBe(100_000);
    expect(toCreditAmount("not-money")).toBe(0);
  });
});
