import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { SortOrder } from "@/services/shared/types";

export interface EmployeeSalesGroupItem {
  order_uuid: string;
  order_invoice: string;
  sale_date: string;
  prod_uuid: string;
  product_full_name: string;
  unit_price: number;
  toppings: unknown[];
  total_qty: number;
  gross_amount: number;
  discount_amount: number;
  total_amount: number;
}

export interface EmployeeSalesGroup {
  group_uuid: string;
  group_name: string;
  total_qty: number;
  gross_amount: number;
  discount_amount: number;
  total_amount: number;
  items: EmployeeSalesGroupItem[];
}

export interface EmployeeSalesOrder {
  order_uuid: string;
  order_id: string;
  order_invoice: string;
  sale_date: string;
  sale_date_time: string;
  order_channel: number;
  total_qty: number;
  gross_amount: number;
  item_discount_amount: number;
  discount_bill: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
  cash: number;
  transfer: number;
  credit: number;
  employee_share: number;
}

export interface EmployeeSalesOrderChannel {
  order_channel: number;
  order_channel_name: string;
  bill_count: number;
  grand_total: number;
}

export interface EmployeeSalesSummary {
  order_count: number;
  bill_count: number;
  total_qty: number;
  gross_amount: number;
  item_discount_amount: number;
  bill_discount_amount: number;
  discount_amount: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
}

export interface EmployeeSalesPaymentSummary {
  cash: number;
  transfer: number;
  credit: number;
  payment_total: number;
}

export interface EmployeeSalesCancelSummary {
  cancel_bill_count: number;
  cancel_total_amount: number;
}

export interface EmployeeSalesRow {
  login_uuid: string;
  login_email: string;
  login_profile: string;
  login_active: number;
  roles_id: number;
  roles_name: string;
  branch_uuid_fk: string;
  branch_name: string;
  orders: EmployeeSalesOrder[];
  groups: EmployeeSalesGroup[];
  cancel_summary: EmployeeSalesCancelSummary;
  order_channels: EmployeeSalesOrderChannel[];
  summary: EmployeeSalesSummary;
  payment_summary: EmployeeSalesPaymentSummary;
}

export interface EmployeeSalesReportSummary extends EmployeeSalesSummary {
  employee_count: number;
  cash: number;
  transfer: number;
  credit: number;
  payment_total: number;
  cancel_bill_count: number;
  cancel_total_amount: number;
}

export interface EmployeeSalesParams {
  branch_uuid_fk: string;
  login_uuid?: string;
  date_from: string;
  date_to: string;
  lang?: string;
  orderBy?: SortOrder;
}

export interface EmployeeSalesResponse {
  user_reports: EmployeeSalesRow[];
  summary: EmployeeSalesReportSummary;
  filters: { branch_uuid_fk: string; login_uuid: string; date_from: string; date_to: string };
}

export function getEmployeeSalesReport(params: EmployeeSalesParams) {
  if (!params.branch_uuid_fk || !params.date_from || !params.date_to) {
    throw new ServiceError("Branch and date range are required", 400);
  }
  return apiRequest<EmployeeSalesResponse>("get", "/api/v1/report_all/user_report", {
    params: { ...params, login_uuid: params.login_uuid || undefined, lang: toApiLanguage(params.lang) },
  });
}
