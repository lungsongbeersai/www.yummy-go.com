import { describe, expect, it } from "vitest";
import { buildDepositCreateDraft } from "./deposit-create-draft";
import type { DepositableOrderItem } from "./deposit-order-items";

const item: DepositableOrderItem = {
  key: "variant-700ml", proDetailUuid: "variant-700ml", productCode: "SKU00017",
  name: "Drink (700 ml)", unitName: "bottle", orderedQty: 3, availableQty: 1.5
};
const other: DepositableOrderItem = {
  ...item, key: "variant-1l", proDetailUuid: "variant-1l", name: "Drink (1 L)", availableQty: 2
};

describe("cashier-entered deposit drafts", () => {
  it("does not select or autofill bill quantities when the form opens", () => {
    const result = buildDepositCreateDraft([item, other], new Map());
    expect(result.items).toEqual([]);
    expect(result.invalidKeys.size).toBe(0);
  });

  it("keeps a received fraction bound to its exact variant rather than its shared product code", () => {
    const result = buildDepositCreateDraft([item, other], new Map([[item.key, "0.75"]]));
    expect(result.items).toEqual([{ ...item, qty: 0.75 }]);
    expect(result.invalidKeys.size).toBe(0);
  });

  it("empty and zero entries clear a selection without validation errors", () => {
    for (const value of ["", " ", "0", "0.000", "0."]) {
      const result = buildDepositCreateDraft([item], new Map([[item.key, value]]));
      expect(result.items).toEqual([]);
      expect(result.invalidKeys.size).toBe(0);
    }
  });

  it("blocks review for a nonempty invalid row even when another variant is valid", () => {
    for (const invalid of ["-0.5", "not-a-number", "0.0001", "0.1234", "1.501"]) {
      const result = buildDepositCreateDraft([item, other], new Map([[item.key, invalid], [other.key, "1"]]));
      expect(result.invalidKeys.has(item.key)).toBe(true);
      expect(result.items.some((row) => row.proDetailUuid === other.proDetailUuid && row.qty === 1)).toBe(true);
    }
  });

  it("permits the exact available ceiling and supported thousandths", () => {
    for (const value of ["0.001", "0.125", "1.5"]) {
      const result = buildDepositCreateDraft([item], new Map([[item.key, value]]));
      expect(result.items[0].qty).toBe(Number(value));
      expect(result.invalidKeys.size).toBe(0);
    }
  });

  it("a product search can leave entered quantities on other eligible rows intact", () => {
    const quantities = new Map([[item.key, "0.75"], [other.key, "1.25"]]);
    const result = buildDepositCreateDraft([item, other], quantities);
    expect(result.items.map((row) => [row.proDetailUuid, row.qty])).toEqual([[item.key, 0.75], [other.key, 1.25]]);
    expect(quantities.get(item.key)).toBe("0.75");
  });
});
