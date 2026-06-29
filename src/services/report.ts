import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export type DailySalesReportType = "summary" | "detail";
export type DailySalesReportOrder = "ASC" | "DESC";
export type DailySalesPaymentMethod = "all" | "cash" | "transfer" | "debt" | "mixed";
export type DailySaleItemsOrder = "ASC" | "DESC";
export type PaymentMethodReportOrder = "ASC" | "DESC";
export type CategorySalesReportOrder = "ASC" | "DESC";
export const PAYMENT_METHOD_REPORT_FILTER_OPTIONS = ["all", "cash", "transfer", "debt"] as const;
export type PaymentMethodReportFilter = (typeof PAYMENT_METHOD_REPORT_FILTER_OPTIONS)[number];
export const BEST_SELLING_PRODUCTS_SORT_OPTIONS = [
  "qty",
  "total",
  "date_asc",
  "date_desc"
] as const;
export type BestSellingProductsSortBy = (typeof BEST_SELLING_PRODUCTS_SORT_OPTIONS)[number];

export function isBestSellingProductsSortBy(value: unknown): value is BestSellingProductsSortBy {
  return (
    typeof value === "string" &&
    BEST_SELLING_PRODUCTS_SORT_OPTIONS.includes(value as BestSellingProductsSortBy)
  );
}

export function isPaymentMethodReportFilter(value: unknown): value is PaymentMethodReportFilter {
  return (
    typeof value === "string" &&
    PAYMENT_METHOD_REPORT_FILTER_OPTIONS.includes(value as PaymentMethodReportFilter)
  );
}

export interface FetchDailySalesReportParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  lang?: string;
  limit: PageLimit;
  orderBy: DailySalesReportOrder;
  payment_method?: DailySalesPaymentMethod;
  payment_type?: DailySalesPaymentMethod;
  page: number;
  type_page: DailySalesReportType;
}

export interface FetchDailySaleItemsParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  lang?: string;
  limit: PageLimit;
  orderBy: DailySaleItemsOrder;
  page: number;
  payment_method?: string;
  search?: string;
}

export interface FetchPaymentMethodsReportParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  lang?: string;
  limit: PageLimit;
  orderBy: PaymentMethodReportOrder;
  page: number;
  payment_method: PaymentMethodReportFilter;
}

export interface FetchCategorySalesReportParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  lang?: string;
  limit: PageLimit;
  orderBy: CategorySalesReportOrder;
  page: number;
  payment_method: PaymentMethodReportFilter;
}

export interface DailySalesReportResponse extends ApiEntity {
  data?: unknown;
  grand_total?: unknown;
  grand_total_by_date?: unknown;
  message?: string;
  report_total?: unknown;
  status?: string;
  summary_cards?: unknown;
  total?: number;
  totalPage?: number;
  totalPages?: number;
  total_page?: number;
}

export interface DailySaleItemsBillSummary extends ApiEntity {
  amount?: number | string;
  debt_amount?: number | string;
  discount_bill?: number | string;
  discount_item?: number | string;
  discount_total?: number | string;
  items_count?: number | string;
  qty_total?: number | string;
  sum_discount?: number | string;
  sum_servicecharge?: number | string;
  sum_total?: number | string;
  sum_vate?: number | string;
  receive_cash?: number | string;
  receive_transfer?: number | string;
  service_charge?: number | string;
  total?: number | string;
  topping_total?: number | string;
  vat?: number | string;
}

export interface DailySaleItemsItem extends ApiEntity {
  amount?: number | string;
  cate_name?: string;
  group_name?: string;
  note?: string;
  order_item_uuid?: string;
  prod_code?: string;
  prod_image?: string;
  prod_image_raw?: string;
  product_name?: string;
  qty?: number | string;
  sale_price?: number | string;
  total?: number | string;
}

