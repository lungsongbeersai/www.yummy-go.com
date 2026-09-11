import { apiRequest, ServiceError } from "@/lib/api";
import { toApiLanguage } from "@/lib/language";
import type { ApiEntity } from "@/services/shared/types";

export interface ZoneSalesRow extends ApiEntity {
  zone_uuid: string;
  zone_name: string;
  zone_name_la: string;
  zone_name_eng: string;
  is_unassigned: boolean;
  bill_count: number;
  customer_count: number;
  gross_amount: number;
  discount_amount: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
}

export interface ZoneSalesSummary {
  zone_count: number;
  bill_count: number;
  customer_count: number;
  gross_amount: number;
  discount_amount: number;
  net_sale: number;
  service_charge: number;
  vat: number;
  grand_total: number;
}

export interface ZoneSalesParams {
  branch_uuid_fk: string;
  zone_uuid_fk?: string;
  date_from: string;
  date_to: string;
  lang?: string;
}

export interface ZoneSalesResponse {
  zone_reports: ZoneSalesRow[];
  summary: ZoneSalesSummary;
  filters: { branch_uuid_fk: string; zone_uuid_fk: string | null; date_from: string; date_to: string };
}

export function getZoneSalesReport(params: ZoneSalesParams) {
  if (!params.branch_uuid_fk || !params.date_from || !params.date_to) {
    throw new ServiceError("Branch and date range are required", 400);
  }
  return apiRequest<ZoneSalesResponse>("get", "/api/v1/report_all/zone_report", {
    params: { ...params, zone_uuid_fk: params.zone_uuid_fk || undefined, lang: toApiLanguage(params.lang) },
  });
}
