import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { SortOrder } from "@/services/shared/types";

export interface VatReportRow {
  sale_date: string;
  sale_date_time: string;
  order_uuid: string;
  order_id: string;
  order_invoice: string;
  customer_uuid: string | null;
  member_code: string;
  customer_name: string;
  customer_phone: string;
  gross_amount: number;
  item_discount_amount: number;
  discount_bill: number;
  discount_amount: number;
  net_sale: number;
  service_charge: number;
  vat_rate: number;
  vat: number;
  grand_total: number;
}

export interface VatReportSummary {
  bill_count: number;
  discount_bill: number;
  discount_amount: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
}

export interface VatReportParams {
  branch_uuid_fk: string;
  search?: string;
  date_from: string;
  date_to: string;
  lang?: string;
  orderBy?: SortOrder;
}

export interface VatReportResponse {
  vat_rows: VatReportRow[];
  summary: VatReportSummary;
  filters: { branch_uuid_fk: string; search: string; date_from: string; date_to: string };
}

export function getVatReport(params: VatReportParams) {
  if (!params.branch_uuid_fk || !params.date_from || !params.date_to) {
    throw new ServiceError("Branch and date range are required", 400);
  }
  return apiRequest<VatReportResponse>("get", "/api/v1/report_all/vat_report", {
    params: { ...params, search: params.search || undefined, lang: toApiLanguage(params.lang) },
  });
}