export interface DailySaleItemsBill extends ApiEntity {
  bill_status?: string;
  branch_name?: string;
  branch_uuid_fk?: string;
  items?: DailySaleItemsItem[];
  order_invoice?: string;
  order_uuid?: string;
  payment_method_code?: string;
  payment_method_name?: string;
  sale_date?: string;
  summary?: DailySaleItemsBillSummary;
  table_name?: string;
}

export interface DailySaleItemsResponse extends ApiEntity {
  data?: DailySaleItemsBill[];
  date_from?: string;
  date_to?: string;
  limit?: number;
  message?: string;
  orderBy?: DailySaleItemsOrder;
  page?: number;
  report_key?: string;
  report_name?: string;
  report_total?: ApiEntity;
  sales?: unknown;
  summary?: ApiEntity;
  status?: string;
  total?: number;
  totalPages?: number;
}

export interface PaymentMethodsReportResponse extends ApiEntity {
  card_summary?: unknown;
  dashboard_cards?: unknown;
  data?: unknown;
  limit?: number;
  message?: string;
  page?: number;
  payment_methods?: unknown;
  report_name?: string;
  report_total?: unknown;
  status?: string;
  summary_cards?: unknown;
  total?: number;
  totalPages?: number;
}

export interface CategorySalesReportResponse extends ApiEntity {
  branch_uuid_fk?: string;
  data?: unknown;
  date_from?: string;
  date_to?: string;
  limit?: number;
  message?: string;
  orderBy?: CategorySalesReportOrder;
  page?: number;
  payment_method?: PaymentMethodReportFilter;
  report_key?: string;
  report_name?: string;
  search?: string;
  status?: string;
  total?: number;
  totalPages?: number;
}

export interface FetchBestSellingProductsReportParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  group_uuid_fk?: string;
  lang?: string;
  limit: PageLimit;
  page: number;
  sort_by: BestSellingProductsSortBy;
}

export interface BestSellingProductsReportResponse extends ApiEntity {
  data?: unknown;
  filters?: unknown;
  message?: string;
  pagination?: unknown;
  report?: unknown;
  status?: string;
}

export function getDailySalesReport(params: FetchDailySalesReportParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  const query: Record<string, unknown> = {
    ...params,
    limit: isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit,
    lang: toApiLanguage(params.lang)
  };
  query.payment_method = params.payment_method ?? "all";
  query.payment_type = params.payment_type ?? params.payment_method ?? "all";

  return apiRequest<DailySalesReportResponse>("get", "/api/v1/report/sale_report", {
    params: query
  });
}

export function getDailySaleItems(params: FetchDailySaleItemsParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  const { search, ...rest } = params;
  const query: Record<string, unknown> = {
    ...rest,
    limit: isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit,
    lang: toApiLanguage(params.lang),
    payment_method: params.payment_method ?? "All",
    search: search?.trim() ?? ""
  };

  return apiRequest<DailySaleItemsResponse>("get", "/api/v1/report_all/sale_list", {
    params: query
  });
}

export function getPaymentMethodsReport(params: FetchPaymentMethodsReportParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  const query: Record<string, unknown> = {
    ...params,
    limit: isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit,
    lang: toApiLanguage(params.lang)
  };

  return apiRequest<PaymentMethodsReportResponse>("get", "/api/v1/report/payment_methods", {
    params: query
  });
}

export function getCategorySalesReport(params: FetchCategorySalesReportParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  const query: Record<string, unknown> = {
    ...params,
    limit: isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit,
    lang: toApiLanguage(params.lang)
  };

  return apiRequest<CategorySalesReportResponse>("get", "/api/v1/report/category_sales", {
    params: query
  });
}

export function getBestSellingProductsReport(params: FetchBestSellingProductsReportParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  const query: Record<string, unknown> = {
    ...params,
    group_uuid_fk: params.group_uuid_fk || "all",
    limit: isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit,
    lang: toApiLanguage(params.lang)
  };

  return apiRequest<BestSellingProductsReportResponse>("get", "/api/v1/best_selling/best_selling_products", {
    params: query
  });
}
