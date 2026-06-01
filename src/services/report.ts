import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { PAGE_LIMIT_ALL_BATCH, isAllPageLimit } from "@/lib/pagination";
import type { ApiEntity, PageLimit } from "@/services/shared/types";

export type DailySalesReportType = "summary" | "detail";
export type DailySalesReportOrder = "ASC" | "DESC";
export type DailySalesPaymentMethod = "cash" | "transfer" | "debt" | "mixed";

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
