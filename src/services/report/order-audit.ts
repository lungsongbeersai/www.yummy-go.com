import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { OrderAuditAction } from "@/config/order-audit";

export type { OrderAuditAction } from "@/config/order-audit";
export type AuditValue = string | number | boolean | null;

export interface OrderAuditRow {
  audit_id: string;
  transaction_id: string;
  request_id: string | null;
  store_uuid_fk: string;
  branch_uuid_fk: string;
  order_uuid_fk: string;
  order_invoice: string;
  related_order_uuid_fk: string | null;
  related_order_invoice: string;
  entity_type: "ORDER" | "ITEM" | "TOPPING" | "PAYMENT";
  entity_uuid: string;
  entity_label_la: string;
  entity_label_eng: string;
  operation: "INSERT" | "UPDATE" | "DELETE";
  action: OrderAuditAction;
  actor_uuid: string | null;
  actor_name: string | null;
  actor_type: "USER" | "CUSTOMER" | "UNKNOWN";
  route: string;
  reason: string;
  before_data: Record<string, AuditValue> | null;
  after_data: Record<string, AuditValue> | null;
  changed_fields: string[];
  recorded_at: string;
}

export interface OrderAuditParams {
  branch_uuid_fk: string;
  date_from: string;
  date_to: string;
  search?: string;
  action?: string;
  entity_type?: string;
  order_uuid_fk?: string;
  actor_uuid?: string;
  page: number;
  limit: number;
  snapshot_id?: string;
  lang?: string;
}

export interface OrderAuditResponse {
  rows: OrderAuditRow[];
  pagination: { page: number; limit: number; total: number; total_pages: number; snapshot_id: string };
  summary: { event_count: number; bill_count: number; discount_count: number };
  filters: { branch_uuid_fk: string; date_from: string; date_to: string };
  time_zone: string;
}

export function getOrderAuditReport(params: OrderAuditParams) {
  if (!params.branch_uuid_fk || !params.date_from || !params.date_to) {
    throw new ServiceError("Branch and date range are required", 400);
  }
  return apiRequest<OrderAuditResponse>("get", "/api/v1/report_all/order_audit_log", {
    params: { ...params, search: params.search?.trim() || "", lang: toApiLanguage(params.lang) },
  });
}
