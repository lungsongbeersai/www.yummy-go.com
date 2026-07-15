import { describe, expect, it } from "vitest";
import type { StockDetail } from "@/services/stock";
import {
  stockDetailEnabled,
  stockLevelStatus,
  stockNeedsReorder,
  stockStatusTranslationKey
} from "./stock-utils";

function detail(overrides: Partial<StockDetail> = {}): StockDetail {
  return {
    pro_detail_uuid: "detail-1",
    pro_detail_qty_stock: 10,
    pro_detail_enabled: 1,
    stock_status: "in_stock",
    stock_status_name: "In stock",
    need_reorder: false,
    ...overrides
  };
}

describe("stock utils", () => {
  it("uses the API stock status when it is valid", () => {
    expect(
      stockLevelStatus(
        detail({ stock_status: "low_stock", pro_detail_qty_stock: 50 }),
        5
      )
    ).toBe("low_stock");
  });

  it("derives a safe status when the API status is missing", () => {
    const withoutStatus = detail({ pro_detail_qty_stock: 0 });
    Object.defineProperty(withoutStatus, "stock_status", { value: undefined });
    expect(stockLevelStatus(withoutStatus, 5)).toBe("out_of_stock");

    const lowStock = detail({ pro_detail_qty_stock: 4 });
    Object.defineProperty(lowStock, "stock_status", { value: undefined });
    expect(stockLevelStatus(lowStock, 5)).toBe("low_stock");
  });

  it("uses explicit reorder and enabled flags", () => {
    expect(stockNeedsReorder(detail({ need_reorder: true }), 5)).toBe(true);
    expect(stockDetailEnabled(detail({ pro_detail_enabled: 1 }))).toBe(true);
    expect(stockDetailEnabled(detail({ pro_detail_enabled: 2 }))).toBe(false);
  });

  it("maps API status codes to translation keys", () => {
    expect(stockStatusTranslationKey("out_of_stock")).toBe(
      "stock.status.outOfStock"
    );
  });
});
