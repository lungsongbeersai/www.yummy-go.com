import { apiRequest } from "@/lib/api";
import { listParams } from "@/services/shared/crud";

export type MySalesKitchenStatus = "pending" | "partial" | "sent" | "cancelled";
export type MySalesPaymentStatus = "unpaid" | "paid" | "cancelled";

export interface MySalesParams {
  page?: number;
  limit?: number;
  search?: string;
  date_start?: string;
  date_end?: string;
  kitchen_status?: "all" | "pending" | "partial" | "sent";
  payment_status?: "all" | MySalesPaymentStatus;
  lang?: string;
}

export interface MySalesItem {
  order_it_uuid: string;
  product_name: string;
  quantity: number;
  price: number;
  total: number;
  status: number;
  kitchen_sent: boolean;
  kitchen_confirmed_at: string | null;
  note: string | null;
  size_name?: string | null;
  set_instance_uuid?: string | null;
  set_quantity?: number | null;
  status_sort_fk?: number | null;
  tastes?: { taste_uuid_fk: string; taste_name_la: string; taste_name_eng: string }[];
  toppings?: { topping_name_la: string; topping_name_eng: string; quantity: number; price: number }[];
}

export interface MySalesOrder {
  order_uuid: string;
  order_invoice: string | null;
  order_date_time: string | null;
  date_time_payment?: string | null;
  table_uuid_fk: string | null;
  table_name: string | null;
  zone_name: string | null;
  order_check_bill: number;
  order_status: number;
  is_cancelled: boolean;
  payment_status: MySalesPaymentStatus;
  kitchen_status: MySalesKitchenStatus;
  item_count: number;
  quantity: number;
  total: number;
  items: MySalesItem[];
}

export interface MySalesSummary {
  order_count: number;
  pending_kitchen_count: number;
  sent_kitchen_count: number;
  unpaid_count: number;
  paid_count: number;
  cancelled_count: number;
}

export interface MySalesResponse {
  status: string;
  data: MySalesOrder[];
  pagination: { page: number; limit: number; total: number; total_pages: number };
  summary: MySalesSummary;
}

export function fetchMySales(params: MySalesParams) {
  // Identity and branch come from the authenticated session on Backend.
  return apiRequest<MySalesResponse>("get", "/api/v1/posAll/my_sales", {
    params: listParams({
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      search: params.search?.trim() ?? "",
      date_start: params.date_start || undefined,
      date_end: params.date_end || undefined,
      kitchen_status: params.kitchen_status ?? "all",
      payment_status: params.payment_status ?? "all",
      lang: params.lang,
    }),
  });
}
