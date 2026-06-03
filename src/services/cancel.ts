import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { ApiEntity, PageLimit, SortOrder } from "@/services/shared/types";

export interface FetchCancelableBillsParams {
  branch_uuid_fk: string;
  date_select: string;
  lang?: string;
  limit: PageLimit;
  orderBy: SortOrder;
  page: number;
  selected_order_uuid?: string;
}

export type CancelHistoryOrder = "ASC" | "DESC";

export interface FetchCancelledBillsParams {
  branch_uuid_fk: string;
  end_date: string;
  limit: PageLimit;
  orderBy: CancelHistoryOrder;
  page: number;
  start_date: string;
}

export interface CancelableBill extends ApiEntity {
  can_cancel?: boolean | number | string;
  is_selected?: boolean | number | string;
  order_uuid?: string;
}

export interface CancelableBillDetail extends ApiEntity {
  can_cancel?: boolean | number | string;
  order_uuid?: string;
}

export interface CancelableDateOption extends ApiEntity {
  date_select?: string;
  label?: string;
  value?: string;
}

export interface CancelableBillsResponse extends ApiEntity {
  data?: CancelableBill[];
  date_options?: CancelableDateOption[];
  selected_bill?: CancelableBillDetail | null;
  total?: number;
  totalPage?: number;
  totalPages?: number;
  total_page?: number;
}

export interface CancelledBill extends ApiEntity {
  branch_name?: string;
  branch_name_eng?: string;
  branch_uuid_fk?: string;
  order_balance?: number | string;
  order_cancel_reason?: string;
  order_cancelled_at?: string;
  order_date?: string;
  order_discount_amount?: number | string;
  order_grand_total?: number | string;
  order_invoice?: string;
  order_paid_total?: number | string;
  order_qty?: number | string;
  order_service_amount?: number | string;
  order_subtotal?: number | string;
  order_total?: number | string;
  order_uuid?: string;
  order_vat_amount?: number | string;
  status_code?: string;
  status_name?: string;
  table_id?: number | string;
  table_name_eng?: string;
  table_name_la?: string;
  table_uuid_fk?: string;
}

export interface CancelledBillsResponse extends ApiEntity {
  data?: CancelledBill[];
  limit?: number;
  page?: number;
  total?: number;
  totalPages?: number;
}

export interface CancelBillInput {
  order_cancel_reason: string;
  order_uuid: string;
}

export function fetchCancelableBills(params: FetchCancelableBillsParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);

  return apiRequest<CancelableBillsResponse>("get", "/api/v1/cancel/fetch_cancelable_bills", {
    params: {
      ...params,
      lang: toApiLanguage(params.lang)
    }
  });
}

export function fetchCancelledBills(params: FetchCancelledBillsParams) {
  if (!params.branch_uuid_fk) throw new ServiceError("branch_uuid_fk is required", 400);

  return apiRequest<CancelledBillsResponse>("get", "/api/v1/cancel/fetch_cancel_bills", {
    params: { ...params }
  });
}

export function cancelBill(input: CancelBillInput) {
  if (!input.order_uuid) throw new ServiceError("order_uuid is required", 400);
  if (!input.order_cancel_reason.trim()) throw new ServiceError("order_cancel_reason is required", 400);

  return apiRequest<{ message?: string; status?: string }>("patch", "/api/v1/cancel/cancel_bill", {
    data: {
      order_uuid: input.order_uuid,
      order_cancel_reason: input.order_cancel_reason.trim()
    }
  });
}
