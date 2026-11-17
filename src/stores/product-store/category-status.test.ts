import { describe, expect, it } from "vitest";
import { preferredProductCategoryStatus } from "./category-status";

function totals(normal: number, set: number, promotion: number) {
  return [
    { statusSort: "1", total: normal },
    { statusSort: "2", total: set },
    { statusSort: "3", total: promotion },
  ];
}

describe("preferredProductCategoryStatus", () => {
  it("chooses SET when a category contains one normal product and eight sets", () => {
    expect(preferredProductCategoryStatus(totals(1, 8, 0), "1")).toBe("2");
  });

  it("chooses the largest normal or promotion group", () => {
    expect(preferredProductCategoryStatus(totals(30, 8, 0), "2")).toBe("1");
    expect(preferredProductCategoryStatus(totals(1, 8, 20), "2")).toBe("3");
  });

  it("keeps the active group when it ties for the greatest count", () => {
    expect(preferredProductCategoryStatus(totals(8, 8, 1), "2")).toBe("2");
    expect(preferredProductCategoryStatus(totals(8, 8, 8), "3")).toBe("3");
  });

  it("uses the first greatest group when the active group has fewer products", () => {
    expect(preferredProductCategoryStatus(totals(8, 8, 1), "3")).toBe("1");
  });

  it("keeps the active group when the category is empty", () => {
    expect(preferredProductCategoryStatus(totals(0, 0, 0), "2")).toBe("2");
  });

  it("accepts numeric strings and ignores missing or invalid totals", () => {
    expect(preferredProductCategoryStatus([
      { statusSort: "1", total: "invalid" },
      { statusSort: "2", total: "8" },
      { statusSort: "3", total: undefined },
    ], "1")).toBe("2");
    expect(preferredProductCategoryStatus([
      { statusSort: "1", total: -10 },
      { statusSort: "2", total: Number.POSITIVE_INFINITY },
      { statusSort: "3", total: null },
    ], "2")).toBe("2");
  });
});
