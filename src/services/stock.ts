import { apiRequest } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { Product, ProductDetail } from "@/services/product";
import type { ApiListResponse } from "@/services/shared/types";

export type StockStatus = "all" | "in_stock" | "low_stock" | "out_of_stock";

export interface StockDetail extends ProductDetail {
  stock_status: Exclude<StockStatus, "all">;
  stock_status_name: string;
  need_reorder: boolean;
}

export interface StockProduct extends Product {
  details: StockDetail[];
}

export interface FetchStockParams {
  branch_uuid_fk: string;
  category_fk?: string;
  stock_status?: StockStatus;
  page?: number;
  limit?: number;
  lang?: string;
}

export type StockResponse = ApiListResponse<StockProduct>;

export function getStockProducts(params: FetchStockParams) {
  return apiRequest<StockResponse>("get", "/api/v1/product/stock_qty", {
    params: {
      branch_uuid_fk: params.branch_uuid_fk,
      category_fk: params.category_fk || "all",
      stock_status: params.stock_status ?? "all",
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      lang: toApiLanguage(params.lang),
    },
  });
}
