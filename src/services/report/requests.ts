import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import type { PageLimit } from "@/services/shared/types";
import type {
  BestSellingProductsReportResponse,
  CategorySalesReportResponse,
  DailySaleItemsResponse,
  DailySalesBillReportResponse,
  DailySalesOrderReportResponse,
  DailySalesReportResponse,
  DailyStoreClosingReportResponse,
  FetchBestSellingProductsReportParams,
  FetchCategorySalesReportParams,
  FetchDailySaleItemsParams,
  FetchDailySalesBillReportParams,
  FetchDailySalesOrderReportParams,
  FetchDailySalesReportParams,
  FetchDailyStoreClosingReportParams,
  FetchPaymentMethodsReportParams,
  PaymentMethodsReportResponse,
  ReportPrintInput,
  ReportPrintResponse,
} from "./types";

export function printReport(input: ReportPrintInput) {
  return apiRequest<ReportPrintResponse>("post", "/api/v1/posAll/report/print", { data: input });
}

interface ReportRequestParams {
  branch_uuid_fk: string;
  lang?: string;
  limit?: PageLimit;
}

// Scaffolding ที่ทุก fetcher ใช้ร่วมกัน: guard สาขา + แปลง limit แบบ "All" + normalize lang
// defaults ถูก merge ทับ query ท้ายสุด ให้แต่ละ fetcher กำหนด fallback เฉพาะตัวได้
function reportRequest<T>(
  endpoint: string,
  params: ReportRequestParams,
  defaults: Record<string, unknown> = {}
) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  const query: Record<string, unknown> = { ...params, lang: toApiLanguage(params.lang) };
  if (params.limit !== undefined) {
    query.limit = isAllPageLimit(params.limit) ? PAGE_LIMIT_ALL_BATCH : params.limit;
  }

  return apiRequest<T>("get", endpoint, { params: { ...query, ...defaults } });
}

export function getDailySalesReport(params: FetchDailySalesReportParams) {
  return reportRequest<DailySalesReportResponse>("/api/v1/report/sale_report", params, {
    payment_method: params.payment_method ?? "all",
    payment_type: params.payment_type ?? params.payment_method ?? "all"
  });
}

export function getDailySalesBillReport(params: FetchDailySalesBillReportParams) {
  return reportRequest<DailySalesBillReportResponse>("/api/v1/report_all/sale_report_bill", params, {
    payment_method: params.payment_method ?? "All",
    search: params.search?.trim() ?? ""
  });
}

export function getDailySalesOrderReport(params: FetchDailySalesOrderReportParams) {
  return reportRequest<DailySalesOrderReportResponse>("/api/v1/report_all/sale_report_list", params, {
    payment_method: params.payment_method ?? "All",
    search: params.search?.trim() ?? ""
  });
}

export function getDailySaleItems(params: FetchDailySaleItemsParams) {
  return reportRequest<DailySaleItemsResponse>("/api/v1/report_all/sale_list", params, {
    payment_method: params.payment_method ?? "All",
    search: params.search?.trim() ?? ""
  });
}

export function getPaymentMethodsReport(params: FetchPaymentMethodsReportParams) {
  // endpoint นี้รับ limit=all ตรง ๆ ไม่ใช้ค่า batch เหมือนรายงานอื่น
  return reportRequest<PaymentMethodsReportResponse>("/api/v1/report_all/payment_summary_by_method", params, {
    limit: isAllPageLimit(params.limit) ? "all" : params.limit,
    payment_method: params.payment_method ?? "all"
  });
}

export function getCategorySalesReport(params: FetchCategorySalesReportParams) {
  return reportRequest<CategorySalesReportResponse>("/api/v1/report_all/group_list", params, {
    orderBy: params.orderBy ?? "DESC",
    payment_method: params.payment_method ?? "all"
  });
}

export function getDailyStoreClosingReport(params: FetchDailyStoreClosingReportParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);
  if (!params.date_from) throw new ServiceError("date_from is required", 400);
  if (!params.date_to) throw new ServiceError("date_to is required", 400);

  return reportRequest<DailyStoreClosingReportResponse>("/api/v1/report_all/daily_closing", params);
}

export function getBestSellingProductsReport(params: FetchBestSellingProductsReportParams) {
  return reportRequest<BestSellingProductsReportResponse>("/api/v1/best_selling/best_selling_products", params, {
    group_uuid_fk: params.group_uuid_fk || "all"
  });
}
