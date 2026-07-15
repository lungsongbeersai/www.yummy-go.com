import {
  detailStockQty,
  numberValue,
  productDetails
} from "@/features/product/list/product-list-utils";
import type {
  StockDetail,
  StockProduct,
  StockStatus
} from "@/services/stock";

export type StockLevelStatus = Exclude<StockStatus, "all">;

const STOCK_LEVEL_STATUSES = new Set<StockLevelStatus>([
  "in_stock",
  "low_stock",
  "out_of_stock"
]);

export function stockDetails(row: StockProduct) {
  return productDetails(row) as StockDetail[];
}

export function stockLevelStatus(
  detail: StockDetail,
  orderPoint: unknown
): StockLevelStatus {
  const apiStatus = String(detail.stock_status ?? "") as StockLevelStatus;
  if (STOCK_LEVEL_STATUSES.has(apiStatus)) return apiStatus;

  const quantity = detailStockQty(detail);
  if (quantity <= 0) return "out_of_stock";
  if (quantity <= numberValue(orderPoint)) return "low_stock";
  return "in_stock";
}

export function stockNeedsReorder(
  detail: StockDetail,
  orderPoint: unknown
) {
  if (typeof detail.need_reorder === "boolean") return detail.need_reorder;
  return stockLevelStatus(detail, orderPoint) !== "in_stock";
}

export function stockDetailEnabled(detail: StockDetail) {
  return Number(detail.pro_detail_enabled) === 1;
}

export function stockStatusTranslationKey(status: StockStatus) {
  const keys: Record<StockStatus, string> = {
    all: "stock.status.all",
    in_stock: "stock.status.inStock",
    low_stock: "stock.status.lowStock",
    out_of_stock: "stock.status.outOfStock"
  };

  return keys[status];
}
