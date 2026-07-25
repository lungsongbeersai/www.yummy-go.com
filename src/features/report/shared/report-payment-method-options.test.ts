import { describe, expect, it } from "vitest";
import {
  paymentMethodFallbackOptions,
  selectedPaymentMethodLabel,
} from "./report-payment-method-options";

const labels: Record<string, string> = {
  "common.all": "All",
  "report.paymentMethods.cash": "Cash",
  "report.paymentMethods.debt": "Debt",
  "report.paymentMethods.transfer": "Transfer",
};

const t = (key: string) => labels[key] ?? key;

describe("payment method fallback options", () => {
  // เดิมทดสอบซ้ำใน category-sales และ payment-methods utils เพราะทั้งคู่ใช้ logic เดียวกัน
  it("builds fallback payment method options", () => {
    expect(paymentMethodFallbackOptions(t).map((option) => [option.value, option.label])).toEqual([
      ["all", "All"],
      ["cash", "Cash"],
      ["transfer", "Transfer"],
      ["debt", "Debt"],
    ]);
  });

  it("assigns a 1-based sort order matching the option order", () => {
    expect(paymentMethodFallbackOptions(t).map((option) => option.sortOrder)).toEqual([1, 2, 3, 4]);
  });

  it("finds the label for the selected value among the given options", () => {
    const options = paymentMethodFallbackOptions(t);

    expect(selectedPaymentMethodLabel(options, "cash", t)).toBe("Cash");
  });

  it("falls back to common.all when the value is not in the options", () => {
    expect(selectedPaymentMethodLabel([], "cash", t)).toBe("All");
  });
});
