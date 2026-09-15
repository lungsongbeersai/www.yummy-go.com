import { describe, expect, it } from "vitest";
import {
  mergeInvoicePrintItems,
  type InvoicePrintItem,
} from "./invoice-print-window";

function item(overrides: Partial<InvoicePrintItem> = {}): InvoicePrintItem {
  return {
    displayTotal: 180_000,
    hasItemDiscount: false,
    name: "Burger",
    originalLineTotal: 180_000,
    qty: 3,
    toppingLabel: "Topping",
    toppingTotal: null,
    toppings: [],
    unitPrice: 60_000,
    ...overrides,
  };
}

describe("mergeInvoicePrintItems", () => {
  it("merges equivalent order rounds only in the payment document projection", () => {
    const rows = [
      item(),
      item({ displayTotal: 120_000, originalLineTotal: 120_000, qty: 2 }),
    ];
    const snapshot = structuredClone(rows);

    expect(mergeInvoicePrintItems(rows)).toEqual([
      item({ displayTotal: 300_000, originalLineTotal: 300_000, qty: 5 }),
    ]);
    expect(rows).toEqual(snapshot);
  });

  it("keeps different prices, discounts, and toppings on separate lines", () => {
    const rows = [
      item(),
      item({ unitPrice: 65_000, displayTotal: 195_000 }),
      item({
        displayTotal: 162_000,
        hasItemDiscount: true,
      }),
      item({
        displayTotal: 195_000,
        toppingTotal: 15_000,
        toppings: [{ name: "Cheese", qty: 1, total: 15_000 }],
      }),
    ];

    expect(mergeInvoicePrintItems(rows)).toHaveLength(4);
  });

  it("adds topping totals while keeping the per-item topping quantity", () => {
    const rows = [
      item({
        displayTotal: 195_000,
        toppingTotal: 15_000,
        toppings: [{ name: "Cheese", qty: 1, total: 15_000 }],
      }),
      item({
        displayTotal: 130_000,
        originalLineTotal: 120_000,
        qty: 2,
        toppingTotal: 10_000,
        toppings: [{ name: "Cheese", qty: 1, total: 10_000 }],
      }),
    ];

    expect(mergeInvoicePrintItems(rows)).toEqual([
      item({
        displayTotal: 325_000,
        originalLineTotal: 300_000,
        qty: 5,
        toppingTotal: 25_000,
        toppings: [{ name: "Cheese", qty: 1, total: 25_000 }],
      }),
    ]);
  });
});
