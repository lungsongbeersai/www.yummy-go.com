import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { SortOrder } from "@/services/shared/types";

export interface CustomerSalesOrder {
  sale_date: string;
  sale_date_time: string;
  order_uuid: string;
  order_id: string;
  order_invoice: string;
  total_qty: number;
  gross_amount: number;
  item_discount_amount: number;
  discount_bill: number;
  discount_amount: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
}

export interface CustomerSalesSummary {
  bill_count: number;
  discount_bill: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
}

export interface CustomerSalesRow {
  customer_uuid: string;
  member_code: string;
  customer_name: string;
  customer_phone: string;
  summary: CustomerSalesSummary;
  details: CustomerSalesOrder[];
}

export interface CustomerSalesReportSummary extends CustomerSalesSummary {
  customer_count: number;
}

export interface CustomerSalesParams {
  branch_uuid_fk: string;
  customer_uuid?: string;
  search?: string;
  date_from: string;
  date_to: string;
  lang?: string;
  orderBy?: SortOrder;
}

export interface CustomerSalesResponse {
  customer_reports: CustomerSalesRow[];
  summary: CustomerSalesReportSummary;
  filters: { branch_uuid_fk: string; customer_uuid: string | null; search: string; date_from: string; date_to: string };
}

export function getCustomerSalesReport(params: CustomerSalesParams) {
  if (!params.branch_uuid_fk || !params.date_from || !params.date_to) {
    throw new ServiceError("Branch and date range are required", 400);
  }
  return apiRequest<CustomerSalesResponse>("get", "/api/v1/report_all/customer_report", {
    params: {
      ...params,
      customer_uuid: params.customer_uuid || undefined,
      search: params.search || undefined,
      lang: toApiLanguage(params.lang),
    },
  });
}
