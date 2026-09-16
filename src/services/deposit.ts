import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";

export type DepositStatus = "ACTIVE" | "WITHDRAWN" | "EXPIRED" | "CANCELLED";
export type DepositListStatusFilter = "all" | "active" | "expired" | "withdrawn" | "cancelled";

export interface DepositRow {
  deposit_uuid: string;
  deposit_no: string;
  branch_uuid_fk: string;
  customer_uuid_fk: string;
  customer_name: string;
  customer_phone: string;
  pro_detail_uuid_fk: string;
  product_name: string;
  unit_name: string;
  deposit_qty: number;
  remaining_qty: number;
  deposit_date: string;
  expire_date: string | null;
  status: DepositStatus;
  status_text: string;
  is_expired: boolean;
  note: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DepositWithdrawal {
  withdrawal_uuid: string;
  deposit_uuid_fk: string;
  order_uuid_fk: string | null;
  qty_withdrawn: number;
  qty_before: number;
  qty_after: number;
  withdrawn_by: string | null;
  withdrawn_at: string;
  note: string;
}

export interface DepositOrderRedemption {
  withdrawal_uuid: string;
  deposit_uuid_fk: string;
  deposit_no: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  unit_name: string;
  qty_withdrawn: number;
  note: string;
  withdrawn_at: string;
  chargeable: false;
  amount: 0;
}

export interface DepositListResponse {
  status: "success";
  message: string;
  lang: string;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  filter_status: DepositListStatusFilter;
  search: string;
  data: DepositRow[];
}

export interface DepositDetailResponse {
  status: "success";
  message: string;
  lang: string;
  deposit: DepositRow;
  withdrawals: DepositWithdrawal[];
}

export interface DepositCreateInput {
  request_uuid: string;
  branch_uuid: string;
  customer_uuid: string;
  pro_detail_uuid: string;
  deposit_qty: number;
  expire_date?: string;
  note?: string;
  lang?: string;
}

export interface DepositCreateResponse {
  status: "success";
  message: string;
  lang: string;
  idempotent_replay: boolean;
  deposit: DepositRow;
}

export interface DepositWithdrawInput {
  request_uuid: string;
  deposit_uuid: string;
  order_uuid?: string;
  qty_withdrawn: number;
  note?: string;
  lang?: string;
}

export interface DepositWithdrawResponse {
  status: "success";
  message: string;
  lang: string;
  idempotent_replay: boolean;
  withdrawal: DepositWithdrawal;
  deposit: DepositRow;
}

export interface DepositOrderRedemptionsResponse {
  status: "success";
  message: string;
  lang: string;
  order_uuid: string;
  data: DepositOrderRedemption[];
}

function required(value: string, label: string) {
  const normalized = value.trim();
  if (!normalized) throw new ServiceError(`${label} is required`, 400);
  return normalized;
}

export function fetchDepositList(params: {
  branch_uuid: string;
  customer_uuid?: string;
  status?: DepositListStatusFilter;
  search?: string;
  page?: number;
  limit?: number;
  lang?: string;
}) {
  return apiRequest<DepositListResponse>("get", "/api/v1/posAll/deposit/list", {
    params: {
      branch_uuid: required(params.branch_uuid, "branch_uuid"),
      ...(params.customer_uuid ? { customer_uuid: params.customer_uuid } : {}),
      status: params.status ?? "active",
      search: params.search ?? "",
      page: params.page ?? 1,
      limit: params.limit ?? 20,
      lang: toApiLanguage(params.lang)
    }
  });
}

export function fetchDepositDetail(depositUuid: string, lang?: string) {
  return apiRequest<DepositDetailResponse>("get", "/api/v1/posAll/deposit/detail", {
    params: {
      deposit_uuid: required(depositUuid, "deposit_uuid"),
      lang: toApiLanguage(lang)
    }
  });
}

export function fetchDepositOrderRedemptions(orderUuid: string, lang?: string) {
  return apiRequest<DepositOrderRedemptionsResponse>("get", "/api/v1/posAll/deposit/order-redemptions", {
    params: {
      order_uuid: required(orderUuid, "order_uuid"),
      lang: toApiLanguage(lang)
    }
  });
}

export function createDeposit(input: DepositCreateInput) {
  if (input.deposit_qty <= 0) throw new ServiceError("deposit_qty ຕ້ອງ > 0", 400);

  return apiRequest<DepositCreateResponse>("post", "/api/v1/posAll/deposit/create", {
    data: {
      ...input,
      request_uuid: required(input.request_uuid, "request_uuid"),
      branch_uuid: required(input.branch_uuid, "branch_uuid"),
      customer_uuid: required(input.customer_uuid, "customer_uuid"),
      pro_detail_uuid: required(input.pro_detail_uuid, "pro_detail_uuid"),
      lang: toApiLanguage(input.lang)
    }
  });
}

export function withdrawDeposit(input: DepositWithdrawInput) {
  if (input.qty_withdrawn <= 0) throw new ServiceError("qty_withdrawn ຕ້ອງ > 0", 400);

  return apiRequest<DepositWithdrawResponse>("post", "/api/v1/posAll/deposit/withdraw", {
    data: {
      ...input,
      request_uuid: required(input.request_uuid, "request_uuid"),
      deposit_uuid: required(input.deposit_uuid, "deposit_uuid"),
      lang: toApiLanguage(input.lang)
    }
  });
}
