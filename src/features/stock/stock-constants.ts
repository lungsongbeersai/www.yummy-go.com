import type { StockStatus } from "@/services/stock";

export const STOCK_PAGE_LIMIT_OPTIONS: readonly number[] = [20, 50, 100, 200];

export const STOCK_STATUS_OPTIONS: readonly StockStatus[] = [
  "all",
  "in_stock",
  "low_stock",
  "out_of_stock"
];
