import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import { createMutationUuid } from "@/lib/pos/mutation-identity";
import type { ConfirmToKitchenPendingQuery, ConfirmToKitchenPrintJob } from "@/services/pos";

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
  request_uuid?: string | null;
  order_uuid_fk: string | null;
  product_name: string;
  product_code?: string;
  prod_code?: string;
  size_name?: string;
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
  request_uuid?: string;
}

export interface DepositOrderRedemption {
  withdrawal_uuid: string;
  deposit_uuid_fk: string;
  deposit_no: string;
  customer_name: string;
  customer_phone: string;
  product_name: string;
  product_code?: string;
  prod_code?: string;
  size_name?: string;
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
  order_uuid: string | null;
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

export interface DepositCreateItemInput {
  pro_detail_uuid: string;
  deposit_qty: number;
}

export interface DepositPrintContext {
  device_code?: string;
  agent_id?: string;
  print_mode?: string;
}

export interface DepositPrintResponse {
  print_status?: "queued" | "success" | "skipped" | "failed";
  print_job?: ConfirmToKitchenPrintJob | null;
  pending_query?: ConfirmToKitchenPendingQuery | null;
  print?: {
    role_code?: string;
    document_type?: string;
    reason?: string | null;
    reason_code?: string | null;
    printer?: {
      print_config_uuid?: string;
      printer_name?: string | null;
      device_code?: string | null;
      agent_id?: string | null;
      print_mode?: string | null;
    } | null;
  };
}

export interface DepositCreateInput extends DepositPrintContext {
  request_uuid?: string;
  branch_uuid: string;
  customer_uuid: string;
  order_uuid?: string;
  items: DepositCreateItemInput[];
  note?: string;
  lang?: string;
}

export interface DepositCreateResponse extends DepositPrintResponse {
  status: "success";
  message: string;
  lang: string;
  request_uuid: string;
  idempotent_replay: boolean;
  deposit_date: string | null;
  expire_date: string | null;
  deposits: DepositRow[];
}

export interface DepositWithdrawInput extends DepositPrintContext {
  request_uuid: string;
  deposit_uuid: string;
  order_uuid?: string;
  qty_withdrawn: number;
  note?: string;
  lang?: string;
}

export interface DepositWithdrawResponse extends DepositPrintResponse {
  status: "success";
  message: string;
  lang: string;
  request_uuid?: string;
  idempotent_replay: boolean;
  withdrawal: DepositWithdrawal;
  deposit: DepositRow;
}

export type DepositReceiptKind = "deposit" | "withdrawal";

export interface DepositReprintInput extends DepositPrintContext {
  request_uuid: string;
  kind: DepositReceiptKind;
  deposit_request_uuid?: string;
  deposit_uuid?: string;
  withdrawal_uuid?: string;
  lang?: string;
}

export interface DepositReprintResponse extends DepositPrintResponse {
  status: "success";
  message: string;
  lang?: string;
  request_uuid?: string;
  deposits?: DepositRow[];
  deposit?: DepositRow;
  withdrawal?: DepositWithdrawal;
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

function printContext(input: DepositPrintContext): DepositPrintContext {
  const context: DepositPrintContext = {};
  for (const key of ["device_code", "agent_id", "print_mode"] as const) {
    const value = input[key]?.trim();
    if (value) context[key] = value;
  }
  return context;
}

function validQuantity(value: number) {
  return Number.isFinite(value) && value > 0 && value <= 99_999_999_999.999 &&
    Math.abs(value * 1000 - Math.round(value * 1000)) < 0.0000001;
}

export function fetchDepositList(params: {
  branch_uuid: string;
  customer_uuid?: string;
  order_uuid?: string;
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
      ...(params.order_uuid ? { order_uuid: params.order_uuid } : {}),
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
  if (!input.items.length) throw new ServiceError("items is required", 400);
  input.items.forEach((item, index) => {
    if (!item.pro_detail_uuid.trim()) {
      throw new ServiceError(`items[${index}].pro_detail_uuid is required`, 400);
    }
    if (!validQuantity(item.deposit_qty)) {
      throw new ServiceError(`items[${index}].deposit_qty must be positive with up to 3 decimal places`, 400);
    }
  });

  return apiRequest<DepositCreateResponse>("post", "/api/v1/posAll/deposit/create", {
    data: {
      request_uuid: input.request_uuid
        ? required(input.request_uuid, "request_uuid")
        : createMutationUuid(),
      branch_uuid: required(input.branch_uuid, "branch_uuid"),
      customer_uuid: required(input.customer_uuid, "customer_uuid"),
      ...(input.order_uuid ? { order_uuid: input.order_uuid } : {}),
      items: input.items.map((item) => ({
        pro_detail_uuid: item.pro_detail_uuid.trim(),
        deposit_qty: item.deposit_qty
      })),
      ...(input.note ? { note: input.note } : {}),
      ...printContext(input),
      lang: toApiLanguage(input.lang)
    }
  });
}

export function withdrawDeposit(input: DepositWithdrawInput) {
  if (!validQuantity(input.qty_withdrawn)) {
    throw new ServiceError("qty_withdrawn must be positive with up to 3 decimal places", 400);
  }

  return apiRequest<DepositWithdrawResponse>("post", "/api/v1/posAll/deposit/withdraw", {
    data: {
      request_uuid: required(input.request_uuid, "request_uuid"),
      deposit_uuid: required(input.deposit_uuid, "deposit_uuid"),
      ...(input.order_uuid ? { order_uuid: input.order_uuid } : {}),
      qty_withdrawn: input.qty_withdrawn,
      ...(input.note ? { note: input.note } : {}),
      ...printContext(input),
      lang: toApiLanguage(input.lang)
    }
  });
}

export function reprintDepositReceipt(input: DepositReprintInput) {
  const identifiers = [input.deposit_request_uuid, input.deposit_uuid, input.withdrawal_uuid]
    .filter((value) => value?.trim());
  if (identifiers.length !== 1 ||
    (input.kind === "withdrawal" ? !input.withdrawal_uuid?.trim() : Boolean(input.withdrawal_uuid?.trim())) ||
    !["deposit", "withdrawal"].includes(input.kind)) {
    throw new ServiceError("Select exactly one original deposit or withdrawal receipt", 400);
  }
  return apiRequest<DepositReprintResponse>("post", "/api/v1/posAll/deposit/reprint", {
    data: {
      request_uuid: required(input.request_uuid, "request_uuid"),
      kind: input.kind,
      ...(input.deposit_request_uuid ? { deposit_request_uuid: input.deposit_request_uuid.trim() } : {}),
      ...(input.deposit_uuid ? { deposit_uuid: input.deposit_uuid.trim() } : {}),
      ...(input.withdrawal_uuid ? { withdrawal_uuid: input.withdrawal_uuid.trim() } : {}),
      ...printContext(input),
      lang: toApiLanguage(input.lang)
    }
  });
}
