import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";

export type EmployeeWorkScope = "current" | "carryover" | "undated";
export type EmployeeWorkKitchenStatus = "pending" | "partial" | "sent" | "served" | "cancelled" | "empty";
export type EmployeeWorkPaymentStatus = "unpaid" | "partial" | "paid" | "credit_unpaid" | "credit_partial" | "cancelled" | "unknown" | "not_chargeable";
export type EmployeeWorkBillState = "open" | "closed" | "cancelled" | "empty" | "transferred" | "unknown";

export interface EmployeeWorkParams {
  business_date?: string;
  scope?: EmployeeWorkScope;
  kitchen_status?: "all" | EmployeeWorkKitchenStatus;
  payment_status?: "all" | EmployeeWorkPaymentStatus;
  search?: string;
  lang?: string;
  page?: number;
  limit?: number;
}

export interface EmployeeWorkEmployee {
  login_uuid: string;
  display_name: string;
  branch_uuid: string;
  branch_name: string;
  store_uuid: string;
}

export interface EmployeeWorkBusinessDay {
  date: string;
  time_zone: "Asia/Vientiane";
  cutoff: "05:00";
  starts_at: string;
  ends_at: string;
  next_reset_at: string;
}

export interface EmployeeWorkItem {
  order_it_uuid: string;
  product_name: string;
  size_name: string | null;
  quantity: number;
  price: number;
  item_discount_amount: number;
  total: number;
  financial_quantity: number;
  is_set_component: boolean;
  status: number;
  kitchen_sent: boolean;
  kitchen_confirmed_at: string | null;
  created_at: string | null;
  created_by: string | null;
  created_by_name: string;
  note: string;
  toppings: { topping_name: string; quantity: number; price: number }[];
  print_status: "acknowledged" | "partial" | "queued" | "failed" | "skipped" | "unknown";
}

export interface EmployeeWorkTotals {
  source: "stored_bill" | "unknown";
  currency: "LAK";
  quantity: number;
  gross_amount: number | null;
  item_discount_amount: number | null;
  subtotal: number | null;
  discount_amount: number | null;
  service_amount: number | null;
  vat_amount: number | null;
  grand_total: number | null;
  received_total: number | null;
  balance_amount: number | null;
  credit_balance: number | null;
}

export interface EmployeeWorkOrder {
  order_uuid: string;
  order_invoice: string | null;
  table_uuid: string | null;
  table_name: string | null;
  zone_name: string | null;
  order_created_by: string;
  creator_name: string;
  order_date: string | null;
  opened_at: string | null;
  opened_at_source: "order_audit" | "first_item" | "unknown";
  opened_at_exact: boolean;
  business_date: string | null;
  time_warning: "FIRST_SURVIVING_ITEM_ESTIMATE" | "HISTORICAL_OPEN_TIME_UNKNOWN" | null;
  financial_warning: "BILL_SNAPSHOT_INCOMPLETE" | "PAYMENT_SNAPSHOT_INCOMPLETE" | "BILL_ITEMS_MISSING" | null;
  date_time_payment: string | null;
  payment_time_source: "database_timestamp" | "unknown";
  scope: EmployeeWorkScope;
  order_check_bill: number;
  order_status: number;
  is_cancelled: boolean;
  bill_state: EmployeeWorkBillState;
  check_bill_requested: boolean;
  kitchen_status: EmployeeWorkKitchenStatus;
  payment_status: EmployeeWorkPaymentStatus;
  totals: EmployeeWorkTotals;
  items: EmployeeWorkItem[];
}

export interface EmployeeWorkSummary {
  order_count: number;
  open_count: number;
  pending_kitchen_count: number;
  sent_kitchen_count: number;
  check_bill_count: number;
  unpaid_count: number;
  paid_count: number;
  credit_count: number;
  cancelled_count: number;
  financial_unknown_count: number;
  total_amount: number | null;
  balance_amount: number | null;
  credit_balance_amount: number | null;
}

export interface EmployeeWorkResponse {
  status: string;
  message: string;
  server_now: string;
  ownership_mode: "bill_opener";
  employee: EmployeeWorkEmployee;
  business_day: EmployeeWorkBusinessDay;
  filters: Required<Pick<EmployeeWorkParams, "business_date" | "scope" | "search" | "kitchen_status" | "payment_status" | "lang">>;
  data: EmployeeWorkOrder[];
  summary: EmployeeWorkSummary;
  scope_summary: Record<EmployeeWorkScope, { order_count: number; financial_unknown_count: number; total_amount: number | null; balance_amount: number | null }>;
  pagination: { page: number; limit: number; total: number; total_pages: number };
  report: { complete: boolean; max_orders: number };
  warnings: string[];
}

export function employeeWorkQuery(params: EmployeeWorkParams, report = false) {
  const search = params.search?.trim() ?? "";
  if (search.length > 120) throw new ServiceError("Search must contain at most 120 characters", 400);
  const page = params.page ?? 1;
  const limit = params.limit ?? 20;
  if (!report && (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100)) throw new ServiceError("Invalid work pagination", 400);
  return {
    business_date: params.business_date || undefined,
    scope: params.scope ?? "current",
    kitchen_status: params.kitchen_status ?? "all",
    payment_status: params.payment_status ?? "all",
    search,
    lang: toApiLanguage(params.lang),
    ...(!report ? { page, limit } : {}),
  };
}

export function getEmployeeWork(params: EmployeeWorkParams) {
  return apiRequest<EmployeeWorkResponse>("get", "/api/v1/posAll/my_work", { params: employeeWorkQuery(params) });
}

export function getEmployeeWorkReport(params: EmployeeWorkParams) {
  return apiRequest<EmployeeWorkResponse>("get", "/api/v1/posAll/my_work/report", { params: employeeWorkQuery(params, true) });
}
