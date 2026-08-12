import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import type {
  BestSellingProductsSortBy,
  DailySalesBillPaymentMethod,
  DailySalesPaymentMethod,
  PaymentMethodReportFilter,
} from "@/config/report-filters";
import type { ApiEntity, PageLimit } from "@/services/shared/types";
import type { PendingPrintJobsParams } from "@/services/printer";
export {
  BEST_SELLING_PRODUCTS_SORT_OPTIONS,
  DAILY_SALES_BILL_PAYMENT_METHOD_OPTIONS,
  isBestSellingProductsSortBy,
  isPaymentMethodReportFilter,
  PAYMENT_METHOD_REPORT_FILTER_OPTIONS,
} from "@/config/report-filters";
export type {
  BestSellingProductsSortBy,
  DailySalesBillPaymentMethod,
  DailySalesPaymentMethod,
  PaymentMethodReportFilter,
} from "@/config/report-filters";

export type DailySalesReportType = "summary" | "detail";
export type DailySalesReportOrder = "ASC" | "DESC";
export type DailySalesBillReportOrder = "ASC" | "DESC";
export type DailySaleItemsOrder = "ASC" | "DESC";
export type CategorySalesReportOrder = "ASC" | "DESC";

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

export interface FetchDailySalesBillReportParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  lang?: string;
  limit: PageLimit;
  orderBy: DailySalesBillReportOrder;
  page: number;
  payment_method?: DailySalesBillPaymentMethod;
  search?: string;
}

export interface FetchDailySalesOrderReportParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  lang?: string;
  limit: PageLimit;
  orderBy: DailySalesBillReportOrder;
  page: number;
  payment_method?: DailySalesBillPaymentMethod;
  search?: string;
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

export interface FetchDailyStoreClosingReportParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  lang?: string;
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

export interface DailySalesBillReportResponse extends ApiEntity {
  bills?: unknown;
  filters?: unknown;
  lang?: string;
  limit?: PageLimit;
  message?: string;
  page?: number;
  status?: string;
  summary?: unknown;
  total?: number;
  totalPages?: number;
}

export interface DailySalesOrderReportResponse extends DailySalesReportResponse {
  filters?: unknown;
  lang?: string;
  limit?: PageLimit;
  orders?: unknown;
  page?: number;
  summary?: unknown;
  total?: number;
  totalPages?: number;
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
  items?: unknown;
  limit?: PageLimit | "all";
  message?: string;
  methods?: unknown;
  page?: number;
  payment_rows?: unknown;
  payment_method_summaries?: unknown;
  payment_summary?: unknown;
  payment_summary_by_method?: unknown;
  payment_methods?: unknown;
  report_key?: string;
  report_name?: string;
  report_total?: unknown;
  rows?: unknown;
  status?: string;
  summary?: unknown;
  summary_cards?: unknown;
  total?: number;
  totalPages?: number;
}

export interface CategorySalesReportResponse extends ApiEntity {
  branch?: unknown;
  branch_uuid_fk?: string;
  data?: unknown;
  date_from?: string;
  date_to?: string;
  filters?: unknown;
  groups?: unknown;
  groups_count?: number;
  group_total?: number;
  lang?: string;
  limit?: number;
  message?: string;
  page?: number;
  payment_method?: PaymentMethodReportFilter;
  pagination?: unknown;
  report_key?: string;
  report_name?: string;
  search?: string;
  status?: string;
  summary?: unknown;
  total?: number;
  total_groups?: number;
  totalPages?: number;
}

export interface DailyStoreClosingReportResponse extends ApiEntity {
  cancel_summary?: unknown;
  data?: unknown;
  filters?: unknown;
  groups?: unknown;
  labels?: unknown;
  lang?: string;
  message?: string;
  order_channels?: unknown;
  payment_summary?: unknown;
  status?: string;
  summary?: unknown;
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

export interface ReportPrintOp {
  type: "text" | "line" | "lr" | "blank";
  text?: string;
  align?: "left" | "center" | "right";
  bold?: boolean;
  size?: number;
  left?: string;
  right?: string;
  n?: number;
}

export interface ReportPrintBrowserPayload {
  title: string;
  html: string;
}

export interface ReportPrintDocument {
  paper_width_mm: number;
  copies: number;
  cut_mode: string;
  ops: ReportPrintOp[];
  browser_payload?: ReportPrintBrowserPayload;
}

export interface ReportPrintInput {
  device_code: string;
  report_key: string;
  report_title: string;
  lang: string;
  report_payload?: ApiEntity;
  print_document: ReportPrintDocument;
}

export interface ReportPrintResponse extends ApiEntity {
  report_key?: string;
  report_title?: string;
  print_mode?: string;
  printer?: ApiEntity;
  print_job?: ApiEntity;
  next_action?: ApiEntity;
  pending_query?: PendingPrintJobsParams;
  reason?: string | null;
}

export function printReport(input: ReportPrintInput) {
  return apiRequest<ReportPrintResponse>("post", "/api/v1/pos/report/print", { data: input });
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
