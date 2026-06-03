import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export type DailySalesReportType = "summary" | "detail";
export type DailySalesReportOrder = "ASC" | "DESC";
export type DailySalesPaymentMethod = "cash" | "transfer" | "debt" | "mixed";
export type PaymentMethodReportOrder = "ASC" | "DESC";
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
  page: number;
  payment_method?: DailySalesPaymentMethod;
  type_page: DailySalesReportType;
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
  const { payment_method, ...rest } = params;
  const query: Record<string, unknown> = {
    ...rest,
    limit: isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit,
    lang: toApiLanguage(params.lang)
  };
  if (payment_method) query.payment_method = payment_method;

  return apiRequest<DailySalesReportResponse>("get", "/api/v1/report/sale_report", {
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

export function getBestSellingProductsReport(params: FetchBestSellingProductsReportParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  const { group_uuid_fk, ...rest } = params;
  const query: Record<string, unknown> = {
    ...rest,
    limit: isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit,
    lang: toApiLanguage(params.lang)
  };
  if (group_uuid_fk) query.group_uuid_fk = group_uuid_fk;

  return apiRequest<BestSellingProductsReportResponse>("get", "/api/v1/best_selling/best_selling_products", {
    params: query
  });
}
